import { Logger } from "@nestjs/common";

export const analystResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'analyst_evaluation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                // Structured parsed resume data for ResumeVersion
                parsedData: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        github: { type: 'string' },
                        linkedin: { type: 'string' },
                        skills: { type: 'array', items: { type: 'string' } },
                        education: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    institution: { type: 'string' },
                                    degree: { type: 'string' },
                                    year: { type: 'string' },
                                },
                                required: ['institution', 'degree', 'year'],
                                additionalProperties: false,
                            },
                        },
                        experience: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    company: { type: 'string' },
                                    role: { type: 'string' },
                                    duration: { type: 'string' },
                                    bullets: { type: 'array', items: { type: 'string' } },
                                },
                                required: ['company', 'role', 'duration', 'bullets'],
                                additionalProperties: false,
                            },
                        },
                        projects: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    duration: { type: 'string' },
                                    bullets: { type: 'array', items: { type: 'string' } },
                                },
                                required: ['name', 'duration', 'bullets'],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ['name', 'email', 'phone', 'github', 'linkedin', 'skills', 'education', 'experience', 'projects'],
                    additionalProperties: false,
                },
                // LLM Recruiter Feedback
                resumeHealthScore: { type: 'integer', description: "A score from 0 to 100 representing the qualitative health, impact, and clarity of the resume." },
                scoreBreakdown: {
                    type: 'object',
                    properties: {
                        impact: { type: 'integer' },
                        skills: { type: 'integer' },
                        formatting: { type: 'integer' },
                        clarity: { type: 'integer' }
                    },
                    required: ['impact', 'skills', 'formatting', 'clarity'],
                    additionalProperties: false,
                },
                aiVerdict: { type: 'string', description: "A one-paragraph summary from the perspective of a FAANG hiring manager." },
                recruiterConcerns: {
                    type: 'array',
                    items: { type: 'string' }
                },
                missingSkills: {
                    type: 'array',
                    items: { type: 'string' }
                },
                issues: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            category: { type: 'string' },
                            issue: { type: 'string' },
                            severity: { type: 'string' },
                            fixSuggestion: { type: 'string' },
                        },
                        required: ['category', 'issue', 'severity', 'fixSuggestion'],
                        additionalProperties: false,
                    },
                },
                strengths: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            category: { type: 'string' },
                            strength: { type: 'string' },
                            detail: { type: 'string' },
                        },
                        required: ['category', 'strength', 'detail'],
                        additionalProperties: false,
                    },
                },
                keywords: {
                    type: 'object',
                    properties: {
                        present: { type: 'array', items: { type: 'string' } },
                        missing: { type: 'array', items: { type: 'string' } },
                        matchRate: { type: 'integer' },
                        total: { type: 'integer' },
                    },
                    required: ['present', 'missing', 'matchRate', 'total'],
                    additionalProperties: false,
                },
            },
            required: ['parsedData', 'resumeHealthScore', 'scoreBreakdown', 'aiVerdict', 'recruiterConcerns', 'missingSkills', 'issues', 'strengths', 'keywords'],
            additionalProperties: false,
        },
    },
} as const

export const rewriterResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'rewriter_evaluation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                rewrites: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            section: { type: 'string' },
                            original: { type: 'string' },
                            // CoT Step 1: Grounding in reality
                            existing_skills_found: {
                                type: 'array',
                                items: { type: 'string' },
                                description: "List the technical skills explicitly mentioned in the original bullet. Must be a subset of the candidate's known skills."
                            },
                            // CoT Step 2: Formulating the plan
                            flaw_analysis: { type: 'string', description: "Analyze what is weak about the original bullet and how it can be improved." },
                            // CoT Step 3: Self-verification
                            self_verification: { type: 'string', description: "Verify you are NOT injecting any new technical skills that are not in the candidate's known skills list." },
                            rewritten: { type: 'string' },
                            rationale: { type: 'string' },
                        },
                        // Ensure it outputs in this exact order for CoT
                        required: ['section', 'original', 'existing_skills_found', 'flaw_analysis', 'self_verification', 'rewritten', 'rationale'],
                        additionalProperties: false,
                    }
                }
            },
            required: ['rewrites'],
            additionalProperties: false,
        },
    },
} as const

export const validationResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'skill_validation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                has_new_skills: { type: 'boolean', description: "True if a new technical entity is introduced." },
                reason: { type: 'string', description: "Brief explanation of why it was flagged or passed." },
            },
            required: ['has_new_skills', 'reason'],
            additionalProperties: false,
        },
    },
} as const


export function applyRewritesToText(
    rawText: string,
    rewrites: { original: string, rewritten: string }[],
    logger: Logger
): string {
    let newRawText = rawText;
    let appliedCount = 0;

    for (const rewrite of rewrites) {
        // 1. Strip leading bullets/dashes the LLM might have dropped
        const coreOriginal = rewrite.original.replace(/^[^a-zA-Z0-9]+/, '').trim();

        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 2. Split into pure words and join with flexible non-alphanumeric gaps.
        //    This makes matching immune to the LLM stripping commas or changing spacing.
        const words = coreOriginal.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0).map(escapeRegex);
        if (words.length === 0) continue;

        const corePattern = words.join('[^a-zA-Z0-9]+');

        // 3. Word-boundary anchoring to prevent partial matches:
        //    Prefix: line-start (with optional bullet chars) OR preceded by 1+ non-alphanumeric
        //    Suffix: followed by non-alphanumeric OR end-of-line
        //    Multiline flag so ^ matches after \n in PDF-extracted text
        const finalRegex = new RegExp(
            `(^[^a-zA-Z0-9]*|[^a-zA-Z0-9]+)` + corePattern + `(?=[^a-zA-Z0-9]|$)`,
            'im'
        );

        const match = finalRegex.exec(newRawText);
        if (match) {
            newRawText = newRawText.replace(finalRegex, `$1${rewrite.rewritten}`);
            appliedCount++;
            logger.log(`[Apply] ✓ Matched "${coreOriginal.substring(0, 50)}..." at index ${match.index}`);
        } else {
            logger.warn(`[Apply] ✗ FAILED to match in rawText: "${coreOriginal.substring(0, 60)}..."`);
        }
    }

    logger.log(`[Apply] Applied ${appliedCount}/${rewrites.length} rewrites successfully.`);
    return newRawText;
}
