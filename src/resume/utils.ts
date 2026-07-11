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
                    },
                    required: ['name', 'email', 'skills', 'education', 'experience'],
                    additionalProperties: false,
                },
                // ATS metrics for Analysis
                atsScore: { type: 'integer' },
                scoreBreakdown: {
                    type: 'object',
                    properties: {
                        keywords: { type: 'integer' },
                        impact: { type: 'integer' },
                        formatting: { type: 'integer' },
                        style: { type: 'integer' },
                    },
                    required: ['keywords', 'impact', 'formatting', 'style'],
                    additionalProperties: false,
                },
                aiVerdict: { type: 'string' },
                issues: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            category: { type: 'string' }, // e.g. "Keywords", "Impact", "Formatting"
                            issue: { type: 'string' },
                            severity: { type: 'string' }, // "Critical", "Moderate", "Low"
                            fixSuggestion: { type: 'string' },
                        },
                        required: ['category', 'issue', 'severity', 'fixSuggestion'],
                        additionalProperties: false,
                    },
                },
            },
            required: ['parsedData', 'atsScore', 'scoreBreakdown', 'aiVerdict', 'issues'],
            additionalProperties: false,
        },
    },
} as const