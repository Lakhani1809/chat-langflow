/**
 * V2 Confidence Scoring Utility
 * Combines stage confidences and determines behavior
 */

import type {
  ConfidenceScore,
  ConfidenceSummary,
  CONFIDENCE_THRESHOLDS,
  CanonicalMemory,
  WardrobeCoverageProfile,
  MultiIntentResult,
} from "../types";

// ============================================
// CONFIDENCE BEHAVIOR
// ============================================

export type ConfidenceBehavior = 
  | "ask_clarification"   // Low confidence: ask one targeted question
  | "hedge_recommendation" // Medium confidence: provide recommendation but hedge
  | "decisive_recommendation"; // High confidence: be specific and decisive

/**
 * Determine behavior based on final confidence
 */
export function getConfidenceBehavior(confidence: number): ConfidenceBehavior {
  if (confidence < 0.4) return "ask_clarification";
  if (confidence < 0.7) return "hedge_recommendation";
  return "decisive_recommendation";
}

/**
 * Get hedging phrases for medium confidence
 */
export function getHedgingPhrase(): string {
  const phrases = [
    "Based on what I can see...",
    "From your wardrobe, I'd suggest...",
    "Looking at your style...",
    "If I'm reading your vibe right...",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Get decisive phrases for high confidence
 */
export function getDecisivePhrase(): string {
  const phrases = [
    "Here's what I'd go with:",
    "This is the move:",
    "Your best bet:",
    "Go with this:",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

/**
 * Create a confidence score
 */
export function createConfidenceScore(
  score: number,
  basis: string[],
  degradeReason?: string
): ConfidenceScore {
  return {
    score: Math.max(0, Math.min(1, score)),
    basis,
    degrade_reason: degradeReason,
  };
}

/**
 * Calculate intent confidence
 */
export function calculateIntentConfidence(
  intentResult: MultiIntentResult,
  wasKeywordMatch: boolean
): ConfidenceScore {
  let score = intentResult.intent_confidence?.score || 0.5;
  const basis: string[] = [];
  
  if (wasKeywordMatch) {
    score = 0.95; // Very high confidence for keyword matches
    basis.push("keyword_match");
  } else {
    basis.push("llm_classification");
  }
  
  // Secondary intents lower confidence slightly
  if (intentResult.secondary_intents.length > 1) {
    score -= 0.1;
    basis.push("multi_intent");
  }
  
  return createConfidenceScore(score, basis);
}

/**
 * Calculate wardrobe confidence
 */
export function calculateWardrobeConfidence(
  profile: WardrobeCoverageProfile
): ConfidenceScore {
  let score = 0;
  const basis: string[] = [];
  let degradeReason: string | undefined;
  
  // Base score from coverage
  if (profile.canCreateCompleteOutfit) {
    score = 0.6;
    basis.push("complete_outfit_possible");
  } else {
    score = 0.2;
    degradeReason = `Missing: ${profile.missingMandatorySlots.join(", ")}`;
    basis.push("incomplete_coverage");
  }
  
  // Boost for good coverage
  if (profile.tops.level === "high") score += 0.1;
  if (profile.bottoms.level === "high") score += 0.1;
  if (profile.footwear.level === "high") score += 0.1;
  
  // Image availability boost
  const imageRatio = profile.totalWithImages / Math.max(profile.totalItems, 1);
  if (imageRatio > 0.8) {
    score += 0.1;
    basis.push("high_image_coverage");
  } else if (imageRatio < 0.3) {
    score -= 0.1;
    basis.push("low_image_coverage");
  }
  
  return createConfidenceScore(score, basis, degradeReason);
}

/**
 * Calculate analysis confidence
 */
export function calculateAnalysisConfidence(
  hasFIE: boolean,
  hasColorAnalysis: boolean,
  hasSilhouetteAnalysis: boolean,
  hasBodyTypeAnalysis: boolean,
  fromCache: boolean
): ConfidenceScore {
  let score = 0;
  const basis: string[] = [];
  
  if (hasFIE) {
    score += 0.3;
    basis.push("has_fie");
  }
  if (hasColorAnalysis) {
    score += 0.2;
    basis.push("has_color");
  }
  if (hasSilhouetteAnalysis) {
    score += 0.15;
    basis.push("has_silhouette");
  }
  if (hasBodyTypeAnalysis) {
    score += 0.15;
    basis.push("has_body_type");
  }
  
  // Cache is reliable
  if (fromCache) {
    score += 0.1;
    basis.push("from_cache");
  }
  
  return createConfidenceScore(score, basis);
}

/**
 * Calculate rules confidence
 */
export function calculateRulesConfidence(
  hardRulesPassed: boolean,
  violationCount: number,
  warningCount: number
): ConfidenceScore {
  let score = hardRulesPassed ? 0.8 : 0.3;
  const basis: string[] = [];
  
  if (hardRulesPassed) {
    basis.push("hard_rules_passed");
  } else {
    basis.push("hard_rules_failed");
  }
  
  // Warnings lower confidence
  score -= warningCount * 0.1;
  if (warningCount > 0) {
    basis.push(`${warningCount}_warnings`);
  }
  
  return createConfidenceScore(score, basis);
}

// ============================================
// COMBINE CONFIDENCES
// ============================================

/**
 * Combine all stage confidences into final confidence
 */
export function combineConfidences(
  intent: ConfidenceScore,
  memory: ConfidenceScore,
  wardrobe: ConfidenceScore,
  analysis: ConfidenceScore,
  rules: ConfidenceScore
): ConfidenceSummary {
  // Weighted average for final score
  const weights = {
    intent: 0.15,
    memory: 0.2,
    wardrobe: 0.25,
    analysis: 0.2,
    rules: 0.2,
  };
  
  const finalScore = 
    intent.score * weights.intent +
    memory.score * weights.memory +
    wardrobe.score * weights.wardrobe +
    analysis.score * weights.analysis +
    rules.score * weights.rules;
  
  const finalBasis: string[] = [];
  
  // Aggregate basis
  if (intent.score > 0.7) finalBasis.push("clear_intent");
  if (memory.score > 0.7) finalBasis.push("known_preferences");
  if (wardrobe.score > 0.7) finalBasis.push("good_wardrobe");
  if (analysis.score > 0.7) finalBasis.push("complete_analysis");
  if (rules.score > 0.7) finalBasis.push("rules_passed");
  
  // Determine degrade reason
  let degradeReason: string | undefined;
  const lowestScore = Math.min(
    intent.score, memory.score, wardrobe.score, analysis.score, rules.score
  );
  
  if (lowestScore === wardrobe.score && wardrobe.degrade_reason) {
    degradeReason = wardrobe.degrade_reason;
  } else if (lowestScore === memory.score && memory.degrade_reason) {
    degradeReason = memory.degrade_reason;
  } else if (lowestScore === rules.score && rules.degrade_reason) {
    degradeReason = rules.degrade_reason;
  }
  
  return {
    intent,
    memory,
    wardrobe,
    analysis,
    rules,
    final: createConfidenceScore(finalScore, finalBasis, degradeReason),
  };
}

// ============================================
// DEFAULT SCORES
// ============================================

/**
 * Create default/fallback confidence summary
 */
export function createDefaultConfidenceSummary(): ConfidenceSummary {
  const defaultScore = createConfidenceScore(0.5, ["default"]);
  
  return {
    intent: defaultScore,
    memory: defaultScore,
    wardrobe: defaultScore,
    analysis: defaultScore,
    rules: defaultScore,
    final: defaultScore,
  };
}

/**
 * Check if overall confidence is low enough to ask clarification
 */
export function shouldAskClarification(
  summary: ConfidenceSummary,
  userSaidNoQuestions: boolean = false
): boolean {
  if (userSaidNoQuestions) return false;
  return summary.final.score < 0.4;
}

/**
 * Get the weakest confidence area for targeted clarification
 */
export function getWeakestArea(summary: ConfidenceSummary): string {
  const scores = {
    intent: summary.intent.score,
    preferences: summary.memory.score,
    wardrobe: summary.wardrobe.score,
    analysis: summary.analysis.score,
    rules: summary.rules.score,
  };
  
  let weakest = "preferences";
  let lowestScore = 1;
  
  for (const [area, score] of Object.entries(scores)) {
    if (score < lowestScore) {
      lowestScore = score;
      weakest = area;
    }
  }
  
  return weakest;
}

// ============================================
// FORMAT FOR DEBUG
// ============================================

/**
 * Format confidence summary for debug output
 */
export function formatConfidenceSummary(summary: ConfidenceSummary): string {
  const parts: string[] = [];
  
  parts.push(`Intent: ${(summary.intent.score * 100).toFixed(0)}%`);
  parts.push(`Memory: ${(summary.memory.score * 100).toFixed(0)}%`);
  parts.push(`Wardrobe: ${(summary.wardrobe.score * 100).toFixed(0)}%`);
  parts.push(`Analysis: ${(summary.analysis.score * 100).toFixed(0)}%`);
  parts.push(`Rules: ${(summary.rules.score * 100).toFixed(0)}%`);
  parts.push(`---`);
  parts.push(`Final: ${(summary.final.score * 100).toFixed(0)}%`);
  parts.push(`Behavior: ${getConfidenceBehavior(summary.final.score)}`);
  
  if (summary.final.degrade_reason) {
    parts.push(`Degrade: ${summary.final.degrade_reason}`);
  }
  
  return parts.join("\n");
}

