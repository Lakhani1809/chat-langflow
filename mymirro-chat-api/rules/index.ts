/**
 * V2 Rules Engine
 * Exports all rule types and evaluators
 */

// Types
export * from "./types";

// Hard Rules (deterministic, code-owned)
export {
  evaluateOutfitHardRules,
  isOutfitComplete,
  getMissingSlots,
  DEFAULT_RULE_CONFIG,
} from "./hardRules";

// Soft Rules (LLM-suggested, for scoring)
export {
  mergeSoftRules,
  scoreOutfitAgainstSoftRules,
  createDefaultSoftRules,
  scoreAestheticAlignment,
} from "./softRules";

// Rule Evaluator (combines hard + soft)
export {
  evaluateOutfit,
  evaluateCandidates,
  evaluateWithRelaxedRules,
  hasViableCandidates,
  getViolationSummary,
  type OutfitEvaluationResult,
  type BatchEvaluationResult,
} from "./ruleEvaluator";

