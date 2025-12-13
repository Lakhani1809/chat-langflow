/**
 * V2 Rule Evaluator
 * Combines hard rules (blocking) and soft rules (scoring)
 * Ranks outfit candidates and filters invalid ones
 */

import type {
  OutfitDraft,
  RuleContext,
  RuleViolation,
  HardRuleResult,
  SoftRule,
  RuleConfig,
  RulesEngineOutput,
} from "../types";
import { evaluateOutfitHardRules, isOutfitComplete, getMissingSlots, DEFAULT_RULE_CONFIG } from "./hardRules";
import { mergeSoftRules, scoreOutfitAgainstSoftRules, createDefaultSoftRules } from "./softRules";

// ============================================
// TYPES
// ============================================

/**
 * Evaluation result for a single outfit
 */
export type OutfitEvaluationResult = {
  outfit: OutfitDraft;
  allowed: boolean;
  hardRuleResult: HardRuleResult;
  softScore: number;
  totalScore: number;
  isComplete: boolean;
  missingSlots: string[];
  matchedSoftRules: string[];
  softViolations: string[];
};

/**
 * Batch evaluation result
 */
export type BatchEvaluationResult = {
  rankedOutfits: OutfitEvaluationResult[];
  passedCount: number;
  blockedCount: number;
  warningCount: number;
  topOutfits: OutfitDraft[];
  needsFallback: boolean;
  fallbackReason?: string;
};

// ============================================
// MAIN EVALUATOR
// ============================================

/**
 * Evaluate a single outfit candidate
 */
export function evaluateOutfit(
  outfit: OutfitDraft,
  context: RuleContext,
  softRules: SoftRule[],
  config: RuleConfig = DEFAULT_RULE_CONFIG
): OutfitEvaluationResult {
  // Run hard rules
  const hardResult = evaluateOutfitHardRules(outfit, context, config);
  
  // Check completeness
  const isComplete = isOutfitComplete(outfit);
  const missingSlots = getMissingSlots(outfit);

  // Calculate soft score
  const outfitDescription = buildOutfitDescription(outfit);
  const softResult = scoreOutfitAgainstSoftRules(outfitDescription, softRules);

  // Calculate total score
  // Hard rules provide a base (1 if passed, 0 if blocked)
  // Soft score modulates within the passed range
  const hardBase = hardResult.allowed ? 1 : 0;
  const penaltyFromHard = hardResult.scorePenalty;
  const totalScore = hardBase * (softResult.score - penaltyFromHard);

  return {
    outfit,
    allowed: hardResult.allowed && isComplete,
    hardRuleResult: hardResult,
    softScore: softResult.score,
    totalScore: Math.max(0, totalScore),
    isComplete,
    missingSlots,
    matchedSoftRules: softResult.matchedRules,
    softViolations: softResult.violations,
  };
}

/**
 * Build a text description of an outfit for soft rule matching
 */
function buildOutfitDescription(outfit: OutfitDraft): string {
  const parts: string[] = [];
  
  if (outfit.slots.upper_wear) {
    parts.push(outfit.slots.upper_wear.hint || "");
    if (outfit.slots.upper_wear.colorFamily) parts.push(outfit.slots.upper_wear.colorFamily);
    if (outfit.slots.upper_wear.silhouette) parts.push(outfit.slots.upper_wear.silhouette);
  }
  
  if (outfit.slots.lower_wear) {
    parts.push(outfit.slots.lower_wear.hint || "");
    if (outfit.slots.lower_wear.colorFamily) parts.push(outfit.slots.lower_wear.colorFamily);
  }
  
  if (outfit.slots.footwear) {
    parts.push(outfit.slots.footwear.hint || "");
  }
  
  if (outfit.slots.layering) {
    parts.push(outfit.slots.layering.hint || "");
  }
  
  if (outfit.slots.accessories) {
    for (const acc of outfit.slots.accessories) {
      parts.push(acc.hint || "");
    }
  }

  if (outfit.vibe) parts.push(outfit.vibe);
  if (outfit.occasion) parts.push(outfit.occasion);

  return parts.filter(p => p).join(" ").toLowerCase();
}

// ============================================
// BATCH EVALUATION
// ============================================

/**
 * Evaluate multiple outfit candidates and return ranked results
 */
export function evaluateCandidates(
  candidates: OutfitDraft[],
  context: RuleContext,
  llmRules: RulesEngineOutput | null,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
  topN: number = 3
): BatchEvaluationResult {
  // Convert LLM rules to soft rules
  const softRules = llmRules 
    ? mergeSoftRules(llmRules) 
    : createDefaultSoftRules();

  // Evaluate all candidates
  const results = candidates.map(outfit => 
    evaluateOutfit(outfit, context, softRules, config)
  );

  // Separate passed and blocked
  const passed = results.filter(r => r.allowed);
  const blocked = results.filter(r => !r.allowed);
  const withWarnings = results.filter(r => 
    r.hardRuleResult.violations.some(v => v.severity === "warn")
  );

  // Sort passed by total score (descending)
  passed.sort((a, b) => b.totalScore - a.totalScore);

  // Determine if we need fallback
  let needsFallback = false;
  let fallbackReason: string | undefined;

  if (passed.length < topN) {
    needsFallback = true;
    if (passed.length === 0) {
      fallbackReason = "All candidates failed hard rules";
    } else {
      fallbackReason = `Only ${passed.length} candidates passed (need ${topN})`;
    }
  }

  // Get top N outfits
  const topOutfits = passed.slice(0, topN).map(r => r.outfit);

  return {
    rankedOutfits: [...passed, ...blocked],
    passedCount: passed.length,
    blockedCount: blocked.length,
    warningCount: withWarnings.length,
    topOutfits,
    needsFallback,
    fallbackReason,
  };
}

// ============================================
// FALLBACK STRATEGIES
// ============================================

/**
 * Relax rules and re-evaluate if too few candidates pass
 */
export function evaluateWithRelaxedRules(
  candidates: OutfitDraft[],
  context: RuleContext,
  llmRules: RulesEngineOutput | null,
  topN: number = 3
): BatchEvaluationResult {
  // First try with normal rules
  const normalResult = evaluateCandidates(candidates, context, llmRules, DEFAULT_RULE_CONFIG, topN);

  if (!normalResult.needsFallback) {
    return normalResult;
  }

  // Try with relaxed rules (turn warnings into passes)
  const relaxedConfig: RuleConfig = {
    ...DEFAULT_RULE_CONFIG,
    strictnessLevel: "relaxed",
    enforceSilhouette: false, // Most common non-critical rule
  };

  const relaxedResult = evaluateCandidates(candidates, context, llmRules, relaxedConfig, topN);

  // If relaxed rules help, use them
  if (relaxedResult.passedCount > normalResult.passedCount) {
    return {
      ...relaxedResult,
      fallbackReason: "Using relaxed rules",
    };
  }

  return normalResult;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Quick check if any candidate is likely to pass
 */
export function hasViableCandidates(candidates: OutfitDraft[]): boolean {
  return candidates.some(c => isOutfitComplete(c));
}

/**
 * Get summary of violations across all candidates
 */
export function getViolationSummary(results: OutfitEvaluationResult[]): {
  byRule: Record<string, number>;
  bySlot: Record<string, number>;
  blocking: string[];
} {
  const byRule: Record<string, number> = {};
  const bySlot: Record<string, number> = {};
  const blocking: string[] = [];

  for (const result of results) {
    for (const violation of result.hardRuleResult.violations) {
      byRule[violation.ruleId] = (byRule[violation.ruleId] || 0) + 1;
      
      for (const slot of violation.slotsInvolved) {
        bySlot[slot] = (bySlot[slot] || 0) + 1;
      }

      if (violation.severity === "block" && !blocking.includes(violation.ruleId)) {
        blocking.push(violation.ruleId);
      }
    }
  }

  return { byRule, bySlot, blocking };
}

// ============================================
// EXPORTS
// ============================================

export { evaluateOutfitHardRules, isOutfitComplete, getMissingSlots } from "./hardRules";
export { mergeSoftRules, scoreOutfitAgainstSoftRules } from "./softRules";

