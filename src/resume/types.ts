export interface ParsedData {
  basics?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  experience?: Array<{
    company?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: string[];
  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    date?: string;
  }>;
}

export interface ScoreBreakdown {
  impact: number;
  skills: number;
  formatting: number;
  clarity: number;
}

export interface Issue {
  category: 'Impact' | 'Formatting' | 'Clarity' | 'Content';
  issue: string;
  severity: 'High' | 'Medium' | 'Low';
  fixSuggestion: string;
}

export interface Strength {
  category: 'Impact' | 'Formatting' | 'Clarity' | 'Content';
  strength: string;
  detail: string;
}

export interface Keywords {
  present: string[];
  missing: string[];
  matchRate: number;
  total: number;
}

export interface AnalystResponse {
  parsedData: ParsedData;
  resumeHealthScore: number;
  scoreBreakdown: ScoreBreakdown;
  aiVerdict: string;
  recruiterConcerns: string[];
  missingSkills: string[];
  issues: Issue[];
  strengths: Strength[];
  keywords: Keywords;
}

export interface Rewrite {
  section: string;
  original: string;
  existing_skills_found?: string[];
  flaw_analysis?: string;
  self_verification?: string;
  rewritten: string;
  rationale: string;
}

export interface RewriterResponse {
  rewrites: Rewrite[];
}

export interface GuardrailDropLog {
  original: string;
  reason: string;
  check: 'duplicate' | 'fabrication' | 'skill_injection';
}

export interface GuardrailResult {
  validatedRewrites: Rewrite[];
  droppedRewrites: GuardrailDropLog[];
}

export interface AnalysisResult extends Omit<AnalystResponse, 'resumeHealthScore'> {
  resumeHealthScore: number; // Will be the hybrid score
  rewrites: Rewrite[];
}
