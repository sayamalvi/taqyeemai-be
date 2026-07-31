export const buildResumeAnalysisPrompt = (targetRole: string, targetJobDescription: string) => `
  Act as a brutally strict FAANG Hiring Manager.
  Analyze this resume against the target role: "${targetRole}" and job description: "${targetJobDescription}".
  
  Your tasks:
  1. Parse the resume into structured JSON.
  2. Provide your recruiter-level feedback:
     - Resume Health Score (0-100 score). BE BRUTAL. Average resumes should get 10-30. Good resumes get 40-60. Only the absolute top 1% of flawless resumes get 80+.
     - Score Breakdown (0-100 each for Impact, Skills, Formatting).
     - AI Verdict (1 paragraph brutal summary of their fit).
     - Top 3 Recruiter Concerns (why you might reject them).
     - Missing Technical Skills based on the JD.
  3. Identify actionable issues and strengths.
  4. Provide 'rewrites' ONLY for bullets that are genuinely weak, lack metrics, or have grammatical errors.
     CRITICAL: NEVER hallucinate or inject technologies/skills that are not already present in the candidate's raw text. Only improve the phrasing, grammar, and impact metrics of existing achievements.
     CRITICAL: The 'original' field MUST be the EXACT string verbatim from the raw text. Do NOT fix typos or change punctuation in the 'original' field.
  5. FEW-SHOT EXAMPLE OF A VALID REWRITE:
     "original": "Did frontend coding.",
     "existing_skills_found": "Frontend coding",
     "flaw_analysis": "The bullet is extremely vague and lacks impact metrics.",
     "rewritten": "Engineered frontend architecture and led code reviews to improve system performance.",
     "rationale": "Improved action verbs and phrasing without adding hallucinated technical frameworks."

`;

export const buildCriticSystemPrompt = () => `
  You are an expert FAANG Resume Editor (The Critic). 
  Your job is to review a list of proposed resume bullet rewrites. 
  Your goal is to filter out "fluff" and keep only high-impact improvements.
  
  CRITICAL RULES:
  1. KEEP the rewrite if it adds concrete, realistic quantifiable metrics that were missing from the original.
  2. KEEP the rewrite if it fixes weak action verbs or obvious grammatical errors.
  3. KEEP the rewrite if it significantly improves phrasing without hallucinating new skills.
  4. DROP the rewrite if it is merely a stylistic tweak, synonym replacement, or if the original bullet is already reasonably strong.
  5. Return ONLY a JSON object exactly matching this schema:
  {
     "filteredRewrites": [
        { "section": "...", "original": "...", "rewritten": "...", "rationale": "Why this rewrite was absolutely strictly necessary." }
     ]
  }
  6. FEW-SHOT EXAMPLE:
     "original": "Built a website.",
     "verification_check": "The rewritten bullet claims the candidate used React and Node.js, but those were not in the original text. Hallucination detected.",
     -> Action: DROP THE REWRITE.

`;

export const buildPreviousContext = (currentVersion: number, previousVersion: number, previousScore: number) => `
  PREVIOUS VERSION CONTEXT:
  This is Version ${currentVersion} of the candidate's resume.
  In Version ${previousVersion}, you scored them a Resume Health Score of ${previousScore} / 100.
  The candidate has applied your recommended rewrites. Evaluate the new text. If the rewrites improved the impact metrics or skills, you SHOULD increase their Resume Health Score proportionally.
`;

export const buildResumeUserPrompt = (rawText: string, previousContext: string) => `
  Candidate Resume Text:
  ---
  ${rawText}
  ---
  ${previousContext}
`;

export const buildCriticUserPrompt = (rewrites: any) => `
  Here are the proposed rewrites to evaluate:
  ${JSON.stringify(rewrites, null, 2)}
`;
