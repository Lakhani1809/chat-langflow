/**
 * Category Recommendation Module
 * Handles requests for specific clothing categories
 */

import { callGeminiJson } from "../utils/geminiClient";
import type {
  CategoryRecommendationOutput,
  WardrobeContext,
  FashionIntelligence,
} from "../types";
import { formatWardrobeForLLM, findMatchingItems } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: CategoryRecommendationOutput = {
  category: "general",
  recommended_items: [],
  styling_tips: ["Choose pieces that make you feel confident"],
};

/**
 * Recommend items from a specific category
 */
export async function recommendByCategory(
  userMessage: string,
  category: string,
  wardrobeContext: WardrobeContext,
  fashionIntelligence: FashionIntelligence
): Promise<CategoryRecommendationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);

  const prompt = `You are MyMirro, an expert AI fashion stylist.

USER REQUEST:
"${userMessage}"

CATEGORY FOCUS:
${category}

FASHION INTELLIGENCE:
- Aesthetic: ${fashionIntelligence.aesthetic}
- Vibe: ${fashionIntelligence.vibe}
- Occasion: ${fashionIntelligence.occasion}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Recommend items from the user's wardrobe that fit the requested category.

Requirements:
1. Focus on the ${category} category
2. Only recommend items from the wardrobe
3. Rank by how well they match the user's request
4. Provide styling tips for each

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "category": "${category}",
  "recommended_items": ["item 1 from wardrobe", "item 2", "..."],
  "styling_tips": ["tip for styling these items", "..."]
}`;

  return callGeminiJson<CategoryRecommendationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.7,
    timeout: 10000,
  });
}

/**
 * Extract category from user message
 */
export function extractCategory(userMessage: string): string {
  const categories: Record<string, string[]> = {
    tops: ["top", "tops", "shirt", "shirts", "blouse", "tee", "t-shirt", "sweater", "hoodie"],
    bottoms: ["bottom", "bottoms", "pants", "jeans", "trousers", "shorts", "skirt"],
    dresses: ["dress", "dresses", "gown", "jumpsuit", "romper"],
    outerwear: ["jacket", "jackets", "coat", "coats", "blazer", "cardigan", "outerwear"],
    shoes: ["shoe", "shoes", "sneakers", "heels", "boots", "sandals", "flats"],
    accessories: ["accessory", "accessories", "bag", "bags", "jewelry", "watch", "belt", "scarf"],
  };

  const lowerMessage = userMessage.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => lowerMessage.includes(kw))) {
      return category;
    }
  }

  return "general";
}

/**
 * Get items in a category from wardrobe
 */
export function getItemsInCategory(
  wardrobeContext: WardrobeContext,
  category: string
): string[] {
  const categoryMap: Record<string, string[]> = {
    tops: ["tops", "top", "shirt", "blouse", "tee", "sweater", "hoodie"],
    bottoms: ["bottoms", "bottom", "pants", "jeans", "trousers", "shorts", "skirt"],
    dresses: ["dresses", "dress", "gown", "jumpsuit", "romper"],
    outerwear: ["outerwear", "jacket", "coat", "blazer", "cardigan"],
    shoes: ["shoes", "shoe", "sneakers", "heels", "boots", "sandals", "flats"],
    accessories: ["accessories", "accessory", "bag", "jewelry", "watch", "belt", "scarf"],
  };

  const targetCategories = categoryMap[category.toLowerCase()] || [category.toLowerCase()];

  return wardrobeContext.wardrobe_items
    .filter((item) => {
      const itemCat = item.category?.toLowerCase() || "";
      const itemType = item.item_type?.toLowerCase() || "";
      return targetCategories.some(
        (tc) => itemCat.includes(tc) || itemType.includes(tc) || tc.includes(itemCat)
      );
    })
    .map((item) => item.name || `${item.color} ${item.category}`);
}

