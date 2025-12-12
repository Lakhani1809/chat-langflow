/**
 * Color Theory Analysis Module
 * Analyzes color combinations, palettes, and recommendations
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatSharedContextForLLM } from "./intelligence";
import type { ColorAnalysis, SharedContext } from "../types";

const FALLBACK_COLOR_ANALYSIS: ColorAnalysis = {
  color_direction: "neutral palette",
  primary_palette: ["black", "white", "grey"],
  accent_colors: ["navy", "beige"],
  combos: ["black and white", "grey and beige"],
  avoid_colors: [],
  reason: "Using versatile neutral combinations that work universally.",
};

/**
 * Analyze colors for outfit styling
 */
export async function analyzeColors(
  context: SharedContext
): Promise<ColorAnalysis> {
  const formattedContext = formatSharedContextForLLM(context);

  const prompt = `You are a fashion color theory expert for an AI stylist.

${formattedContext}

TASK:
Analyze the user's request and wardrobe to provide color styling advice.

Rules:
1. ONLY suggest colors that exist in the user's wardrobe
2. Consider skin tone flattering principles if body type hints at ethnicity
3. Match colors to the occasion and mood
4. Consider seasonal color appropriateness
5. Suggest complementary and analogous color combinations

Provide:
1. color_direction - Overall color strategy (e.g., "monochromatic dark", "neutral with pops of color")
2. primary_palette - 3-4 main colors to build outfits around (from wardrobe)
3. accent_colors - 1-2 accent colors for interest (from wardrobe)
4. combos - 2-3 specific color combinations they can wear
5. avoid_colors - Colors to avoid pairing together
6. reason - Brief explanation of why these colors work

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "color_direction": "...",
  "primary_palette": ["...", "...", "..."],
  "accent_colors": ["...", "..."],
  "combos": ["... and ...", "... with ..."],
  "avoid_colors": ["...", "..."],
  "reason": "..."
}`;

  return callGeminiJson<ColorAnalysis>(prompt, FALLBACK_COLOR_ANALYSIS, {
    temperature: 0.6,
    timeout: 8000,
  });
}

/**
 * Get color harmony suggestions
 */
export function getColorHarmony(baseColor: string): string[] {
  const colorHarmonies: Record<string, string[]> = {
    black: ["white", "grey", "red", "gold", "silver"],
    white: ["black", "navy", "beige", "pastel pink", "light blue"],
    navy: ["white", "cream", "gold", "burgundy", "light grey"],
    beige: ["white", "brown", "navy", "olive", "burgundy"],
    grey: ["black", "white", "pink", "purple", "blue"],
    brown: ["beige", "cream", "orange", "green", "gold"],
    red: ["black", "white", "navy", "grey", "denim blue"],
    pink: ["grey", "white", "navy", "black", "burgundy"],
    blue: ["white", "grey", "beige", "brown", "orange"],
    green: ["white", "beige", "brown", "navy", "gold"],
    olive: ["white", "cream", "tan", "burgundy", "mustard"],
    burgundy: ["navy", "cream", "grey", "pink", "olive"],
    mustard: ["navy", "brown", "grey", "burgundy", "olive"],
    cream: ["navy", "brown", "burgundy", "olive", "black"],
  };

  const lowerColor = baseColor.toLowerCase();
  
  for (const [key, harmonies] of Object.entries(colorHarmonies)) {
    if (lowerColor.includes(key)) {
      return harmonies;
    }
  }

  return ["white", "black", "grey"]; // Safe defaults
}

/**
 * Check if two colors pair well together
 */
export function colorsComplementEachOther(
  color1: string,
  color2: string
): boolean {
  const clashingPairs = [
    ["red", "pink"],
    ["red", "orange"],
    ["brown", "black"],
    ["navy", "black"],
    ["orange", "pink"],
  ];

  const lower1 = color1.toLowerCase();
  const lower2 = color2.toLowerCase();

  for (const [c1, c2] of clashingPairs) {
    if (
      (lower1.includes(c1) && lower2.includes(c2)) ||
      (lower1.includes(c2) && lower2.includes(c1))
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Suggest color for occasion
 */
export function suggestColorsForOccasion(occasion: string): string[] {
  const occasionColors: Record<string, string[]> = {
    date: ["black", "burgundy", "navy", "red", "emerald"],
    office: ["navy", "grey", "white", "black", "beige"],
    casual: ["denim", "white", "beige", "olive", "grey"],
    party: ["black", "gold", "silver", "red", "emerald"],
    wedding: ["pastels", "navy", "blush", "sage", "burgundy"],
    interview: ["navy", "grey", "white", "black"],
    brunch: ["pastels", "white", "beige", "light blue", "sage"],
    travel: ["navy", "black", "grey", "denim", "olive"],
    workout: ["black", "grey", "neon", "white", "navy"],
  };

  const lowerOccasion = occasion.toLowerCase();
  
  for (const [key, colors] of Object.entries(occasionColors)) {
    if (lowerOccasion.includes(key)) {
      return colors;
    }
  }

  return ["black", "white", "navy", "grey"]; // Versatile defaults
}

