/**
 * Fashion Intelligence Engine (FIE)
 * Extracts vibe, aesthetic, fit preference, color direction, occasion, mood, and gender context
 */

import { callGeminiJson } from "../utils/geminiClient";
import type { FashionIntelligence, SharedContext, Gender, GenderContext } from "../types";

const FALLBACK_INTELLIGENCE: FashionIntelligence = {
  vibe: "versatile",
  aesthetic: "modern casual",
  fit_preference: "comfortable",
  color_direction: "neutral",
  occasion: "everyday",
  mood: "confident",
  gender_context: "androgynous",
};

/**
 * Derive default gender context from profile gender
 */
export function deriveDefaultGenderContext(gender?: Gender): GenderContext {
  switch (gender) {
    case "male":
      return "masculine";
    case "female":
      return "feminine";
    case "other":
    default:
      return "androgynous";
  }
}

/**
 * Extract fashion intelligence from user message and wardrobe
 * Now includes gender-aware context derivation
 */
export async function extractFashionIntelligence(
  userMessage: string,
  wardrobeSummary: string,
  gender?: Gender
): Promise<FashionIntelligence> {
  const defaultGenderContext = deriveDefaultGenderContext(gender);

  const prompt = `You are a fashion intelligence analyzer for an AI stylist.

USER MESSAGE:
"${userMessage}"

WARDROBE SUMMARY:
${wardrobeSummary}

USER PROFILE GENDER: ${gender || "not specified"}
DEFAULT STYLING CONTEXT: ${defaultGenderContext}

TASK:
Analyze the user's request, wardrobe, and language to extract their fashion intent.

Extract the following:
1. vibe - The overall feeling they want (e.g., "chill", "powerful", "romantic", "edgy")
2. aesthetic - The style category (e.g., "minimalist", "bohemian", "streetwear", "preppy", "old money")
3. fit_preference - How they want clothes to fit (e.g., "oversized", "fitted", "relaxed", "tailored")
4. color_direction - Color preference for this request (e.g., "dark", "bright", "neutral", "monochrome", "colorful")
5. occasion - What the outfit is for (e.g., "date night", "office", "casual outing", "party", "travel")
6. mood - The emotional state they want to project (e.g., "confident", "approachable", "mysterious", "playful")
7. gender_context - The styling direction based on wardrobe items AND user language:
   - "masculine" - Structured, angular, traditionally masculine silhouettes
   - "feminine" - Softer, flowing, traditionally feminine silhouettes
   - "androgynous" - Balanced, neutral, gender-neutral styling
   - "fluid" - Mix of masculine and feminine elements intentionally

GENDER CONTEXT RULES:
- Start with the default (${defaultGenderContext}) but OVERRIDE it if:
  - The wardrobe contains items that suggest different styling (e.g., dresses, skirts suggest feminine even if male)
  - The user's language suggests different styling (e.g., "I want something feminine" overrides male default)
  - The user explicitly requests a different direction
- This is about STYLING DIRECTION, not identity
- Never hard-code based on gender alone - let wardrobe reality guide

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "vibe": "...",
  "aesthetic": "...",
  "fit_preference": "...",
  "color_direction": "...",
  "occasion": "...",
  "mood": "...",
  "gender_context": "masculine" | "feminine" | "androgynous" | "fluid"
}`;

  const result = await callGeminiJson<FashionIntelligence>(prompt, {
    ...FALLBACK_INTELLIGENCE,
    gender_context: defaultGenderContext,
  }, {
    temperature: 0.5,
    timeout: 8000,
  });

  // Validate gender_context is one of the allowed values
  const validContexts: GenderContext[] = ["masculine", "feminine", "androgynous", "fluid"];
  if (!validContexts.includes(result.gender_context)) {
    result.gender_context = defaultGenderContext;
  }

  return result;
}

/**
 * Build shared context for analysis modules
 */
export function buildSharedContext(
  userMessage: string,
  wardrobeSummary: string,
  fashionIntelligence: FashionIntelligence,
  bodyType?: string,
  styleKeywords?: string[]
): SharedContext {
  return {
    userMessage,
    wardrobeSummary,
    fashionIntelligence,
    bodyType,
    styleKeywords,
    genderContext: fashionIntelligence.gender_context,
  };
}

/**
 * Format shared context for LLM consumption
 */
export function formatSharedContextForLLM(context: SharedContext): string {
  return `USER MESSAGE:
${context.userMessage}

FASHION INTELLIGENCE:
- Vibe: ${context.fashionIntelligence.vibe}
- Aesthetic: ${context.fashionIntelligence.aesthetic}
- Fit Preference: ${context.fashionIntelligence.fit_preference}
- Color Direction: ${context.fashionIntelligence.color_direction}
- Occasion: ${context.fashionIntelligence.occasion}
- Mood: ${context.fashionIntelligence.mood}
- Styling Direction: ${context.fashionIntelligence.gender_context}

WARDROBE:
${context.wardrobeSummary}

${context.bodyType ? `BODY TYPE: ${context.bodyType}` : ""}
${context.styleKeywords?.length ? `STYLE KEYWORDS: ${context.styleKeywords.join(", ")}` : ""}`;
}

/**
 * Validate fashion intelligence output
 */
export function validateFashionIntelligence(
  fi: FashionIntelligence
): boolean {
  const validContexts: GenderContext[] = ["masculine", "feminine", "androgynous", "fluid"];
  return (
    typeof fi.vibe === "string" &&
    typeof fi.aesthetic === "string" &&
    typeof fi.fit_preference === "string" &&
    typeof fi.color_direction === "string" &&
    typeof fi.occasion === "string" &&
    typeof fi.mood === "string" &&
    validContexts.includes(fi.gender_context)
  );
}

/**
 * Get styling hints based on gender context
 */
export function getGenderContextStylingHints(genderContext: GenderContext): string[] {
  const hints: Record<GenderContext, string[]> = {
    masculine: [
      "Prefer structured silhouettes",
      "Angular, clean lines work well",
      "Tailored fits are flattering",
      "Minimalist accessories",
    ],
    feminine: [
      "Softer silhouettes welcome",
      "Flowing fabrics look great",
      "Waist definition is flattering",
      "Layered accessories work",
    ],
    androgynous: [
      "Balance structure with softness",
      "Gender-neutral pieces are ideal",
      "Versatile silhouettes preferred",
      "Clean, unfussy styling",
    ],
    fluid: [
      "Mix masculine and feminine freely",
      "Experiment with contrast",
      "Break traditional rules intentionally",
      "Personal expression over convention",
    ],
  };

  return hints[genderContext] || hints.androgynous;
}
