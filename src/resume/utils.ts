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
                interviewProbability: { type: 'integer', description: "Estimated percentage chance of landing an interview based on the resume's alignment with the role." },
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
                            rewritten: { type: 'string' },
                            rationale: { type: 'string' },
                        },
                        required: ['section', 'original', 'rewritten', 'rationale'],
                        additionalProperties: false,
                    }
                }
            },
            required: ['parsedData', 'interviewProbability', 'aiVerdict', 'recruiterConcerns', 'missingSkills', 'issues', 'strengths', 'keywords', 'rewrites'],
            additionalProperties: false,
        },
    },
} as const