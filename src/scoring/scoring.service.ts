import { Injectable } from '@nestjs/common';
import { ParsedData } from '../resume/types';

@Injectable()
export class ScoringService {
    calculateDeterministicScore(parsedData: ParsedData, targetJobDescription: string, missingSkills: string[]): number {
        let score = 0;

        // 1. Structure & Sections (Max 20 points)
        if (parsedData.education && parsedData.education.length > 0) score += 10;
        if (parsedData.experience && parsedData.experience.length > 0) score += 10;

        // 2. Impact Metrics (Max 30 points) 
        let totalBullets = 0;
        let bulletsWithMetrics = 0;
        // Improved regex: matches percentages, dollar amounts, multipliers (2x, 5X), 
        // and numbers followed by a noun/verb (e.g. 50 users, 100+ requests) 
        // while avoiding single loose digits.
        const metricRegex = /\d+%|\$\d+|\d+[xX]|\b\d{2,}\b/i;

        if (parsedData.experience) {
            for (const exp of parsedData.experience) {
                exp.bullets?.forEach((bullet: string) => {
                    totalBullets++;
                    if (metricRegex.test(bullet)) bulletsWithMetrics++;
                });
            }
        }

        if (totalBullets > 0) {
            const metricRatio = bulletsWithMetrics / totalBullets;
            score += (metricRatio * 30);
        }

        // 3. Keyword Match against JD (Max 50 points)
        if (targetJobDescription && targetJobDescription !== 'General' && parsedData.skills) {
            const jdLower = targetJobDescription.toLowerCase();
            let matches = 0;
            parsedData.skills.forEach((skill: string) => {
                if (jdLower.includes(skill.toLowerCase())) matches++;
            });

            const totalJDSkills = matches + missingSkills.length;
            if (totalJDSkills > 0) {
                const matchRatio = matches / totalJDSkills;
                score += (matchRatio * 50);
            }
        } else if (parsedData.skills && parsedData.skills.length > 0) {
            // Baseline points if no JD provided but skills exist
            score += 20;
        }

        return Math.round(Math.min(100, Math.max(0, score)));
    }

    calculateHybridScore(deterministicScore: number, llmScore: number): number {
        // 40% weight on deterministic (hard signals)
        // 60% weight on LLM (qualitative signals like impact/clarity)
        const finalScore = (deterministicScore * 0.4) + (llmScore * 0.6);
        return Math.round(Math.min(100, Math.max(0, finalScore)));
    }
}
