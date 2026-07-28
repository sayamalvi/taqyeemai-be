import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyzeResumeDto } from './dto/analyze-resume.dto';
import { DocumentService } from 'src/document/document.service';
import { LLMService } from 'src/llm/llm.service';
import { responseFormat, criticResponseFormat, applyRewritesToText } from './utils';
import { filterDuplicateRewrites } from './guardrails';
import {
  buildCriticSystemPrompt,
  buildCriticUserPrompt,
  buildPreviousContext,
  buildResumeAnalysisPrompt,
  buildResumeUserPrompt
} from './prompts';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: DocumentService,
    private readonly llmService: LLMService
  ) { }

  async create(userId: string, resume: Express.Multer.File, createResumeDto: CreateResumeDto) {
    if (!resume) {
      throw new BadRequestException('Resume is required')
    }

    if (resume.mimetype !== 'application/pdf') {
      throw new BadRequestException("Only pdf allowed")
    }

    const { title } = createResumeDto
    const rawText = await this.documentService.extractTextFromPDF(resume.buffer)

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
      this.logger.error("Error creating resume", error.stack);
      throw new InternalServerErrorException('Failed to create resume');
    }
  }

  async applyRewrites(userId: string, resumeId: string, baseVersionId: string, rewrites: { original: string, rewritten: string }[]) {
    await this.findOne(userId, resumeId);

    // 1. Get the base version we are rewriting from
    const baseVersion = await this.prisma.resumeVersion.findUnique({
      where: { id: baseVersionId },
    });

    if (!baseVersion) {
      throw new BadRequestException('Base version not found');
    }

    // 2. Perform string replacements on the raw text
    const newRawText = applyRewritesToText(baseVersion.rawText, rewrites, this.logger);
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
    } catch (error: any) {
      this.logger.error("Error applying rewrites", error.stack);
      throw new InternalServerErrorException('Failed to create new version');
    }
  }

  async analyze(userId: string, id: string, analyzeResumeDto: AnalyzeResumeDto) {
    await this.findOne(userId, id);
    const { versionId, targetRole, targetJobDescription } = analyzeResumeDto;

    const existingAnalysis = await this.prisma.analysis.findUnique({
      where: { resumeVersionId: versionId }
    });

    if (
      existingAnalysis &&
      existingAnalysis.targetRole === (targetRole || 'General') &&
      existingAnalysis.targetJobDescription === (targetJobDescription || 'General')
    ) {
      this.logger.log("Returning existing deterministic analysis.");
      return { analysis: existingAnalysis };
    }

    try {
      // 1. Gather Context
      const { version, previousContext, previousRewrites } = await this.buildContext(versionId, id);

      // 2. Execute AI Loop
      const analysisData = await this.runAgenticLoop(targetRole || 'General', targetJobDescription || 'General', version.rawText, previousContext, previousRewrites);

      // 3. Save to Database
      const analysisRecord = await this.saveAnalysis(versionId, targetRole, targetJobDescription, analysisData);

      return { analysis: analysisRecord };
    } catch (error: any) {
      this.logger.error("Error analyzing resume", error.stack);
      throw new InternalServerErrorException('Failed to analyze resume');
    }
  }

  async getAnalysisForVersion(userId: string, versionId: string) {
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: versionId },
      include: { resume: true }
    });

    if (!version || version.resume.userId !== userId) {
      throw new NotFoundException("Analysis not found");
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
      throw new NotFoundException("Resume not found");
    }
    return resume
  }
  // --- PRIVATE HELPER METHODS FOR ANALYSIS ---

  private async buildContext(versionId: string, resumeId: string) {
    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, resumeId }
    });

    if (!version) {
      throw new BadRequestException("Version not found");
    }

    const previousVersion = await this.prisma.resumeVersion.findFirst({
      where: { resumeId, versionNumber: version.versionNumber - 1 },
      include: { analysis: true }
    });

    const previousContext = previousVersion?.analysis
      ? buildPreviousContext(version.versionNumber, previousVersion.versionNumber, previousVersion.analysis.resumeHealthScore)
      : '';

    const previousRewrites = previousVersion?.analysis?.rewrites as any[] || [];

    return { version, previousContext, previousRewrites };
  }

  private async runAgenticLoop(targetRole: string, targetJobDescription: string, rawText: string, previousContext: string, previousRewrites: any[]) {
    const systemPrompt = buildResumeAnalysisPrompt(targetRole || 'General', targetJobDescription || 'General');
    const userPrompt = buildResumeUserPrompt(rawText, previousContext);

    // 1. Actor Phase
    const analysisData = await this.llmService.analyzeText(systemPrompt, userPrompt, responseFormat);

    // 2. Guardrail Phase
    if (analysisData.rewrites && analysisData.rewrites.length > 0) {
      const originalCount = analysisData.rewrites.length;
      analysisData.rewrites = filterDuplicateRewrites(analysisData.rewrites as any, previousRewrites);
      this.logger.log(`[Guardrail] Blocked ${originalCount - analysisData.rewrites.length} duplicate rewrites.`);

      // 3. Critic Phase
      if (analysisData.rewrites.length > 0) {
        const criticSystemPrompt = buildCriticSystemPrompt();
        const criticUserPrompt = buildCriticUserPrompt(analysisData.rewrites);

        try {
          this.logger.log(`[Actor] Generated ${analysisData.rewrites.length} rewrites. Passing to Critic...`);
          const criticResponse = await this.llmService.analyzeText(criticSystemPrompt, criticUserPrompt, criticResponseFormat);
          const filteredCount = criticResponse.filteredRewrites?.length || 0;
          this.logger.log(`[Critic] Kept ${filteredCount} out of ${analysisData.rewrites.length} rewrites.`);

          analysisData.rewrites = criticResponse.filteredRewrites || [];
        } catch (e) {
          this.logger.error("[Critic] Failed to evaluate rewrites, falling back to original.", e);
        }
      }
    } else {
      this.logger.log("[Actor] Generated 0 rewrites. The resume must be flawless (or the prompt is too strict).");
    }

    return analysisData;
  }

  private async saveAnalysis(versionId: string, targetRole: string | undefined, targetJobDescription: string | undefined, analysisData: any) {
    const analysisRecord = await this.prisma.analysis.upsert({
      where: { resumeVersionId: versionId },
      create: {
        resumeVersionId: versionId,
        targetRole,
        targetJobDescription,
        aiVerdict: analysisData.aiVerdict,
        recruiterConcerns: analysisData.recruiterConcerns,
        missingSkills: analysisData.missingSkills,
        issues: analysisData.issues,
        strengths: analysisData.strengths,
        keywords: analysisData.keywords,
        rewrites: analysisData.rewrites,
        parsedData: analysisData.parsedData,
        resumeHealthScore: analysisData.resumeHealthScore
      },
      update: {
        targetRole,
        targetJobDescription,
        aiVerdict: analysisData.aiVerdict,
        recruiterConcerns: analysisData.recruiterConcerns,
        missingSkills: analysisData.missingSkills,
        issues: analysisData.issues,
        strengths: analysisData.strengths,
        keywords: analysisData.keywords,
        rewrites: analysisData.rewrites,
        parsedData: analysisData.parsedData,
        resumeHealthScore: analysisData.resumeHealthScore
      }
    });
    return analysisRecord;
  }
}


