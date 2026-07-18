import { Injectable } from '@nestjs/common';

@Injectable()
export class ScoringService {
    calculateATS(parsedData: any, targetJobDescription: string, missingSkills: string[]) {
        let score = 0;

        // 1. Structure & Sections (Max 20 points)
        if (parsedData.education?.length > 0) score += 10;
        if (parsedData.experience?.length > 0) score += 10;

        // 2. Impact Metrics (Max 30 points) 
        let totalBullets = 0;
        let bulletsWithMetrics = 0;
        const metricRegex = /\d+%|\$\d+|\d+x|\d+ /i;

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
        if (targetJobDescription && parsedData.skills) {
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
        } else if (parsedData.skills?.length > 0) {
            score += 20;
        }

        return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
    }
}
