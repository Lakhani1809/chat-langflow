/**
 * V2 Soft Rules Engine
 * LLM-suggested preferences for scoring, not enforcement
 * These influence ranking but don't block outfits
 */

import type { SoftRule, RulesEngineOutput } from "../types";

// ============================================
// NORMALIZE LLM RULES OUTPUT
// ============================================

/**
 * Convert LLM rules output into normalized SoftRule array
 */
export function mergeSoftRules(llmRulesOutput: RulesEngineOutput): SoftRule[] {
  const softRules: SoftRule[] = [];
  let ruleId = 0;

  // Convert valid_pairs to prefer rules
  for (const pair of llmRulesOutput.valid_pairs || []) {
    softRules.push({
      id: `soft_valid_${ruleId++}`,
      type: "prefer",
      condition: pair,
      explanation: "LLM suggested this pairing works well",
      weight: 0.6,
    });
  }

  // Convert avoid_pairs to avoid rules
  for (const pair of llmRulesOutput.avoid_pairs || []) {
    softRules.push({
      id: `soft_avoid_${ruleId++}`,
      type: "avoid",
      condition: pair,
      explanation: "LLM suggested avoiding this pairing",
      weight: 0.7,
    });
  }

  // Convert core_directions to prefer rules
  for (const direction of llmRulesOutput.core_directions || []) {
    softRules.push({
      id: `soft_direction_${ruleId++}`,
      type: "prefer",
      condition: direction,
      explanation: "Aligns with overall styling direction",
      weight: 0.5,
    });
  }

  // Convert color_rules to rules
  for (const colorRule of llmRulesOutput.color_rules || []) {
    const isAvoid = colorRule.toLowerCase().includes("avoid") || 
                    colorRule.toLowerCase().includes("don't") ||
                    colorRule.toLowerCase().includes("not");
    softRules.push({
      id: `soft_color_${ruleId++}`,
      type: isAvoid ? "avoid" : "prefer",
      condition: colorRule,
      explanation: "Color styling guidance",
      weight: 0.55,
    });
  }

  // Convert silhouette_rules
  for (const silRule of llmRulesOutput.silhouette_rules || []) {
    softRules.push({
      id: `soft_silhouette_${ruleId++}`,
      type: "prefer",
      condition: silRule,
      explanation: "Silhouette guidance",
      weight: 0.45,
    });
  }

  // Convert body_type_rules
  for (const bodyRule of llmRulesOutput.body_type_rules || []) {
    softRules.push({
      id: `soft_body_${ruleId++}`,
      type: "prefer",
      condition: bodyRule,
      explanation: "Body type styling guidance",
      weight: 0.5,
    });
  }

  // Convert gender_style_notes
  for (const genderNote of llmRulesOutput.gender_style_notes || []) {
    softRules.push({
      id: `soft_gender_${ruleId++}`,
      type: "prefer",
      condition: genderNote,
      explanation: "Gender-aware styling",
      weight: 0.4,
    });
  }

  return softRules;
}

// ============================================
// SCORE OUTFIT AGAINST SOFT RULES
// ============================================

/**
 * Score an outfit against soft rules
 * Returns a score from 0-1 (higher is better)
 */
export function scoreOutfitAgainstSoftRules(
  outfitDescription: string,
  softRules: SoftRule[]
): { score: number; matchedRules: string[]; violations: string[] } {
  const outfitLower = outfitDescription.toLowerCase();
  let totalWeight = 0;
  let earnedWeight = 0;
  const matchedRules: string[] = [];
  const violations: string[] = [];

  for (const rule of softRules) {
    totalWeight += rule.weight;
    const conditionLower = rule.condition.toLowerCase();
    
    // Check if condition mentions items/colors/styles in the outfit
    const conditionWords = conditionLower.split(/\s+/).filter(w => w.length > 3);
    const matchScore = conditionWords.filter(w => outfitLower.includes(w)).length / Math.max(conditionWords.length, 1);

    if (matchScore > 0.3) {
      if (rule.type === "prefer") {
        earnedWeight += rule.weight * matchScore;
        matchedRules.push(rule.id);
      } else {
        // "avoid" rule matched - penalize
        earnedWeight -= rule.weight * matchScore * 0.5;
        violations.push(rule.id);
      }
    } else if (rule.type === "prefer") {
      // Prefer rule not matched - slight penalty
      earnedWeight += rule.weight * 0.3; // Neutral score
    } else {
      // Avoid rule not matched - good
      earnedWeight += rule.weight * 0.8;
    }
  }

  const score = totalWeight > 0 ? Math.max(0, Math.min(1, earnedWeight / totalWeight)) : 0.5;

  return { score, matchedRules, violations };
}

// ============================================
// CREATE DEFAULT SOFT RULES
// ============================================

/**
 * Create default soft rules when LLM rules are not available
 */
export function createDefaultSoftRules(): SoftRule[] {
  return [
    {
      id: "default_color_neutral",
      type: "prefer",
      condition: "neutral colors like black, white, grey, navy work with most items",
      explanation: "Safe color choice",
      weight: 0.4,
    },
    {
      id: "default_balance_silhouette",
      type: "prefer",
      condition: "balance fitted items with relaxed items for proportion",
      explanation: "Proportion guidance",
      weight: 0.3,
    },
    {
      id: "default_avoid_clash",
      type: "avoid",
      condition: "clashing bright colors like red and orange together",
      explanation: "Color clash",
      weight: 0.5,
    },
    {
      id: "default_complete_look",
      type: "prefer",
      condition: "complete looks with cohesive aesthetic",
      explanation: "Outfit cohesion",
      weight: 0.4,
    },
  ];
}

// ============================================
// EXTRACT AESTHETIC ALIGNMENT SCORE
// ============================================

/**
 * Score how well an outfit aligns with target aesthetics
 */
export function scoreAestheticAlignment(
  outfitItems: string[],
  targetAesthetics: string[]
): number {
  if (targetAesthetics.length === 0) return 0.5; // Neutral

  const outfitText = outfitItems.join(" ").toLowerCase();
  let matches = 0;

  for (const aesthetic of targetAesthetics) {
    const aestheticLower = aesthetic.toLowerCase();
    
    // Direct match
    if (outfitText.includes(aestheticLower)) {
      matches++;
      continue;
    }

    // Keyword matching
    const aestheticKeywords = getAestheticKeywords(aestheticLower);
    if (aestheticKeywords.some(kw => outfitText.includes(kw))) {
      matches += 0.5;
    }
  }

  return Math.min(1, matches / targetAesthetics.length);
}

/**
 * Get keywords associated with an aesthetic
 */
function getAestheticKeywords(aesthetic: string): string[] {
  const keywordMap: Record<string, string[]> = {
    streetwear: ["hoodie", "sneaker", "cargo", "oversized", "graphic", "jogger"],
    minimal: ["clean", "simple", "neutral", "basic", "understated", "monochrome"],
    preppy: ["polo", "chino", "loafer", "oxford", "button-down", "blazer"],
    ethnic: ["kurta", "saree", "lehenga", "traditional", "embroidered"],
    bohemian: ["flowy", "print", "maxi", "fringe", "earthy", "layered"],
    sporty: ["athletic", "track", "sneaker", "jersey", "performance"],
    elegant: ["silk", "satin", "heel", "refined", "sophisticated", "tailored"],
    edgy: ["leather", "black", "chain", "distressed", "bold", "statement"],
    classic: ["timeless", "tailored", "neutral", "structured", "polished"],
    trendy: ["current", "fashion-forward", "statement", "bold"],
  };

  return keywordMap[aesthetic] || [];
}

