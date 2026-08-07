import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';

export type ActionType = 'UPLOAD' | 'ANALYZE' | 'REWRITE' | 'EXPORT';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    userId: string,
    actionType: ActionType,
    details?: Prisma.InputJsonValue,
    resumeId?: string,
    resumeVersionId?: string,
  ) {
    return this.prisma.activity.create({
      data: {
        userId,
        actionType,
        details,
        resumeId,
        resumeVersionId,
      },
    });
  }

  async getHistory(userId: string) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        resume: { select: { title: true } },
        resumeVersion: { select: { versionNumber: true } },
      },
    });
  }

  async getInsights(userId: string) {
    // 1. Average Health Score trajectory over time
    const analyses = await this.prisma.analysis.findMany({
      where: {
        resumeVersion: {
          resume: { userId },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        resumeHealthScore: true,
        createdAt: true,
        missingSkills: true,
      },
    });

    const scoreTrajectory = analyses.map((a) => ({
      date: a.createdAt,
      score: a.resumeHealthScore,
    }));

    // 2. Top missing skills
    const missingSkillsFreq: Record<string, number> = {};
    for (const a of analyses) {
      const missing = a.missingSkills as string[] | null;
      if (Array.isArray(missing)) {
        for (const skill of missing) {
          missingSkillsFreq[skill] = (missingSkillsFreq[skill] || 0) + 1;
        }
      }
    }
    const topMissingSkills = Object.entries(missingSkillsFreq)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
      
    // 3. Total rewrites applied
    const rewriteCount = await this.prisma.activity.count({
      where: { userId, actionType: 'REWRITE' },
    });

    return {
      scoreTrajectory,
      topMissingSkills,
      totalRewritesApplied: rewriteCount,
    };
  }
}
