import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyzeResumeDto } from './dto/analyze-resume.dto';
import { DocumentService } from 'src/document/document.service';
import { LLMService } from 'src/llm/llm.service';
import { ScoringService } from 'src/scoring/scoring.service';
import puppeteer from 'puppeteer';
import { StreamableFile } from '@nestjs/common';


@Injectable()
export class ResumeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: DocumentService,
    private readonly llmService: LLMService,
    private readonly scoringService: ScoringService) {
  }
  async create(userId: string, resume: Express.Multer.File, createResumeDto: CreateResumeDto) {
    if (!resume) {
      throw new BadRequestException('Resume is required')
    }
    if (resume.mimetype !== 'application/pdf') {
      throw new BadRequestException("Only pdf allowed")
    }
    const rawText = await this.documentService.extractTextFromPDF(resume.buffer)
    const { title } = createResumeDto
    try {
      const dbTransaction = await this.prisma.$transaction(async (transac) => {
        const resumeRecord = await transac.resume.create({
          data: {
            title, userId
          }
        })
        const versionRecord = await transac.resumeVersion.create({ data: { resumeId: resumeRecord.id, versionNumber: 1, rawText, source: 'upload' } })
        return {
          resume: resumeRecord,
          version: versionRecord,
        };
      })
      return dbTransaction;
    } catch (error) {
      console.error("Error creating resume:", error);
      throw new HttpException('Failed to create resume', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async applyRewrites(userId: string, resumeId: string, baseVersionId: string, rewrites: { original: string, rewritten: string }[]) {
    // 0. Ensure the user owns this resume (this throws a 404 if not found)
    await this.findOne(userId, resumeId);

    // 1. Get the base version we are rewriting from
    const baseVersion = await this.prisma.resumeVersion.findUnique({
      where: { id: baseVersionId },
    });

    if (!baseVersion) {
      throw new BadRequestException('Base version not found');
    }

    // 2. Perform string replacements on the raw text
    let newRawText = baseVersion.rawText;

    for (const rewrite of rewrites) {
      // 1. Clean the AI's original string (LLMs often strip leading bullet points like "•" or "-")
      // We strip leading non-alphanumerics so we can match the core text.
      const coreOriginal = rewrite.original.replace(/^[^a-zA-Z0-9]+/, '').trim();

      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedOriginal = escapeRegex(coreOriginal);

      // 2. Replace any whitespace in the AI string with a flexible whitespace matcher (\s+)
      const flexibleRegexPattern = escapedOriginal.replace(/\s+/g, '\\s+');


      // We allow optional bullet points/garbage before the core text in the actual PDF
      const finalRegex = new RegExp(`([^a-zA-Z0-9]*)` + flexibleRegexPattern, 'i');

      const isReplaced = finalRegex.test(newRawText);
      console.log(`Replacing "${coreOriginal.substring(0, 20)}..." -> Success: ${isReplaced}`);

      // 3. Perform the replacement. We preserve the leading garbage (bullet points) ($1) and append the rewritten text.
      if (isReplaced) {
        newRawText = newRawText.replace(finalRegex, `$1${rewrite.rewritten}`);
      }
    }


    // 3. Find the current max version number for this resume
    const maxVersion = await this.prisma.resumeVersion.aggregate({
      where: { resumeId },
      _max: { versionNumber: true }
    });
    const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

    // 4. Create the new version
    try {
      const newVersion = await this.prisma.resumeVersion.create({
        data: {
          resumeId,
          versionNumber: nextVersionNumber,
          rawText: newRawText,
          source: 'ai_rewrite',
        }
      });
      return { version: newVersion };
    } catch (error) {
      console.error("Error applying rewrites:", error);
      throw new HttpException('Failed to create new version', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async analyze(userId: string, id: string, analyzeResumeDto: AnalyzeResumeDto) {
    await this.findOne(userId, id);

    const { versionId, targetRole, targetJobDescription } = analyzeResumeDto
    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, resumeId: id }
    })

    if (!version) {
      throw new BadRequestException("Version not found")
    }

    // Fetch previous version to provide context to the LLM!
    const previousVersion = await this.prisma.resumeVersion.findFirst({
      where: { resumeId: id, versionNumber: version.versionNumber - 1 },
      include: { analysis: true }
    });

    const previousContext = previousVersion?.analysis ? `
      PREVIOUS VERSION CONTEXT:
      This is Version ${version.versionNumber} of the candidate's resume.
      In Version ${previousVersion.versionNumber}, you scored them an Interview Probability of ${previousVersion.analysis.interviewProbability}%.
      The candidate has applied your recommended rewrites. Evaluate the new text. If the rewrites improved the impact metrics or skills, you SHOULD increase their Interview Probability proportionally.
    ` : '';

    const systemPrompt = `
      Act as a brutally strict FAANG Hiring Manager.
      Analyze this resume against the target role: "${targetRole || 'General'}" and job description: "${targetJobDescription || 'General'}".
      
      Your tasks:
      1. Parse the resume into structured JSON.
      2. Provide your recruiter-level feedback:
         - Interview Probability (0-100% chance you would shortlist this candidate). BE BRUTAL. Average resumes should get 10-30%. Good resumes get 40-60%. Only the absolute top 1% of flawless resumes get 80%+.
         - AI Verdict (1 paragraph brutal summary of their fit).
         - Top 3 Recruiter Concerns (why you might reject them).
         - Missing Technical Skills based on the JD.
      3. Identify actionable issues and strengths.
      4. Provide 'rewrites' ONLY for bullets that are genuinely weak or lack metrics. If all bullets are strong, return an empty array []. When you do rewrite, you MUST inject realistic, measurable impact metrics (like %, $, or hours saved) or extract missing technical skills from the JD and weave them in.
         CRITICAL: The 'original' field MUST be the EXACT string verbatim from the raw text. Do NOT fix typos, do not change punctuation, and do not remove bullet points. It must be a literal copy-paste.
    `;

    const userPrompt = `
      Candidate Resume Text:
      ---
      ${version.rawText}
      ---
      ${previousContext}
    `;

    try {
      const result = await this.llmService.analyzeText(systemPrompt, userPrompt)
      // CALCULATE DETERMINISTIC SCORE
      const calculatedAtsScore = this.scoringService.calculateATS(result.parsedData, targetJobDescription || '', result.missingSkills || []);

      const analysisRecord = await this.prisma.analysis.upsert({
        where: { resumeVersionId: versionId },
        create: {
          resumeVersionId: versionId,
          targetRole,
          targetJobDescription,
          atsScore: calculatedAtsScore,
          interviewProbability: result.interviewProbability,
          aiVerdict: result.aiVerdict,
          recruiterConcerns: result.recruiterConcerns,
          missingSkills: result.missingSkills,
          issues: result.issues,
          strengths: result.strengths,
          keywords: result.keywords,
          rewrites: result.rewrites,
          parsedData: result.parsedData
        },
        update: {
          targetRole,
          targetJobDescription,
          atsScore: calculatedAtsScore,
          interviewProbability: result.interviewProbability,
          aiVerdict: result.aiVerdict,
          recruiterConcerns: result.recruiterConcerns,
          missingSkills: result.missingSkills,
          issues: result.issues,
          strengths: result.strengths,
          keywords: result.keywords,
          rewrites: result.rewrites,
          parsedData: result.parsedData
        }
      });


      return { analysis: analysisRecord }
    } catch (error) {
      console.error("Error analyzing resume:", error);
      throw new HttpException('Failed to analyze resume', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAnalysisForVersion(userId: string, versionId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true }
    });

    if (!version || version.resume.userId !== userId) {
      throw new HttpException("Analysis not found", HttpStatus.NOT_FOUND);
    }

    const analysis = await this.prisma.analysis.findUnique({
      where: { resumeVersionId: versionId },
    });
    return { analysis };
  }

  async findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { analysis: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const resume = await this.prisma.resume.findFirst({
      where: { userId, id },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: { analysis: true },
        },
      },
    });
    if (!resume) {
      throw new HttpException("Resume not found", HttpStatus.NOT_FOUND)
    }
    return resume
  }

  async generateLatex(userId: string, resumeId: string, versionId: string) {
    // 1. Fetch the analysis and verify ownership
    const analysis = await this.prisma.analysis.findUnique({
      where: { resumeVersionId: versionId },
      include: { resumeVersion: { include: { resume: true } } }
    });

    if (!analysis || analysis.resumeVersion.resume.userId !== userId) {
      throw new NotFoundException('Analysis not found or unauthorized');
    }

    // 2. Return cached LaTeX if we already generated it
    if (analysis.latexCode) {
      return { latexCode: analysis.latexCode };
    }

    // 3. Generate it using the LLM
    const latexCode = await this.llmService.generateLatex(analysis.parsedData);

    // 4. Clean up any markdown blocks the LLM might have hallucinated
    const cleanedCode = latexCode.replace(/```latex\n/g, '').replace(/```/g, '').trim();

    // 5. Save to database
    await this.prisma.analysis.update({
      where: { resumeVersionId: versionId },
      data: { latexCode: cleanedCode }
    });

    return { latexCode: cleanedCode };
  }

  async downloadPdf(userId: string, resumeId: string, versionId: string, authHeader?: string, cookieHeader?: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { resumeVersionId: versionId }, include: { resumeVersion: { include: { resume: true } } }
    })

    if (!analysis || analysis.resumeVersion.resume.userId !== userId) {
      throw new NotFoundException("Analysis not found or unauthorized")
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage();
      const exportUrl = `http://localhost:3000/export/${resumeId}/${versionId}`; // (Notice I added resumeId here to make the API call easier on the frontend)
      // 🔥 INJECT THE HEADERS: The robot is now wearing the user's wristband!
      const headersToInject: Record<string, string> = {};
      if (authHeader) headersToInject['Authorization'] = authHeader;
      if (cookieHeader) headersToInject['Cookie'] = cookieHeader;

      await page.setExtraHTTPHeaders(headersToInject);
      // Use networkidle2 so it doesn't hang forever waiting for Next.js dev server websockets
      await page.goto(exportUrl, { waitUntil: 'networkidle2' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      })
      return new StreamableFile(Buffer.from(pdfBuffer), {
        type: 'application/pdf',
        disposition: `attachment; filename="Resume_Optimized.pdf"`,
      });
    } catch (error) {
      throw new HttpException("Failed to generate PDF", HttpStatus.INTERNAL_SERVER_ERROR)
    }
    finally {
      browser.close()
    }

  }

}
