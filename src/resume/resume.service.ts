import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import OpenAI from 'openai';
import { PrismaService } from 'src/prisma/prisma.service';
import { PDFParse } from 'pdf-parse';
import { responseFormat } from './utils';

@Injectable()
export class ResumeService {
  // TODO: rename it to llm service something generic
  private openai: OpenAI
  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI()
  }
  async create(resume: Express.Multer.File, createResumeDto: CreateResumeDto) {
    if (!resume) {
      throw new BadRequestException('Resume is required')
    }
    if (resume.mimetype !== 'application/pdf') {
      throw new BadRequestException("Only pdf allowed")
    }
    let rawText = ""
    try {
      const parser = new PDFParse({
        data: resume.buffer,
      })
      const result = await parser.getText()
      rawText = result.text

    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new HttpException('Failed to parse PDF file', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const { title, userId, targetJobDescription, targetRole } = createResumeDto
    const systemPrompt = `
      You are an expert Applicant Tracking System (ATS) auditor and career coach.
      Your job is to analyze the candidate's raw resume text and perform two tasks:
      1. Parse the resume into structured JSON (skills, experience, education, etc.).
      2. Evaluate it against the target role: "${targetRole || 'General'}" and target job description: "${targetJobDescription || 'General'}".
      
      To ensure absolute scoring consistency, use the following strict mathematical grading rubric (total 100 points):
      - Keywords matching (30 points): Score based on the matching density of critical hard skills and industry keywords.
      - Impact and metrics (30 points): Score based on the presence of measurable business results and active verbs.
      - Formatting and structure (20 points): Score based on standard sections and clear chronological flow.
      - Style and tone (20 points): Score based on grammatical correctness and professional action verbs.

      Sum these categories to compute the final atsScore. Be objective, realistic, and strict.
      Provide a breakdown of scores, a high-level verdict, and a list of specific, actionable issues (e.g. missing keywords, passive verbs, weak bullet points) with direct suggestions for how to rewrite them.
    `;
    const userPrompt = `
      Candidate Resume Text:
      ---
      ${rawText}
      ---
    `;
    try {
      const response = await this.openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          response_format: responseFormat,
          temperature: 0 // Forces the model to always choose the most probable tokens for determinism
        })

      const result = JSON.parse(response.choices[0]!.message.content!)
      const dbTransaction = await this.prisma.$transaction(async (transac) => {
        const resumeRecord = await transac.resume.create({
          data: {
            title, userId: 'fcf5cd02-ba0a-4f66-9759-d45ea1b56622'
          }
        })
        const versionRecord = await transac.resumeVersion.create({ data: { resumeId: resumeRecord.id, versionNumber: 1, parsedData: result.parsedData as any } })

        const analysisRecord = await transac.analysis.create({ data: { resumeVersionId: versionRecord.id, targetRole, targetJobDescription, atsScore: result.atsScore, scoreBreakdown: result.scoreBreakdown as any, aiVerdict: result.aiVerdict, issues: result.issues as any } })
        return {
          resume: resumeRecord,
          version: versionRecord,
          analysis: analysisRecord,
        };
      })
      return dbTransaction;
    } catch (error) {
      console.error("Error creating resume:", error);
      throw new HttpException('Failed to create resume', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  findAll() {
    return `This action returns all resume`;
  }

  findOne(id: number) {
    return `This action returns a #${id} resume`;
  }

  update(id: number, updateResumeDto: UpdateResumeDto) {
    return `This action updates a #${id} resume`;
  }

  remove(id: number) {
    return `This action removes a #${id} resume`;
  }
}
