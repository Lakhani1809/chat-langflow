/**
 * Stylist Decision Layer
 * 
 * Forces a single clear direction per response.
 * Separates analysis from decision.
 * Never returns neutral outcomes.
 * 
 * Rules:
 * - Shopping questions → MUST choose one option
 * - Outfit generation → MUST return outfit_set
 * - Confidence never blocks a decision
 * - If options.length === 2 → pick one deterministically
 * - No clarifying questions from this layer
 */

import type {
  IntentType,
  CanonicalMemory,
  WardrobeCoverageProfile,
  ConfidenceSummary,
} from "../types";

// ============================================
// TYPES
// ============================================

export type StylistDecisionType = "choose_one" | "outfit_set" | "no_outfit";

export type StylistDecision = {
  /** Type of decision made */
  decisionType: StylistDecisionType;
  /** The chosen option (for choose_one) */
  chosenOption?: string;
  /** The rejected option (for choose_one) */
  rejectedOption?: string;
  /** Brief rationale for the decision */
  rationale: string;
  /** If true, confidence was low but we still decided */
  forceDecisive: boolean;
  /** Stylist mode: opinionated or informative */
  stylistMode: "stylist" | "advisor";
};

export interface StylistDecisionInput {
  intent: IntentType;
  /** Options to choose from (e.g., ["hoodie", "jacket"]) */
  options?: string[];
  /** User's canonical preferences */
  canonicalMemory?: CanonicalMemory;
  /** Wardrobe coverage profile */
  wardrobeCoverage?: WardrobeCoverageProfile;
  /** Confidence summary from analysis */
  confidence?: ConfidenceSummary;
  /** Output contract from execution map */
  outputContract?: "outfits_required" | "outfits_optional" | "no_outfits";
  /** User message for context */
  userMessage?: string;
}

// ============================================
// DECISION RULES
// ============================================

/**
 * Intents that require decisive stylist behavior
 */
const STYLIST_INTENTS: IntentType[] = [
  "outfit_generation",
  "event_styling",
  "shopping_help",
  "item_recommendation",
  "category_recommendation",
  "travel_packing",
];

/**
 * Intents that are advisory/informative
 */
const ADVISOR_INTENTS: IntentType[] = [
  "color_analysis",
  "body_type_advice",
  "trend_analysis",
  "wardrobe_query",
  "general_chat",
];

/**
 * Deterministic option selection based on user preferences
 */
function pickBestOption(
  options: string[],
  canonicalMemory?: CanonicalMemory,
  userMessage?: string
): { chosen: string; rejected: string; reason: string } {
  if (options.length === 0) {
    return { chosen: "", rejected: "", reason: "No options provided" };
  }

  if (options.length === 1) {
    return { chosen: options[0], rejected: "", reason: "Only one option available" };
  }

  const [optionA, optionB] = options;
  const optionALower = optionA.toLowerCase();
  const optionBLower = optionB.toLowerCase();
  const messageLower = (userMessage || "").toLowerCase();

  // Rule 1: Check if user explicitly mentioned preference in message
  if (messageLower.includes(optionALower) && !messageLower.includes(optionBLower)) {
    return { chosen: optionA, rejected: optionB, reason: "User mentioned this specifically" };
  }
  if (messageLower.includes(optionBLower) && !messageLower.includes(optionALower)) {
    return { chosen: optionB, rejected: optionA, reason: "User mentioned this specifically" };
  }

  // Rule 2: Check canonical memory preferences
  if (canonicalMemory) {
    const vibes = canonicalMemory.vibes || [];
    const formality = canonicalMemory.formality_preference?.value;

    // Casual vibes favor relaxed items
    const casualKeywords = ["hoodie", "tee", "sneakers", "jeans", "joggers"];
    const formalKeywords = ["blazer", "dress shoes", "trousers", "shirt", "coat"];

    const aIsCasual = casualKeywords.some(k => optionALower.includes(k));
    const bIsCasual = casualKeywords.some(k => optionBLower.includes(k));
    const aIsFormal = formalKeywords.some(k => optionALower.includes(k));
    const bIsFormal = formalKeywords.some(k => optionBLower.includes(k));

    if (formality === "casual" || vibes.some(v => v.includes("casual") || v.includes("relaxed"))) {
      if (aIsCasual && !bIsCasual) {
        return { chosen: optionA, rejected: optionB, reason: "Better fits your casual vibe" };
      }
      if (bIsCasual && !aIsCasual) {
        return { chosen: optionB, rejected: optionA, reason: "Better fits your casual vibe" };
      }
    }

    if (formality === "formal" || formality === "smart" || vibes.some(v => v.includes("formal") || v.includes("smart"))) {
      if (aIsFormal && !bIsFormal) {
        return { chosen: optionA, rejected: optionB, reason: "Better fits your polished vibe" };
      }
      if (bIsFormal && !aIsFormal) {
        return { chosen: optionB, rejected: optionA, reason: "Better fits your polished vibe" };
      }
    }

    // Check color preferences
    const colorLikes = canonicalMemory.color_likes || [];
    const colorAvoids = canonicalMemory.color_avoids || [];

    for (const color of colorAvoids) {
      if (optionALower.includes(color.toLowerCase()) && !optionBLower.includes(color.toLowerCase())) {
        return { chosen: optionB, rejected: optionA, reason: `Avoiding ${color} as per your preference` };
      }
      if (optionBLower.includes(color.toLowerCase()) && !optionALower.includes(color.toLowerCase())) {
        return { chosen: optionA, rejected: optionB, reason: `Avoiding ${color} as per your preference` };
      }
    }

    for (const color of colorLikes) {
      if (optionALower.includes(color.toLowerCase()) && !optionBLower.includes(color.toLowerCase())) {
        return { chosen: optionA, rejected: optionB, reason: `Matches your color preference` };
      }
      if (optionBLower.includes(color.toLowerCase()) && !optionALower.includes(color.toLowerCase())) {
        return { chosen: optionB, rejected: optionA, reason: `Matches your color preference` };
      }
    }
  }

  // Rule 3: Versatility wins - pick the more versatile option
  const versatileKeywords = ["neutral", "black", "white", "navy", "classic", "basic"];
  const aIsVersatile = versatileKeywords.some(k => optionALower.includes(k));
  const bIsVersatile = versatileKeywords.some(k => optionBLower.includes(k));

  if (aIsVersatile && !bIsVersatile) {
    return { chosen: optionA, rejected: optionB, reason: "More versatile - works with more outfits" };
  }
  if (bIsVersatile && !aIsVersatile) {
    return { chosen: optionB, rejected: optionA, reason: "More versatile - works with more outfits" };
  }

  // Rule 4: Default - pick first option with confidence
  // Stylist makes a call, doesn't waffle
  return { chosen: optionA, rejected: optionB, reason: "Cleaner silhouette for your look" };
}

// ============================================
// MAIN DECISION FUNCTION
// ============================================

/**
 * Make a decisive stylist decision
 * 
 * This function NEVER returns a neutral outcome.
 * It always picks a direction, even with low confidence.
 */
export function makeStylistDecision(input: StylistDecisionInput): StylistDecision {
  const {
    intent,
    options = [],
    canonicalMemory,
    wardrobeCoverage,
    confidence,
    outputContract,
    userMessage,
  } = input;

  // Determine stylist mode
  const stylistMode = STYLIST_INTENTS.includes(intent) ? "stylist" : "advisor";

  // Check if confidence is low (but we still decide)
  const confidenceScore = confidence?.final?.score ?? 0.7;
  const forceDecisive = confidenceScore < 0.5;

  // Decision based on intent and output contract
  
  // NO OUTFIT mode - advisory only
  if (outputContract === "no_outfits" || ADVISOR_INTENTS.includes(intent)) {
    return {
      decisionType: "no_outfit",
      rationale: "Advisory response - no outfit generation needed",
      forceDecisive,
      stylistMode: "advisor",
    };
  }

  // SHOPPING / COMPARISON mode - MUST choose one
  if (intent === "shopping_help" || intent === "item_recommendation" || intent === "category_recommendation") {
    if (options.length >= 2) {
      const pick = pickBestOption(options, canonicalMemory, userMessage);
      return {
        decisionType: "choose_one",
        chosenOption: pick.chosen,
        rejectedOption: pick.rejected,
        rationale: pick.reason,
        forceDecisive,
        stylistMode: "stylist",
      };
    }

    // Single option or no options - still be decisive
    return {
      decisionType: "choose_one",
      chosenOption: options[0] || undefined,
      rationale: options.length === 1 ? "This is the right pick for you" : "Here's my recommendation",
      forceDecisive,
      stylistMode: "stylist",
    };
  }

  // OUTFIT mode - MUST return outfit_set
  if (intent === "outfit_generation" || intent === "event_styling" || intent === "travel_packing") {
    return {
      decisionType: "outfit_set",
      rationale: "Complete outfit set tailored to your style",
      forceDecisive,
      stylistMode: "stylist",
    };
  }

  // Default - outfit set with stylist mode
  return {
    decisionType: "outfit_set",
    rationale: "Styled look based on your preferences",
    forceDecisive,
    stylistMode,
  };
}

/**
 * Extract comparison options from user message
 * e.g., "Should I buy a hoodie or jacket?" → ["hoodie", "jacket"]
 */
export function extractComparisonOptions(message: string): string[] {
  const messageLower = message.toLowerCase();

  // Pattern: "X or Y"
  const orPattern = /(?:should i (?:buy|get|choose|wear|pick)|between|comparing)\s+(?:a\s+)?(\w+(?:\s+\w+)?)\s+or\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i;
  const orMatch = message.match(orPattern);
  if (orMatch) {
    return [orMatch[1].trim(), orMatch[2].trim()];
  }

  // Pattern: "X vs Y"
  const vsPattern = /(\w+(?:\s+\w+)?)\s+vs\.?\s+(\w+(?:\s+\w+)?)/i;
  const vsMatch = message.match(vsPattern);
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()];
  }

  // Pattern: "which one - X or Y"
  const whichPattern = /which\s+(?:one|is better)[^-]*[-–]\s*(\w+(?:\s+\w+)?)\s+or\s+(\w+(?:\s+\w+)?)/i;
  const whichMatch = message.match(whichPattern);
  if (whichMatch) {
    return [whichMatch[1].trim(), whichMatch[2].trim()];
  }

  return [];
}

/**
 * Get decisive language based on decision
 */
export function getDecisivePhrase(decision: StylistDecision): string {
  if (decision.forceDecisive) {
    // Even with low confidence, be decisive
    return "This is the better call.";
  }

  const phrases = [
    "Go with this.",
    "This is the one.",
    "Here's my pick.",
    "No question - this.",
    "This works better.",
  ];

  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Get rejection phrase for the option not chosen
 */
export function getRejectionPhrase(rejectedOption: string): string {
  const phrases = [
    `Skip the ${rejectedOption} for now.`,
    `The ${rejectedOption} doesn't fit this vibe.`,
    `Pass on the ${rejectedOption} this time.`,
    `The ${rejectedOption} won't hit as hard here.`,
  ];

  return phrases[Math.floor(Math.random() * phrases.length)];
}

