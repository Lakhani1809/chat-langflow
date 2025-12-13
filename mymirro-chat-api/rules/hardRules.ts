/**
 * V2 Hard Rules Engine
 * Deterministic, code-owned constraints that MUST be enforced
 * LLM cannot override these - they are the law
 */

import type {
  OutfitDraft,
  RuleContext,
  RuleViolation,
  HardRuleResult,
  RuleConfig,
  OutfitSlot,
  MANDATORY_SLOTS,
} from "../types";
import { 
  classifyItem, 
  areFormalitiesCompatible, 
  isFootwearTooCasual,
  isEthnicCoherenceViolated,
  type ClassifiedItem,
  type FormalityLevel,
} from "./types";

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  enforceFormality: true,
  enforceSilhouette: true,
  enforceEthnicCoherence: true,
  enforceClimateSanity: true,
  strictnessLevel: "normal",
};

// ============================================
// MAIN EVALUATION FUNCTION
// ============================================

/**
 * Evaluate an outfit draft against all hard rules
 * Returns whether the outfit is allowed and any violations
 */
export function evaluateOutfitHardRules(
  outfit: OutfitDraft,
  context: RuleContext,
  config: RuleConfig = DEFAULT_RULE_CONFIG
): HardRuleResult {
  const violations: RuleViolation[] = [];
  let scorePenalty = 0;

  // Rule 1: Mandatory slots check
  const mandatoryResult = checkMandatorySlots(outfit, context);
  if (mandatoryResult) {
    violations.push(mandatoryResult);
  }

  // Rule 2: Formality coherence
  if (config.enforceFormality) {
    const formalityResult = checkFormalityCoherence(outfit, context);
    violations.push(...formalityResult.violations);
    scorePenalty += formalityResult.penalty;
  }

  // Rule 3: Silhouette compatibility
  if (config.enforceSilhouette) {
    const silhouetteResult = checkSilhouetteCompatibility(outfit, context, config);
    violations.push(...silhouetteResult.violations);
    scorePenalty += silhouetteResult.penalty;
  }

  // Rule 4: Ethnic coherence
  if (config.enforceEthnicCoherence) {
    const ethnicResult = checkEthnicCoherence(outfit);
    if (ethnicResult) {
      violations.push(ethnicResult);
    }
  }

  // Rule 5: Climate/season sanity
  if (config.enforceClimateSanity && context.climate) {
    const climateResult = checkClimateSanity(outfit, context);
    violations.push(...climateResult.violations);
    scorePenalty += climateResult.penalty;
  }

  // Rule 6: Duplicate slot conflicts
  const duplicateResult = checkDuplicateSlots(outfit);
  if (duplicateResult) {
    violations.push(duplicateResult);
  }

  // Rule 7: Wardrobe availability (if visual_outfit mode)
  if (context.responseMode === "visual_outfit" && context.hasWardrobeItems) {
    const availabilityResult = checkWardrobeAvailability(outfit);
    violations.push(...availabilityResult);
  }

  // Determine if outfit is allowed
  const hasBlockingViolation = violations.some(v => v.severity === "block");
  
  return {
    allowed: !hasBlockingViolation,
    violations,
    scorePenalty,
  };
}

// ============================================
// RULE 1: MANDATORY SLOTS
// ============================================

/**
 * Check that all mandatory slots are filled
 * upper_wear + lower_wear + footwear required
 */
function checkMandatorySlots(
  outfit: OutfitDraft,
  context: RuleContext
): RuleViolation | null {
  const missing: OutfitSlot[] = [];
  
  // Check for dress/one-piece (which replaces upper+lower)
  const hasDressOrOnePiece = outfit.slots.upper_wear?.category === "dresses" ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("dress") ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("jumpsuit");

  if (hasDressOrOnePiece) {
    // Only footwear is mandatory for dress/one-piece
    if (!outfit.slots.footwear) {
      missing.push("footwear");
    }
  } else {
    // Standard outfit: check all mandatory slots
    if (!outfit.slots.upper_wear) missing.push("upper_wear");
    if (!outfit.slots.lower_wear) missing.push("lower_wear");
    if (!outfit.slots.footwear) missing.push("footwear");
  }

  if (missing.length > 0) {
    return {
      ruleId: "mandatory_slots",
      severity: "block",
      message: `Incomplete outfit: missing ${missing.join(", ")}`,
      slotsInvolved: missing,
      evidence: `Outfit must have ${hasDressOrOnePiece ? "footwear with dress/one-piece" : "upper_wear, lower_wear, and footwear"}`,
    };
  }

  return null;
}

// ============================================
// RULE 2: FORMALITY COHERENCE
// ============================================

/**
 * Check formality coherence across outfit items
 */
function checkFormalityCoherence(
  outfit: OutfitDraft,
  context: RuleContext
): { violations: RuleViolation[]; penalty: number } {
  const violations: RuleViolation[] = [];
  let penalty = 0;

  // Get formality levels from slots
  const upperFormality = outfit.slots.upper_wear?.formality;
  const lowerFormality = outfit.slots.lower_wear?.formality;
  const footwearSubcategory = outfit.slots.footwear?.subcategory || "";
  const footwearFormality = outfit.slots.footwear?.formality;

  // Check formal upper with very casual footwear
  if (upperFormality === "formal" || upperFormality === "smart") {
    if (isFootwearTooInformal(footwearSubcategory)) {
      violations.push({
        ruleId: "formality_mismatch_footwear",
        severity: "block",
        message: "Formal/smart top with flip-flops or slides is not allowed",
        slotsInvolved: ["upper_wear", "footwear"],
        evidence: `Upper: ${upperFormality}, Footwear: ${footwearSubcategory}`,
      });
    }
  }

  // Check if outfit is for a formal occasion but has casual items
  if (context.formality === "formal") {
    // Sports shorts with formal occasion
    if (isSportsOrCasualBottoms(outfit.slots.lower_wear?.subcategory)) {
      violations.push({
        ruleId: "formality_occasion_mismatch",
        severity: "block",
        message: "Sports/casual shorts not appropriate for formal occasion",
        slotsInvolved: ["lower_wear"],
        evidence: `Occasion requires formal, bottoms are casual/sports`,
      });
    }
  }

  // Check general formality compatibility (warn only)
  if (upperFormality && footwearFormality) {
    if (!areFormalitiesCompatible(upperFormality as FormalityLevel, footwearFormality as FormalityLevel)) {
      violations.push({
        ruleId: "formality_general_mismatch",
        severity: "warn",
        message: "Formality levels don't match well",
        slotsInvolved: ["upper_wear", "footwear"],
        evidence: `Upper: ${upperFormality}, Footwear: ${footwearFormality}`,
      });
      penalty += 0.2;
    }
  }

  return { violations, penalty };
}

function isFootwearTooInformal(subcategory: string): boolean {
  const tooInformal = ["flip-flops", "slides", "sandals"];
  return tooInformal.includes(subcategory.toLowerCase());
}

function isSportsOrCasualBottoms(subcategory?: string): boolean {
  if (!subcategory) return false;
  const sportsBottoms = ["gym-shorts", "track-pants", "sports-shorts", "athletic-shorts"];
  return sportsBottoms.includes(subcategory.toLowerCase());
}

// ============================================
// RULE 3: SILHOUETTE COMPATIBILITY
// ============================================

/**
 * Check silhouette compatibility
 */
function checkSilhouetteCompatibility(
  outfit: OutfitDraft,
  context: RuleContext,
  config: RuleConfig
): { violations: RuleViolation[]; penalty: number } {
  const violations: RuleViolation[] = [];
  let penalty = 0;

  const upperSilhouette = outfit.slots.upper_wear?.silhouette;
  const lowerSilhouette = outfit.slots.lower_wear?.silhouette;

  // Longline/kurta upper with very baggy cargo
  if (upperSilhouette === "longline" || upperSilhouette === "oversized") {
    if (lowerSilhouette === "oversized" || lowerSilhouette === "relaxed") {
      const severity = config.strictnessLevel === "strict" ? "block" : "warn";
      violations.push({
        ruleId: "silhouette_mismatch",
        severity,
        message: "Oversized/longline top with very relaxed bottoms may look unbalanced",
        slotsInvolved: ["upper_wear", "lower_wear"],
        evidence: `Upper: ${upperSilhouette}, Lower: ${lowerSilhouette}`,
      });
      penalty += severity === "block" ? 0.5 : 0.15;
    }
  }

  return { violations, penalty };
}

// ============================================
// RULE 4: ETHNIC COHERENCE
// ============================================

/**
 * Check ethnic wear coherence
 */
function checkEthnicCoherence(outfit: OutfitDraft): RuleViolation | null {
  const upperHint = outfit.slots.upper_wear?.hint?.toLowerCase() || "";
  const upperCategory = outfit.slots.upper_wear?.category?.toLowerCase() || "";
  const lowerHint = outfit.slots.lower_wear?.hint?.toLowerCase() || "";
  const lowerCategory = outfit.slots.lower_wear?.subcategory?.toLowerCase() || "";

  const isEthnicUpper = upperCategory === "ethnic" || 
    upperHint.includes("kurta") || 
    upperHint.includes("sherwani");

  const isSportsLower = lowerCategory.includes("gym") || 
    lowerCategory.includes("sport") ||
    lowerHint.includes("gym short") ||
    lowerHint.includes("track pant");

  if (isEthnicUpper && isSportsLower) {
    return {
      ruleId: "ethnic_coherence",
      severity: "block",
      message: "Ethnic wear (kurta, sherwani) cannot be paired with gym/sports bottoms",
      slotsInvolved: ["upper_wear", "lower_wear"],
      evidence: `Upper: ethnic, Lower: sports/gym`,
    };
  }

  return null;
}

// ============================================
// RULE 5: CLIMATE/SEASON SANITY
// ============================================

/**
 * Check climate/season appropriateness
 */
function checkClimateSanity(
  outfit: OutfitDraft,
  context: RuleContext
): { violations: RuleViolation[]; penalty: number } {
  const violations: RuleViolation[] = [];
  let penalty = 0;

  const layering = outfit.slots.layering;
  const layeringHint = layering?.hint?.toLowerCase() || "";
  const layeringSeason = layering?.season;

  // Heavy puffer in hot climate
  if (context.climate === "hot") {
    if (layeringHint.includes("puffer") || 
        layeringHint.includes("heavy coat") ||
        layeringHint.includes("wool coat") ||
        layeringSeason === "cold") {
      violations.push({
        ruleId: "climate_heavy_layering",
        severity: "warn",
        message: "Heavy layering not recommended for hot climate",
        slotsInvolved: ["layering"],
        evidence: `Climate: hot, Layering: ${layeringHint}`,
      });
      penalty += 0.25;
    }
  }

  // Light clothing in cold climate (optional, just warning)
  if (context.climate === "cold") {
    const upperSeason = outfit.slots.upper_wear?.season;
    if (upperSeason === "hot" && !layering) {
      violations.push({
        ruleId: "climate_too_light",
        severity: "warn",
        message: "Consider adding layering for cold weather",
        slotsInvolved: ["upper_wear", "layering"],
        evidence: `Climate: cold, Upper: summer item, No layering`,
      });
      penalty += 0.1;
    }
  }

  return { violations, penalty };
}

// ============================================
// RULE 6: DUPLICATE SLOTS
// ============================================

/**
 * Check for duplicate items in slots
 */
function checkDuplicateSlots(outfit: OutfitDraft): RuleViolation | null {
  // This is more about data integrity - checking if same item ID appears twice
  const itemIds: (string | number)[] = [];
  const slots = outfit.slots;

  if (slots.upper_wear?.itemId) itemIds.push(slots.upper_wear.itemId);
  if (slots.lower_wear?.itemId) itemIds.push(slots.lower_wear.itemId);
  if (slots.footwear?.itemId) itemIds.push(slots.footwear.itemId);
  if (slots.layering?.itemId) itemIds.push(slots.layering.itemId);
  if (slots.accessories) {
    for (const acc of slots.accessories) {
      if (acc.itemId) itemIds.push(acc.itemId);
    }
  }

  const uniqueIds = new Set(itemIds);
  if (uniqueIds.size < itemIds.length) {
    return {
      ruleId: "duplicate_items",
      severity: "block",
      message: "Same item appears multiple times in outfit",
      slotsInvolved: ["upper_wear", "lower_wear", "footwear"],
      evidence: `${itemIds.length} items, ${uniqueIds.size} unique`,
    };
  }

  return null;
}

// ============================================
// RULE 7: WARDROBE AVAILABILITY
// ============================================

/**
 * Check if all items with IDs exist in wardrobe
 * (This is a basic check - actual validation happens later in safety filter)
 */
function checkWardrobeAvailability(outfit: OutfitDraft): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const slots = outfit.slots;

  // Check mandatory slots have item hints at minimum
  if (slots.upper_wear && !slots.upper_wear.hint && !slots.upper_wear.itemId) {
    violations.push({
      ruleId: "wardrobe_upper_missing",
      severity: "warn",
      message: "Upper wear has no wardrobe reference",
      slotsInvolved: ["upper_wear"],
    });
  }

  if (slots.lower_wear && !slots.lower_wear.hint && !slots.lower_wear.itemId) {
    violations.push({
      ruleId: "wardrobe_lower_missing",
      severity: "warn",
      message: "Lower wear has no wardrobe reference",
      slotsInvolved: ["lower_wear"],
    });
  }

  if (slots.footwear && !slots.footwear.hint && !slots.footwear.itemId) {
    violations.push({
      ruleId: "wardrobe_footwear_missing",
      severity: "warn",
      message: "Footwear has no wardrobe reference",
      slotsInvolved: ["footwear"],
    });
  }

  return violations;
}

// ============================================
// HELPER: VALIDATE OUTFIT COMPLETENESS
// ============================================

/**
 * Quick check if an outfit is complete (has mandatory slots)
 */
export function isOutfitComplete(outfit: OutfitDraft): boolean {
  const hasDressOrOnePiece = outfit.slots.upper_wear?.category === "dresses" ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("dress") ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("jumpsuit");

  if (hasDressOrOnePiece) {
    return !!outfit.slots.footwear;
  }

  return !!(
    outfit.slots.upper_wear &&
    outfit.slots.lower_wear &&
    outfit.slots.footwear
  );
}

/**
 * Get missing slots for an outfit
 */
export function getMissingSlots(outfit: OutfitDraft): OutfitSlot[] {
  const missing: OutfitSlot[] = [];
  
  const hasDressOrOnePiece = outfit.slots.upper_wear?.category === "dresses" ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("dress") ||
    outfit.slots.upper_wear?.hint?.toLowerCase().includes("jumpsuit");

  if (hasDressOrOnePiece) {
    if (!outfit.slots.footwear) missing.push("footwear");
  } else {
    if (!outfit.slots.upper_wear) missing.push("upper_wear");
    if (!outfit.slots.lower_wear) missing.push("lower_wear");
    if (!outfit.slots.footwear) missing.push("footwear");
  }

  return missing;
}

