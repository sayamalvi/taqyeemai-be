export interface Rewrite {
    section: string;
    original: string;
    existing_skills_found?: string;
    flaw_analysis?: string;
    verification_check?: string;
    rewritten: string;
    rationale: string;
}

/**
 * Normalizes a string to prevent the LLM from bypassing the guardrail
 * by just adding/removing spaces or bullet points.
 */
function normalize(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        // Strip leading non-alphanumeric characters (like bullets, dashes)
        .replace(/^[^a-z0-9]+/, '')
        // Strip all remaining non-alphanumerics (spaces, punctuation) for a pure match
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Intercepts the AI's output and drops any rewrites that target 
 * bullet points we ALREADY optimized in the previous version.
 */
export function filterDuplicateRewrites(newRewrites: Rewrite[], previousRewrites: Rewrite[]): Rewrite[] {
    if (!previousRewrites || previousRewrites.length === 0) {
        return newRewrites;
    }

    // Hash ALL strings that the AI previously targeted or created
    const previousTargetedNormalized = previousRewrites.flatMap(r => [
        normalize(r.original),
        normalize(r.rewritten)
    ]);

    const filtered = newRewrites.filter(rewrite => {
        const newOriginalNormalized = normalize(rewrite.original);

        // If the AI is trying to target a string it already gave feedback on, it's looping. Drop it.
        const isDuplicate = previousTargetedNormalized.includes(newOriginalNormalized);

        return !isDuplicate;
    });

    return filtered;
}
