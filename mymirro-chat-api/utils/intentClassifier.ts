/**
 * Intent Classification Module
 * V2: Multi-intent support with confidence scoring
 */

import { callGeminiJson } from "./geminiClient";
import type { 
  IntentType, 
  IntentResult, 
  ConversationMemory,
  MultiIntentResult,
  ConfidenceScore,
} from "../types";
import { isContinuationQuery } from "./memory";
import { createConfidenceScore } from "./confidence";

const FALLBACK_INTENT: IntentResult = { intent: "general_chat" };

const FALLBACK_MULTI_INTENT: MultiIntentResult = {
  primary_intent: "general_chat",
  secondary_intents: [],
  intent_confidence: {
    score: 0.5,
    basis: ["fallback"],
  },
};

/**
 * Classify user intent
 */
export async function classifyIntent(
  userMessage: string,
  memory?: ConversationMemory
): Promise<IntentResult> {
  // Check for continuation query first
  if (memory && isContinuationQuery(userMessage, memory)) {
    return { intent: "continuation_query" };
  }

  const prompt = `You are an intent classifier for MyMirro, a fashion stylist AI.

USER MESSAGE:
"${userMessage}"

Classify this message into EXACTLY ONE of the following intents:

1. outfit_generation - User wants complete outfit suggestions (e.g., "what should I wear", "outfit for date", "help me dress")
2. item_recommendation - User wants specific item suggestions (e.g., "what top goes with", "suggest a jacket")
3. category_recommendation - User asks about a category (e.g., "show me my tops", "what jeans do I have")
4. shopping_help - User wants shopping/brand advice (e.g., "where to buy", "brand suggestions", "what to shop for")
5. trend_analysis - User asks about trends (e.g., "what's trending", "is X in style", "current fashion")
6. travel_packing - User needs packing help (e.g., "pack for trip", "travel outfits", "what to bring")
7. color_analysis - User asks about colors (e.g., "what colors suit me", "color combinations")
8. body_type_advice - User asks about body type styling (e.g., "dress for my body", "flatter my figure")
9. event_styling - User has specific event (e.g., "wedding guest", "interview outfit", "party look")
10. wardrobe_query - User asks about their wardrobe (e.g., "what do I have", "do I own", "my wardrobe")
11. continuation_query - User wants more options (e.g., "more", "another option", "different one")
12. general_chat - General conversation, greetings, or unclear intent

IMPORTANT: Return ONLY valid JSON with exactly this format:
{"intent": "<one_of_the_above_labels>"}`;

  return callGeminiJson<IntentResult>(prompt, FALLBACK_INTENT, {
    temperature: 0.3,
    timeout: 6000,
  });
}

/**
 * Validate intent result
 */
export function validateIntent(result: IntentResult): boolean {
  const validIntents: IntentType[] = [
    "outfit_generation",
    "item_recommendation",
    "category_recommendation",
    "shopping_help",
    "trend_analysis",
    "travel_packing",
    "color_analysis",
    "body_type_advice",
    "event_styling",
    "wardrobe_query",
    "continuation_query",
    "general_chat",
  ];

  return validIntents.includes(result.intent);
}

/**
 * Get intent from keywords (fallback/quick classification)
 */
export function getIntentFromKeywords(message: string): IntentType | null {
  const lowerMessage = message.toLowerCase();

  // Outfit generation keywords
  if (
    lowerMessage.includes("outfit") ||
    lowerMessage.includes("what should i wear") ||
    lowerMessage.includes("help me dress") ||
    lowerMessage.includes("what to wear") ||
    lowerMessage.includes("dress me")
  ) {
    return "outfit_generation";
  }

  // Event styling
  if (
    lowerMessage.includes("wedding") ||
    lowerMessage.includes("interview") ||
    lowerMessage.includes("party") ||
    lowerMessage.includes("date night") ||
    lowerMessage.includes("formal event")
  ) {
    return "event_styling";
  }

  // Travel packing
  if (
    lowerMessage.includes("pack") ||
    lowerMessage.includes("travel") ||
    lowerMessage.includes("trip") ||
    lowerMessage.includes("vacation")
  ) {
    return "travel_packing";
  }

  // Shopping
  if (
    lowerMessage.includes("buy") ||
    lowerMessage.includes("shop") ||
    lowerMessage.includes("brand") ||
    lowerMessage.includes("where to get") ||
    lowerMessage.includes("purchase")
  ) {
    return "shopping_help";
  }

  // Trends
  if (
    lowerMessage.includes("trend") ||
    lowerMessage.includes("in style") ||
    lowerMessage.includes("fashion now") ||
    lowerMessage.includes("what's hot")
  ) {
    return "trend_analysis";
  }

  // Color
  if (
    lowerMessage.includes("color") ||
    lowerMessage.includes("colour") ||
    lowerMessage.includes("palette") ||
    lowerMessage.includes("what shade")
  ) {
    return "color_analysis";
  }

  // Body type
  if (
    lowerMessage.includes("body type") ||
    lowerMessage.includes("body shape") ||
    lowerMessage.includes("flatter my") ||
    lowerMessage.includes("for my figure")
  ) {
    return "body_type_advice";
  }

  // Wardrobe query
  if (
    lowerMessage.includes("do i have") ||
    lowerMessage.includes("my wardrobe") ||
    lowerMessage.includes("what i own") ||
    lowerMessage.includes("show me my")
  ) {
    return "wardrobe_query";
  }

  // Continuation
  if (
    lowerMessage.includes("more") ||
    lowerMessage.includes("another") ||
    lowerMessage.includes("different") ||
    lowerMessage.includes("other option")
  ) {
    return "continuation_query";
  }

  // Category recommendation
  const categories = ["tops", "bottoms", "shoes", "dresses", "jackets", "jeans", "shirts"];
  if (categories.some((cat) => lowerMessage.includes(cat))) {
    return "category_recommendation";
  }

  return null; // Use LLM classification
}

/**
 * Get intent description for logging
 */
export function getIntentDescription(intent: IntentType): string {
  const descriptions: Record<IntentType, string> = {
    outfit_generation: "Complete outfit suggestion",
    item_recommendation: "Specific item recommendation",
    category_recommendation: "Category-based recommendation",
    shopping_help: "Shopping and brand advice",
    trend_analysis: "Fashion trend analysis",
    travel_packing: "Travel packing assistance",
    color_analysis: "Color styling advice",
    body_type_advice: "Body type styling tips",
    event_styling: "Event-specific styling",
    wardrobe_query: "Wardrobe exploration",
    continuation_query: "Requesting more options",
    general_chat: "General conversation",
  };

  return descriptions[intent] || "Unknown intent";
}

// ============================================
// V2: MULTI-INTENT CLASSIFICATION
// ============================================

/**
 * V2: Classify intent with multi-label support and confidence scoring
 */
export async function classifyIntentV2(
  userMessage: string,
  memory?: ConversationMemory
): Promise<MultiIntentResult> {
  // Check for continuation query first
  if (memory && isContinuationQuery(userMessage, memory)) {
    return {
      primary_intent: "continuation_query",
      secondary_intents: [],
      intent_confidence: createConfidenceScore(0.95, ["memory_pattern"]),
    };
  }

  // Try keyword classification first
  const keywordResult = getMultiIntentFromKeywords(userMessage);
  if (keywordResult) {
    return keywordResult;
  }

  // Fall back to LLM classification
  const prompt = `You are an intent classifier for MyMirro, a fashion stylist AI.

USER MESSAGE:
"${userMessage}"

Classify this message. A message may have multiple intents.

INTENTS:
1. outfit_generation - User wants complete outfit suggestions
2. item_recommendation - User wants specific item suggestions
3. category_recommendation - User asks about a category
4. shopping_help - User wants shopping/brand advice or is comparing items to buy
5. trend_analysis - User asks about trends
6. travel_packing - User needs packing help
7. color_analysis - User asks about colors
8. body_type_advice - User asks about body type styling
9. event_styling - User has specific event
10. wardrobe_query - User asks about their wardrobe
11. continuation_query - User wants more options
12. general_chat - General conversation

Return JSON with:
- primary_intent: The main intent
- secondary_intents: Array of additional relevant intents (can be empty)
- confidence: 0-1 score of how confident you are
- rationale: Brief explanation

Example:
{"primary_intent": "shopping_help", "secondary_intents": ["color_analysis"], "confidence": 0.85, "rationale": "User comparing items to buy with color preference"}

IMPORTANT: Return ONLY valid JSON.`;

  type LLMResponse = {
    primary_intent: string;
    secondary_intents?: string[];
    confidence?: number;
    rationale?: string;
  };

  const result = await callGeminiJson<LLMResponse>(
    prompt,
    { primary_intent: "general_chat", secondary_intents: [], confidence: 0.5 },
    { temperature: 0.3, timeout: 6000 }
  );

  // Validate and transform result
  const validIntents: IntentType[] = [
    "outfit_generation", "item_recommendation", "category_recommendation",
    "shopping_help", "trend_analysis", "travel_packing", "color_analysis",
    "body_type_advice", "event_styling", "wardrobe_query", "continuation_query",
    "general_chat",
  ];

  const primaryIntent = validIntents.includes(result.primary_intent as IntentType)
    ? result.primary_intent as IntentType
    : "general_chat";

  const secondaryIntents = (result.secondary_intents || [])
    .filter((i): i is IntentType => validIntents.includes(i as IntentType))
    .slice(0, 2); // Max 2 secondary intents

  return {
    primary_intent: primaryIntent,
    secondary_intents: secondaryIntents,
    intent_confidence: createConfidenceScore(
      result.confidence || 0.5,
      ["llm_classification"]
    ),
    rationale: result.rationale,
  };
}

/**
 * V2: Multi-intent from keywords
 */
export function getMultiIntentFromKeywords(message: string): MultiIntentResult | null {
  const lowerMessage = message.toLowerCase();
  const detectedIntents: IntentType[] = [];

  // Detect all matching intents
  
  // Shopping comparison patterns (high priority)
  if (
    (lowerMessage.includes(" or ") && (lowerMessage.includes("buy") || lowerMessage.includes("get") || lowerMessage.includes("should"))) ||
    lowerMessage.includes("should i buy") ||
    lowerMessage.includes("which should i") ||
    lowerMessage.includes("jacket or hoodie") ||
    lowerMessage.includes("hoodie or jacket")
  ) {
    detectedIntents.push("shopping_help");
  }

  // Outfit generation keywords
  if (
    lowerMessage.includes("outfit") ||
    lowerMessage.includes("what should i wear") ||
    lowerMessage.includes("help me dress") ||
    lowerMessage.includes("what to wear") ||
    lowerMessage.includes("dress me") ||
    lowerMessage.includes("make me outfits")
  ) {
    detectedIntents.push("outfit_generation");
  }

  // Event styling
  if (
    lowerMessage.includes("wedding") ||
    lowerMessage.includes("interview") ||
    lowerMessage.includes("party") ||
    lowerMessage.includes("date night") ||
    lowerMessage.includes("formal event")
  ) {
    detectedIntents.push("event_styling");
  }

  // Travel packing
  if (
    lowerMessage.includes("pack") ||
    lowerMessage.includes("travel") ||
    lowerMessage.includes("trip") ||
    lowerMessage.includes("vacation")
  ) {
    detectedIntents.push("travel_packing");
  }

  // Shopping (if not already detected as comparison)
  if (
    !detectedIntents.includes("shopping_help") &&
    (lowerMessage.includes("buy") ||
    lowerMessage.includes("shop") ||
    lowerMessage.includes("brand") ||
    lowerMessage.includes("where to get") ||
    lowerMessage.includes("purchase") ||
    lowerMessage.includes("recommend to buy"))
  ) {
    detectedIntents.push("shopping_help");
  }

  // Trends
  if (
    lowerMessage.includes("trend") ||
    lowerMessage.includes("in style") ||
    lowerMessage.includes("fashion now") ||
    lowerMessage.includes("what's hot")
  ) {
    detectedIntents.push("trend_analysis");
  }

  // Color
  if (
    lowerMessage.includes("color") ||
    lowerMessage.includes("colour") ||
    lowerMessage.includes("palette") ||
    lowerMessage.includes("what shade")
  ) {
    detectedIntents.push("color_analysis");
  }

  // Body type
  if (
    lowerMessage.includes("body type") ||
    lowerMessage.includes("body shape") ||
    lowerMessage.includes("flatter my") ||
    lowerMessage.includes("for my figure")
  ) {
    detectedIntents.push("body_type_advice");
  }

  // Wardrobe query
  if (
    lowerMessage.includes("do i have") ||
    lowerMessage.includes("my wardrobe") ||
    lowerMessage.includes("what i own") ||
    lowerMessage.includes("show me my")
  ) {
    detectedIntents.push("wardrobe_query");
  }

  // Continuation
  if (
    lowerMessage.includes("more option") ||
    lowerMessage.includes("another option") ||
    lowerMessage.includes("show me more") ||
    lowerMessage.includes("different one")
  ) {
    detectedIntents.push("continuation_query");
  }

  // Category recommendation
  const categories = ["tops", "bottoms", "shoes", "dresses", "jackets", "jeans", "shirts"];
  if (categories.some((cat) => lowerMessage.includes(cat))) {
    if (!detectedIntents.includes("shopping_help")) {
      detectedIntents.push("category_recommendation");
    }
  }

  // Item recommendation
  if (
    lowerMessage.includes("suggest a") ||
    lowerMessage.includes("what goes with") ||
    lowerMessage.includes("pair with")
  ) {
    detectedIntents.push("item_recommendation");
  }

  if (detectedIntents.length === 0) {
    return null; // Use LLM classification
  }

  // First detected is primary, rest are secondary
  const primaryIntent = detectedIntents[0];
  const secondaryIntents = detectedIntents.slice(1, 3); // Max 2 secondary

  return {
    primary_intent: primaryIntent,
    secondary_intents: secondaryIntents,
    intent_confidence: createConfidenceScore(
      detectedIntents.length === 1 ? 0.9 : 0.8,
      ["keyword_match", ...(secondaryIntents.length > 0 ? ["multi_intent"] : [])]
    ),
  };
}

/**
 * V2: Convert MultiIntentResult to legacy IntentResult (backward compat)
 */
export function toLegacyIntentResult(multiIntent: MultiIntentResult): IntentResult {
  return { intent: multiIntent.primary_intent };
}

/**
 * V2: Check if multi-intent result includes a specific intent
 */
export function hasIntent(result: MultiIntentResult, intent: IntentType): boolean {
  return result.primary_intent === intent || 
         result.secondary_intents.includes(intent);
}

