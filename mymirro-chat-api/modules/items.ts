/**
 * Item Recommendation Module
 * Suggests single or multiple items based on user needs
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatRulesForModule } from "../analysis/rules";
import type {
  ItemRecommendationOutput,
  RulesEngineOutput,
  WardrobeContext,
  FashionIntelligence,
} from "../types";
import { formatWardrobeForLLM } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: ItemRecommendationOutput = {
  items: ["A versatile piece from your wardrobe"],
  reasoning: "Selected based on versatility and your style preferences.",
  alternatives: [],
};

/**
 * Recommend specific items from wardrobe
 */
export async function recommendItems(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence
): Promise<ItemRecommendationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const prompt = `You are MyMirro, an expert AI fashion stylist helping with item recommendations.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Color Direction: ${fashionIntelligence.color_direction}
- Occasion: ${fashionIntelligence.occasion}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Recommend specific item(s) from the user's wardrobe based on their request.

Requirements:
1. ONLY recommend items that exist in the wardrobe
2. Reference items by their exact names
3. Explain why each item is a good choice
4. Suggest 1-3 alternatives if available

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "items": ["exact item name from wardrobe", "..."],
  "reasoning": "Why these items are perfect for the request...",
  "alternatives": ["other options from wardrobe", "..."]
}`;

  return callGeminiJson<ItemRecommendationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.7,
    timeout: 10000,
  });
}

/**
 * Find items that match specific criteria
 */
export async function findMatchingItems(
  criteria: string,
  wardrobeContext: WardrobeContext
): Promise<ItemRecommendationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);

  const prompt = `You are a wardrobe search assistant.

SEARCH CRITERIA:
"${criteria}"

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Find all items in the wardrobe that match the search criteria.

Return the matching items with reasoning.

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "items": ["matching item 1", "matching item 2", "..."],
  "reasoning": "These items match because...",
  "alternatives": []
}`;

  return callGeminiJson<ItemRecommendationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.5,
    timeout: 8000,
  });
}

/**
 * Recommend items to pair with a specific piece
 */
export async function recommendPairings(
  baseItem: string,
  wardrobeContext: WardrobeContext,
  occasion?: string
): Promise<ItemRecommendationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);

  const prompt = `You are MyMirro, an expert AI fashion stylist.

BASE ITEM:
"${baseItem}"

${occasion ? `OCCASION: ${occasion}` : ""}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Recommend items from the wardrobe that would pair well with the base item.

Requirements:
1. Only suggest items from the wardrobe
2. Consider color coordination
3. Consider style cohesion
4. Think about occasion if specified

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "items": ["item that pairs well", "another option", "..."],
  "reasoning": "These items complement the base item because...",
  "alternatives": ["other pairing options"]
}`;

  return callGeminiJson<ItemRecommendationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.7,
    timeout: 8000,
  });
}

