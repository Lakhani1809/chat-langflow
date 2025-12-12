/**
 * Shopping Help Module
 * Provides brand suggestions, aesthetics, and shopping guidance
 */

import { callGeminiJson } from "../utils/geminiClient";
import type {
  ShoppingHelpOutput,
  WardrobeContext,
  FashionIntelligence,
} from "../types";
import { formatWardrobeSummary } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: ShoppingHelpOutput = {
  brands: ["Zara", "H&M", "Uniqlo"],
  aesthetics: ["modern casual", "versatile basics"],
  price_ranges: ["budget-friendly", "mid-range"],
  shopping_tips: ["Focus on versatile pieces that mix with your existing wardrobe"],
  specific_items: [],
};

/**
 * Provide shopping recommendations
 */
export async function provideShoppingHelp(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  fashionIntelligence: FashionIntelligence
): Promise<ShoppingHelpOutput> {
  const wardrobeSummary = formatWardrobeSummary(wardrobeContext);

  const prompt = `You are MyMirro, an expert AI fashion stylist helping with shopping advice.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Fit Preference: ${fashionIntelligence.fit_preference}
- Color Direction: ${fashionIntelligence.color_direction}

CURRENT WARDROBE SUMMARY:
${wardrobeSummary}

TASK:
Provide shopping recommendations tailored to the user's style and wardrobe gaps.

For Indian Gen-Z audience, suggest:
1. Brands available in India (mix of international & local)
2. Aesthetics that match their vibe
3. Realistic price ranges
4. Practical shopping tips
5. Specific items to look for (if applicable)

Consider:
- What's missing from their wardrobe
- What would complement existing pieces
- Current trends relevant to their aesthetic
- Budget-conscious options

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "brands": ["brand 1", "brand 2", "brand 3", "..."],
  "aesthetics": ["aesthetic 1", "aesthetic 2"],
  "price_ranges": ["budget option", "mid-range option", "investment piece option"],
  "shopping_tips": ["tip 1", "tip 2", "..."],
  "specific_items": ["specific item to look for", "..."]
}`;

  return callGeminiJson<ShoppingHelpOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.8,
    timeout: 10000,
  });
}

/**
 * Get brands by aesthetic
 */
export function getBrandsByAesthetic(aesthetic: string): string[] {
  const brandMap: Record<string, string[]> = {
    minimalist: ["Uniqlo", "COS", "Muji", "& Other Stories", "Massimo Dutti"],
    streetwear: ["Stussy", "Supreme", "Nike", "Adidas", "Bewakoof", "The Souled Store"],
    bohemian: ["Free People", "Anthropologie", "FabIndia", "Anokhi", "Global Desi"],
    preppy: ["Ralph Lauren", "Tommy Hilfiger", "Gant", "Brooks Brothers", "Allen Solly"],
    "old money": ["Massimo Dutti", "Ralph Lauren", "Loro Piana", "Tod's", "Max Mara"],
    vintage: ["Thrift stores", "Relove", "Kiabza", "Vintage sellers on Instagram"],
    athleisure: ["Nike", "Adidas", "Lululemon", "Puma", "HRX", "Reebok"],
    "clean girl": ["Zara", "Mango", "& Other Stories", "Aritzia", "COS"],
    korean: ["Shein", "YesStyle", "Koovs", "StyleWe"],
    parisian: ["Sézane", "Rouje", "Zara", "Mango", "& Other Stories"],
  };

  const lowerAesthetic = aesthetic.toLowerCase();
  
  for (const [key, brands] of Object.entries(brandMap)) {
    if (lowerAesthetic.includes(key)) {
      return brands;
    }
  }

  // Default versatile brands
  return ["Zara", "H&M", "Mango", "Uniqlo", "Marks & Spencer"];
}

/**
 * Get Indian brand alternatives
 */
export function getIndianBrandAlternatives(): Record<string, string[]> {
  return {
    "Budget-Friendly": [
      "Bewakoof",
      "The Souled Store",
      "Urbanic",
      "Shein",
      "Ajio",
      "Myntra brands",
    ],
    "Mid-Range": [
      "Zara",
      "H&M",
      "Mango",
      "Forever 21",
      "Vero Moda",
      "Only",
      "AND",
      "W",
    ],
    Premium: [
      "Massimo Dutti",
      "Ted Baker",
      "Marks & Spencer",
      "FabIndia",
      "Good Earth",
    ],
    Ethnic: [
      "FabIndia",
      "Global Desi",
      "W",
      "Biba",
      "Anokhi",
      "Jaypore",
    ],
    Sustainable: [
      "Nicobar",
      "11.11",
      "Ka-Sha",
      "Doodlage",
      "The Summer House",
    ],
  };
}

/**
 * Identify wardrobe gaps
 */
export function identifyWardrobeGaps(
  wardrobeContext: WardrobeContext
): string[] {
  const gaps: string[] = [];
  const items = wardrobeContext.wardrobe_items;

  // Check for essential categories
  const categories = items.map((i) => i.category?.toLowerCase() || "");
  
  const essentials = [
    { category: "tops", names: ["white shirt", "black top", "neutral tee"] },
    { category: "bottoms", names: ["jeans", "black pants", "neutral trousers"] },
    { category: "shoes", names: ["white sneakers", "black shoes", "versatile heels"] },
    { category: "outerwear", names: ["blazer", "jacket", "cardigan"] },
  ];

  for (const essential of essentials) {
    if (!categories.some((c) => c.includes(essential.category))) {
      gaps.push(`Missing ${essential.category}`);
    }
  }

  // Check color variety
  const colors = items.map((i) => i.color?.toLowerCase() || "").filter(Boolean);
  const hasNeutrals = colors.some((c) => 
    ["black", "white", "grey", "gray", "beige", "cream", "navy"].some((n) => c.includes(n))
  );
  
  if (!hasNeutrals) {
    gaps.push("Consider adding neutral basics");
  }

  return gaps;
}

