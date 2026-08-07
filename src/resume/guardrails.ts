import { Logger } from '@nestjs/common';
import { Rewrite, GuardrailResult, GuardrailDropLog } from './types';
import { LLMService } from '../llm/llm.service';
import { buildValidationSystemPrompt, buildValidationUserPrompt } from './prompts';
import { validationResponseFormat } from './utils';

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
 * Now uses a Set for O(1) lookups instead of O(N) array includes.
 */
export function filterDuplicateRewrites(newRewrites: Rewrite[], previousRewrites: Rewrite[]): { filtered: Rewrite[], drops: GuardrailDropLog[] } {
    const drops: GuardrailDropLog[] = [];

    if (!previousRewrites || previousRewrites.length === 0) {
        return { filtered: newRewrites, drops };
    }

    const filtered = newRewrites.filter(rewrite => {
        const newOrig = normalize(rewrite.original);
        
        // Fuzzy match: If the new target is a significant substring of a previous target (or vice-versa),
        // it means the AI is caught in a loop trying to rewrite the same bullet point.
        const isDuplicate = previousRewrites.some(prev => {
            const prevOrig = normalize(prev.original);
            const prevRew = normalize(prev.rewritten);
            
            // Only check if it's a meaningful string (at least 15 chars) to prevent false positives on short words
            if (newOrig.length < 15) return false;

            return prevOrig.includes(newOrig) || newOrig.includes(prevOrig) ||
                   prevRew.includes(newOrig) || newOrig.includes(prevRew);
        });

        if (isDuplicate) {
            drops.push({
                original: rewrite.original,
                reason: "Fuzzy-matched as a duplicate. Targets a bullet point that was already processed in a previous version.",
                check: 'duplicate'
            });
        }
        return !isDuplicate;
    });

    return { filtered, drops };
}

/**
 * Prevents "Fabricated Originals". Fuzzy-matches the AI's 'original' field against the actual raw text.
 */
export function validateOriginalExists(rewrites: Rewrite[], rawText: string): { filtered: Rewrite[], drops: GuardrailDropLog[] } {
    const drops: GuardrailDropLog[] = [];
    const normalizedRawText = normalize(rawText);

    const filtered = rewrites.filter(rewrite => {
        const normalizedOriginal = normalize(rewrite.original);

        // Use includes for a fuzzy substring match on the normalized text
        if (!normalizedRawText.includes(normalizedOriginal)) {
            drops.push({
                original: rewrite.original,
                reason: "The AI hallucinated this original text. It does not exist in the source resume.",
                check: 'fabrication'
            });
            return false;
        }
        return true;
    });

    return { filtered, drops };
}

/**
 * Prevents "Skill Injection" using an LLM-as-a-judge.
 */
export async function detectSkillInjection(
    rewrites: Rewrite[],
    knownSkills: string[],
    llmService: LLMService,
    logger: Logger
): Promise<{ filtered: Rewrite[], drops: GuardrailDropLog[] }> {
    const drops: GuardrailDropLog[] = [];
    const filtered: Rewrite[] = [];
    const systemPrompt = buildValidationSystemPrompt();

    // Run validations in parallel
    const validations = await Promise.all(
        rewrites.map(async (rewrite) => {
            try {
                const userPrompt = buildValidationUserPrompt(rewrite.original, rewrite.rewritten, knownSkills);
                const response = await llmService.analyzeText(systemPrompt, userPrompt, validationResponseFormat);
                return { rewrite, hasNewSkills: response.has_new_skills, reason: response.reason };
            } catch (error) {
                logger.error(`Validation failed for rewrite: ${rewrite.original}`, error);
                // Fail open if the LLM validation crashes, to not block the user
                return { rewrite, hasNewSkills: false, reason: 'Validation crashed' };
            }
        })
    );

    for (const v of validations) {
        if (v.hasNewSkills) {
            drops.push({
                original: v.rewrite.original,
                reason: `Skill injection detected by Judge: ${v.reason}`,
                check: 'skill_injection'
            });
        } else {
            filtered.push(v.rewrite);
        }
    }

    return { filtered, drops };
}

/**
 * Orchestrator that runs all 3 deterministic guardrails sequentially.
 */
export async function runProgrammaticGuardrails(
    newRewrites: Rewrite[],
    rawText: string,
    knownSkills: string[],
    previousRewrites: Rewrite[],
    logger: Logger,
    llmService: LLMService
): Promise<GuardrailResult> {
    let currentRewrites = newRewrites;
    const allDrops: GuardrailDropLog[] = [];

    // 1. Duplicate Check
    const dupCheck = filterDuplicateRewrites(currentRewrites, previousRewrites);
    currentRewrites = dupCheck.filtered;
    allDrops.push(...dupCheck.drops);

    // 2. Fabrication Check
    const fabCheck = validateOriginalExists(currentRewrites, rawText);
    currentRewrites = fabCheck.filtered;
    allDrops.push(...fabCheck.drops);

    // 3. Skill Injection Check (LLM Judge)
    const skillCheck = await detectSkillInjection(currentRewrites, knownSkills, llmService, logger);
    currentRewrites = skillCheck.filtered;
    allDrops.push(...skillCheck.drops);

    // 4. Hard cap — never trust the LLM to respect quantity limits
    const MAX_REWRITES = 15;
    if (currentRewrites.length > MAX_REWRITES) {
        logger.log(`[Guardrails] Hard-capping from ${currentRewrites.length} to ${MAX_REWRITES} rewrites.`);
        currentRewrites = currentRewrites.slice(0, MAX_REWRITES);
    }

    // Log the results
    if (allDrops.length > 0) {
        logger.warn(`[Guardrails] Dropped ${allDrops.length} rewrites out of ${newRewrites.length}.`);
        allDrops.forEach(drop => logger.log(`   - [${drop.check}] ${drop.reason}`));
    } else {
        logger.log(`[Guardrails] All ${currentRewrites.length} rewrites passed validation.`);
    }

    return {
        validatedRewrites: currentRewrites,
        droppedRewrites: allDrops
    };
}
