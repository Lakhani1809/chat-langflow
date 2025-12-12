/**
 * Outfit Generation Module
 * Generates complete outfit suggestions based on analysis
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatRulesForModule } from "../analysis/rules";
import type {
  Outfit,
  OutfitGenerationOutput,
  RulesEngineOutput,
  WardrobeContext,
  FashionIntelligence,
  ConversationMemory,
} from "../types";
import { formatWardrobeForLLM } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: OutfitGenerationOutput = {
  outfits: [
    {
      title: "Classic Everyday Look",
      items: ["A versatile top", "Comfortable bottoms", "Everyday shoes"],
      why_it_works: "A balanced, comfortable combination perfect for daily wear.",
    },
  ],
  styling_notes: "Focus on pieces that make you feel confident and comfortable.",
};

/**
 * Generate outfit suggestions
 */
export async function generateOutfits(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence,
  memory?: ConversationMemory
): Promise<OutfitGenerationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const memoryContext = memory
    ? `
CONVERSATION CONTEXT:
- User's tone: ${memory.userTone}
- User preferences: ${memory.userPreferences.join(", ") || "None noted"}
- Frequent aesthetics: ${memory.frequentAesthetics.join(", ") || "None noted"}
${memory.lastOutfitSuggestions.length > 0 ? `- Previously suggested: ${memory.lastOutfitSuggestions.map((o) => o.title).join(", ")} (suggest different options)` : ""}`
    : "";

  const prompt = `You are MyMirro, an expert AI fashion stylist creating personalized outfit suggestions.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Fit Preference: ${fashionIntelligence.fit_preference}
- Color Direction: ${fashionIntelligence.color_direction}
- Occasion: ${fashionIntelligence.occasion}
- Mood: ${fashionIntelligence.mood}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

${memoryContext}

TASK:
Create 2-3 complete outfit suggestions using ONLY items from the user's wardrobe.

Requirements:
1. Each outfit MUST use specific items by name from the wardrobe
2. Include top, bottom, and optionally shoes/accessories
3. Explain why each outfit works for the occasion and body type
4. Make each outfit distinct from the others
5. Follow the styling rules provided
6. Give each outfit a catchy, Gen-Z friendly title

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "outfits": [
    {
      "title": "...",
      "items": ["specific item from wardrobe", "another item", "..."],
      "why_it_works": "...",
      "occasion": "...",
      "vibe": "..."
    }
  ],
  "styling_notes": "..."
}`;

  return callGeminiJson<OutfitGenerationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2048,
  });
}

/**
 * Generate more outfit options (for continuation queries)
 */
export async function generateMoreOutfits(
  previousOutfits: Outfit[],
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence
): Promise<OutfitGenerationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const previousTitles = previousOutfits.map((o) => o.title).join(", ");
  const previousItems = previousOutfits.flatMap((o) => o.items);

  const prompt = `You are MyMirro, an expert AI fashion stylist.

The user asked for MORE outfit options. Here's what we've already suggested:
- Previous outfits: ${previousTitles}
- Items already used: ${previousItems.join(", ")}

FASHION CONTEXT:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Occasion: ${fashionIntelligence.occasion}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Create 2-3 NEW outfit suggestions that are DIFFERENT from the previous ones.

Requirements:
1. Use DIFFERENT items or different combinations
2. Each outfit uses items by name from the wardrobe
3. Keep the same occasion/vibe unless items suggest otherwise
4. Make these feel fresh and distinct

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "outfits": [
    {
      "title": "...",
      "items": ["...", "..."],
      "why_it_works": "...",
      "occasion": "...",
      "vibe": "..."
    }
  ],
  "styling_notes": "..."
}`;

  return callGeminiJson<OutfitGenerationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.85,
    timeout: 12000,
  });
}

/**
 * Validate outfit output
 */
export function validateOutfitOutput(output: OutfitGenerationOutput): boolean {
  return (
    Array.isArray(output.outfits) &&
    output.outfits.length > 0 &&
    output.outfits.every(
      (o) =>
        typeof o.title === "string" &&
        Array.isArray(o.items) &&
        o.items.length > 0 &&
        typeof o.why_it_works === "string"
    )
  );
}

