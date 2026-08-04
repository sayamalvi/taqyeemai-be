import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateResumeDto } from './dto/create-resume.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyzeResumeDto } from './dto/analyze-resume.dto';
import { DocumentService } from 'src/document/document.service';
import { LLMService } from 'src/llm/llm.service';
import { ScoringService } from 'src/scoring/scoring.service';
import { analystResponseFormat, rewriterResponseFormat, applyRewritesToText } from './utils';
import { runProgrammaticGuardrails } from './guardrails';
import { Rewrite, AnalystResponse, RewriterResponse, AnalysisResult } from './types';
import {
  buildAnalystSystemPrompt,
  buildRewriterSystemPrompt,
  buildPreviousContext,
  buildResumeUserPrompt,
  buildRewriterUserPrompt
} from './prompts';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: DocumentService,
    private readonly llmService: LLMService,
    private readonly scoringService: ScoringService
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
    } catch (error: any) {
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
      existingAnalysis.targetRole === targetRole &&
      existingAnalysis.targetJobDescription === targetJobDescription
    ) {
      this.logger.log("Returning existing deterministic analysis.");
      return { analysis: existingAnalysis };
    }

    try {
      // 1. Gather Context
      const { version, previousContext, previousRewrites } = await this.buildContext(versionId, id);

      // 2. Execute AI Loop (Extract-Generate-Validate Pipeline)
      const analysisData = await this.runAgenticLoop(targetRole, targetJobDescription, version.rawText, previousContext, previousRewrites);

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

  private async buildContext(versionId: string, resumeId: string): Promise<{ version: any, previousContext: string, previousRewrites: Rewrite[] }> {
    const version = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, resumeId }
    });

    if (!version) {
      throw new BadRequestException("Version not found");
    }

    // Fetch the immediately previous version for the score context prompt
    const previousVersion = await this.prisma.resumeVersion.findFirst({
      where: { resumeId, versionNumber: version.versionNumber - 1 },
      include: { analysis: true }
    });

    const previousContext = previousVersion?.analysis
      ? buildPreviousContext(version.versionNumber, previousVersion.versionNumber, previousVersion.analysis.resumeHealthScore)
      : '';

    // Accumulate rewrites from ALL prior versions so the duplicate filter
    // catches loops across the entire version history, not just v(N-1)
    const allPriorVersions = await this.prisma.resumeVersion.findMany({
      where: { resumeId, versionNumber: { lt: version.versionNumber } },
      include: { analysis: true }
    });

    const previousRewrites = allPriorVersions.flatMap(
      v => (v.analysis?.rewrites as unknown as Rewrite[]) || []
    );

    this.logger.log(`[Context] Loaded ${previousRewrites.length} accumulated rewrites from ${allPriorVersions.length} prior version(s).`);

    return { version, previousContext, previousRewrites };
  }

  private async runAgenticLoop(targetRole: string, targetJobDescription: string, rawText: string, previousContext: string, previousRewrites: Rewrite[]): Promise<AnalysisResult> {

    // STEP 1: ANALYST (Extract + Evaluate)
    this.logger.log(`[Step 1: Analyst] Parsing and evaluating resume...`);
    const analystSystemPrompt = buildAnalystSystemPrompt(targetRole, targetJobDescription);
    const analystUserPrompt = buildResumeUserPrompt(rawText, previousContext);

    const analystData = await this.llmService.analyzeText(analystSystemPrompt, analystUserPrompt, analystResponseFormat) as AnalystResponse;
    const knownSkills = analystData.parsedData.skills || [];

    let finalRewrites: Rewrite[] = [];

    // STEP 2: REWRITER (Generate)
    if (analystData.issues && analystData.issues.length > 0) {
      this.logger.log(`[Step 2: Rewriter] Generating rewrites grounded in ${knownSkills.length} known skills...`);
      const rewriterSystemPrompt = buildRewriterSystemPrompt();
      const rewriterUserPrompt = buildRewriterUserPrompt(rawText, knownSkills);

      try {
        const rewriterData = await this.llmService.analyzeText(rewriterSystemPrompt, rewriterUserPrompt, rewriterResponseFormat) as RewriterResponse;

        // STEP 3: GUARDRAILS (Validate)
        this.logger.log(`[Step 3: Guardrails] Validating ${rewriterData.rewrites?.length || 0} rewrites...`);
        const guardrailResult = await runProgrammaticGuardrails(rewriterData.rewrites || [], rawText, knownSkills, previousRewrites, this.logger, this.llmService);
        finalRewrites = guardrailResult.validatedRewrites;

      } catch (e: any) {
        this.logger.error(`[Rewriter] Failed to generate rewrites: ${e.message}`, e.stack);
      }
    } else {
      this.logger.log(`[Step 2/3 Skipped] No issues identified by Analyst. Must be a flawless resume.`);
    }

    // STEP 4: HYBRID SCORING
    this.logger.log(`[Step 4: Scoring] Calculating hybrid score...`);
    const deterministicScore = this.scoringService.calculateDeterministicScore(analystData.parsedData, targetJobDescription, analystData.missingSkills);
    const hybridScore = this.scoringService.calculateHybridScore(deterministicScore, analystData.resumeHealthScore);

    this.logger.log(`[Score] Deterministic: ${deterministicScore}, LLM: ${analystData.resumeHealthScore} -> Hybrid: ${hybridScore}`);

    return {
      ...analystData,
      resumeHealthScore: hybridScore,
      rewrites: finalRewrites
    };
  }

  private async saveAnalysis(versionId: string, targetRole: string | undefined, targetJobDescription: string | undefined, analysisData: AnalysisResult) {
    const analysisRecord = await this.prisma.analysis.upsert({
      where: { resumeVersionId: versionId },
      create: {
        resumeVersionId: versionId,
        targetRole,
        targetJobDescription,
        aiVerdict: analysisData.aiVerdict,
        recruiterConcerns: analysisData.recruiterConcerns,
        missingSkills: analysisData.missingSkills,
        issues: analysisData.issues as any,
        strengths: analysisData.strengths as any,
        keywords: analysisData.keywords as any,
        rewrites: analysisData.rewrites as any,
        parsedData: analysisData.parsedData as any,
        resumeHealthScore: analysisData.resumeHealthScore
      },
      update: {
        targetRole,
        targetJobDescription,
        aiVerdict: analysisData.aiVerdict,
        recruiterConcerns: analysisData.recruiterConcerns,
        missingSkills: analysisData.missingSkills,
        issues: analysisData.issues as any,
        strengths: analysisData.strengths as any,
        keywords: analysisData.keywords as any,
        rewrites: analysisData.rewrites as any,
        parsedData: analysisData.parsedData as any,
        resumeHealthScore: analysisData.resumeHealthScore
      }
    });
    return analysisRecord;
  }
}


