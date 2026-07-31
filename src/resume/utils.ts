import { Logger } from "@nestjs/common";

export const responseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'resume_evaluation',
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
                resumeHealthScore: { type: 'integer', description: "A score from 0 to 100 representing the overall health, impact, and ATS-readiness of the resume." },
                scoreBreakdown: {
                    type: 'object',
                    properties: {
                        impact: { type: 'integer' },
                        skills: { type: 'integer' },
                        formatting: { type: 'integer' },
                    },
                    required: ['impact', 'skills', 'formatting'],
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
                rewrites: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            section: { type: 'string' },
                            original: { type: 'string' },
                            // CoT Step 1: Grounding in reality
                            existing_skills_found: { type: 'string', description: "List the technical skills explicitly mentioned in the original bullet. If none, write 'None'." },
                            // CoT Step 2: Formulating the plan
                            flaw_analysis: { type: 'string', description: "Analyze what is weak about the original bullet and how it can be improved using ONLY the existing skills." },
                            rewritten: { type: 'string' },
                            rationale: { type: 'string' },
                        },
                        // Ensure it outputs in this exact order
                        required: ['section', 'original', 'existing_skills_found', 'flaw_analysis', 'rewritten', 'rationale'],
                        additionalProperties: false,
                    }
                }
            },
            required: ['parsedData', 'resumeHealthScore', 'scoreBreakdown', 'aiVerdict', 'recruiterConcerns', 'missingSkills', 'issues', 'strengths', 'keywords', 'rewrites'],
            additionalProperties: false,
        },
    },
} as const

export const criticResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'critic_evaluation',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                filteredRewrites: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            section: { type: 'string' },
                            original: { type: 'string' },
                            // ADD IT HERE:
                            verification_check: { type: 'string', description: "Verify that the rewritten bullet does not hallucinate new skills." },
                            rewritten: { type: 'string' },
                            rationale: { type: 'string' },
                        },
                        // AND UPDATE THE REQUIRED ARRAY HERE:
                        required: ['section', 'original', 'verification_check', 'rewritten', 'rationale'],
                        additionalProperties: false,
                    }
                }
            },
            required: ['filteredRewrites'],
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
        logger.log(`Replacing "${coreOriginal.substring(0, 20)}..." -> Success: ${isReplaced}`);

        // 3. Perform the replacement. We preserve the leading garbage (bullet points) ($1) and append the rewritten text.
        if (isReplaced) {
            newRawText = newRawText.replace(finalRegex, `$1${rewrite.rewritten}`);
        }
    }
    return newRawText;
}
