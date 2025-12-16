/**
 * Intent Classification Module
 * V2: Multi-intent support with confidence scoring
 * V5: Always use LLM for accurate intent classification (no keyword shortcuts)
 */

import { callGeminiJson, GEMINI_LITE } from "./geminiClient";
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
 * V5: Enhanced prompt for accurate intent classification
 */
export async function classifyIntent(
  userMessage: string,
  memory?: ConversationMemory
): Promise<MultiIntentResult> {
  // Check for continuation query first (pattern-based, no LLM needed)
  if (memory && isContinuationQuery(userMessage, memory)) {
    return {
      primary_intent: "continuation_query",
      secondary_intents: [],
      intent_confidence: createConfidenceScore(0.95, ["memory_pattern"]),
    };
  }

  // Build context from memory
  const recentContext = memory?.recentUserMessages?.slice(-2).join(" ") || "";
  const hasOutfitContext = recentContext.toLowerCase().includes("outfit") || 
                           recentContext.toLowerCase().includes("wear");

  const prompt = `You are an expert intent classifier for MyMirro, a personal fashion stylist AI app.

Your task is to understand the TRUE intent behind the user's message, not just match keywords.

USER MESSAGE:
"${userMessage}"

${recentContext ? `RECENT CONVERSATION CONTEXT:\n"${recentContext}"\n` : ""}

AVAILABLE INTENTS (choose the BEST match):

1. **outfit_generation** - User wants COMPLETE outfit suggestions from their wardrobe
   Examples: "what should I wear today?", "make me an outfit", "style me for today"
   NOT: asking about trends, shopping advice, or specific items

2. **event_styling** - User wants outfit for a SPECIFIC EVENT or occasion
   Examples: "outfit for my date tonight", "what to wear to a wedding", "interview look"
   Key: Must mention a specific event/occasion

3. **shopping_help** - User wants EXTERNAL shopping advice, recommendations to BUY, or comparing items to purchase
   Examples: "should I buy the hoodie or jacket?", "where can I get a blazer?", "which brand is better?"
   Key: About BUYING or COMPARING items, not styling existing wardrobe

4. **trend_analysis** - User asks about FASHION TRENDS or what's currently in style
   Examples: "what's trending now?", "is oversized still in?", "current fashion trends"
   Key: About general fashion trends, NOT personal styling

5. **travel_packing** - User needs help PACKING for a trip
   Examples: "pack for my Goa trip", "what to bring to Europe", "travel capsule wardrobe"
   Key: Must involve travel/trip context

6. **color_analysis** - User asks about COLORS that suit them
   Examples: "what colors look good on me?", "my color palette", "warm or cool tones?"
   Key: About color theory and personal coloring

7. **body_type_advice** - User asks about styling for their BODY TYPE
   Examples: "dress for my body shape", "flatter my figure", "I'm pear-shaped, what works?"
   Key: About body shape/figure styling

8. **wardrobe_query** - User asks about items they ALREADY OWN
   Examples: "do I have a black dress?", "show me my jackets", "what's in my wardrobe?"
   Key: Querying existing wardrobe, not asking for styling

9. **item_recommendation** - User wants a SPECIFIC ITEM suggestion
   Examples: "what top goes with these jeans?", "suggest a bag", "need a belt"
   Key: About ONE specific item, not complete outfit

10. **category_recommendation** - User asks about a CATEGORY of items
    Examples: "show me formal shirts", "what kind of shoes should I have?"
    Key: About a category, not specific item or complete outfit

11. **continuation_query** - User wants MORE OPTIONS or variations
    Examples: "show me more", "another option", "different style", "what else?"
    Key: Following up on previous suggestions

12. **general_chat** - Greetings, unclear intent, or off-topic
    Examples: "hi", "thanks", "how are you?", unrelated questions
    Key: Not about fashion/styling specifically

DECISION RULES:
- If user asks "what's trending" → trend_analysis (NOT outfit_generation)
- If user compares items to buy → shopping_help (NOT outfit_generation)
- If user mentions a specific event → event_styling (NOT outfit_generation)
- If message is vague like "what should I wear" → outfit_generation
- When in doubt between outfit_generation and event_styling, prefer event_styling if ANY event is mentioned
- When in doubt between shopping_help and item_recommendation, shopping_help if they're buying

Return JSON:
{
  "primary_intent": "<intent>",
  "secondary_intents": [],
  "confidence": <0.0-1.0>,
  "rationale": "<brief reason>"
}`;

  type LLMResponse = {
    primary_intent: string;
    secondary_intents?: string[];
    confidence?: number;
    rationale?: string;
  };

  const result = await callGeminiJson<LLMResponse>(
    prompt,
    { primary_intent: "general_chat", secondary_intents: [], confidence: 0.5 },
    { 
      model: GEMINI_LITE, // Use lite model for fast classification
      temperature: 0.2, // Lower temp for more consistent classification
      timeout: 5000,
    }
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
    .slice(0, 2);

  console.log(`🎯 Intent rationale: ${result.rationale || "none"}`);

  return {
    primary_intent: primaryIntent,
    secondary_intents: secondaryIntents,
    intent_confidence: createConfidenceScore(
      result.confidence || 0.7,
      ["llm_classified"],
      result.rationale
    ),
    rationale: result.rationale,
  };
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
// V2: MULTI-INTENT CLASSIFICATION (DEPRECATED)
// V5: Use classifyIntent() instead - it now returns MultiIntentResult
// ============================================

/**
 * V2: Classify intent with multi-label support and confidence scoring
 * @deprecated Use classifyIntent() instead - it now returns MultiIntentResult
 */
export async function classifyIntentV2(
  userMessage: string,
  memory?: ConversationMemory
): Promise<MultiIntentResult> {
  // V5: Just call the main classifyIntent which now returns MultiIntentResult
  return classifyIntent(userMessage, memory);
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

