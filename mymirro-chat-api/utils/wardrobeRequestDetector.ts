/**
 * V2 Wardrobe Request Detector
 * Detects if user explicitly wants wardrobe-based styling
 */

// ============================================
// DETECTION PATTERNS
// ============================================

/**
 * Patterns indicating explicit wardrobe styling request
 */
const WARDROBE_REQUEST_PATTERNS = [
  "use my wardrobe",
  "from my wardrobe",
  "with my clothes",
  "with what i have",
  "using my clothes",
  "style what i already have",
  "make outfits using my",
  "from my closet",
  "in my wardrobe",
  "what i own",
  "with my existing",
  "use what i have",
  "pair with my",
  "style with my",
  "match with my",
  "combine with my",
  "outfit from my",
  "using items from my",
];

/**
 * Patterns indicating shopping/buying intent (NOT wardrobe)
 */
const SHOPPING_PATTERNS = [
  "should i buy",
  "which should i get",
  "which one to buy",
  "recommend to buy",
  "suggest to buy",
  "what to buy",
  "where to buy",
  "shopping for",
  "looking to purchase",
  "want to buy",
  "need to buy",
  "thinking of buying",
  "considering buying",
  "which is better to get",
  "jacket or hoodie",
  "hoodie or jacket",
  "which one",
  "compare",
  "vs",
  " or ",
];

/**
 * Patterns for outfit generation (implies wardrobe usage)
 */
const OUTFIT_GENERATION_PATTERNS = [
  "what should i wear",
  "make me outfits",
  "create outfits",
  "suggest outfits",
  "outfit ideas",
  "help me dress",
  "dress me",
  "style me",
  "what to wear",
  "outfit for",
  "look for",
  "dress for",
];

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect if user explicitly requests wardrobe-based styling
 * 
 * @returns true if user wants wardrobe outfits
 * @returns false if it's a shopping/comparison question
 */
export function detectWardrobeRequest(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Explicit wardrobe request
  if (WARDROBE_REQUEST_PATTERNS.some(p => lower.includes(p))) {
    return true;
  }
  
  // Shopping patterns override - NOT a wardrobe request
  if (SHOPPING_PATTERNS.some(p => lower.includes(p))) {
    // Unless they explicitly also ask for wardrobe
    if (!WARDROBE_REQUEST_PATTERNS.some(p => lower.includes(p))) {
      return false;
    }
  }
  
  // Outfit generation patterns imply wardrobe usage
  if (OUTFIT_GENERATION_PATTERNS.some(p => lower.includes(p))) {
    return true;
  }
  
  // Default: not a wardrobe request
  return false;
}

/**
 * Detect if this is a shopping comparison question
 */
export function detectShoppingComparison(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Check for comparison patterns
  const hasComparison = 
    lower.includes(" or ") ||
    lower.includes(" vs ") ||
    lower.includes("which") ||
    lower.includes("compare");
  
  // Check for shopping/buying intent
  const hasShopping = SHOPPING_PATTERNS.some(p => lower.includes(p));
  
  return hasComparison || hasShopping;
}

/**
 * Detect if user explicitly said no questions
 */
export function detectNoQuestionsRequested(message: string): boolean {
  const lower = message.toLowerCase();
  
  const noQuestionPatterns = [
    "no questions",
    "don't ask",
    "just suggest",
    "just tell me",
    "just give me",
    "skip questions",
    "straight to",
    "directly",
  ];
  
  return noQuestionPatterns.some(p => lower.includes(p));
}

// ============================================
// RESPONSE MODE INFERENCE
// ============================================

import type { ResponseMode, IntentType } from "../types";

/**
 * Infer response mode from message and intent
 */
export function inferResponseMode(
  message: string,
  primaryIntent: IntentType
): ResponseMode {
  const isWardrobeRequest = detectWardrobeRequest(message);
  const isShoppingComparison = detectShoppingComparison(message);
  
  // Explicit wardrobe request + outfit intent = visual_outfit
  if (isWardrobeRequest) {
    if (primaryIntent === "outfit_generation" || 
        primaryIntent === "event_styling" ||
        primaryIntent === "continuation_query") {
      return "visual_outfit";
    }
    return "mixed"; // Wardrobe request but not full outfit
  }
  
  // Shopping comparison = shopping_comparison (no outfits)
  if (isShoppingComparison) {
    return "shopping_comparison";
  }
  
  // Intent-based defaults
  switch (primaryIntent) {
    case "outfit_generation":
    case "event_styling":
    case "travel_packing":
      return "visual_outfit";
    
    case "continuation_query":
      return "visual_outfit"; // Usually follows outfit request
    
    case "shopping_help":
    case "item_recommendation":
      return "shopping_comparison";
    
    case "trend_analysis":
    case "color_analysis":
    case "body_type_advice":
    case "general_chat":
    case "wardrobe_query":
    case "category_recommendation":
    default:
      return "advisory_text";
  }
}

/**
 * Get output contract from response mode
 */
export function getOutputContract(
  responseMode: ResponseMode,
  hasExplicitWardrobeRequest: boolean
): "outfits_required" | "outfits_optional" | "no_outfits" {
  switch (responseMode) {
    case "visual_outfit":
      return "outfits_required";
    
    case "mixed":
      return "outfits_optional";
    
    case "shopping_comparison":
      // Only allow outfits if explicitly requested
      return hasExplicitWardrobeRequest ? "outfits_optional" : "no_outfits";
    
    case "advisory_text":
    default:
      return "no_outfits";
  }
}

// ============================================
// HELPER EXPORTS
// ============================================

export {
  WARDROBE_REQUEST_PATTERNS,
  SHOPPING_PATTERNS,
  OUTFIT_GENERATION_PATTERNS,
};

