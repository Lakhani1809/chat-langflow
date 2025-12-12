/**
 * Body Type Analysis Module
 * Provides body-positive styling advice based on body type
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatSharedContextForLLM } from "./intelligence";
import type { BodyTypeAnalysis, SharedContext } from "../types";

const FALLBACK_BODY_ANALYSIS: BodyTypeAnalysis = {
  body_type: "balanced",
  flattering_styles: [
    "Fitted pieces that follow your natural shape",
    "Defined waist for structure",
    "Balanced proportions between top and bottom",
  ],
  rules: [
    "Choose items that fit well",
    "Balance fitted and relaxed pieces",
    "Highlight your favorite features",
  ],
  highlight_areas: ["waist", "shoulders"],
  balance_tips: [
    "Mix fitted with relaxed for visual interest",
  ],
  application: "Using balanced styling principles that work for all body types.",
};

/**
 * Analyze body type styling needs
 */
export async function analyzeBodyType(
  context: SharedContext
): Promise<BodyTypeAnalysis> {
  const formattedContext = formatSharedContextForLLM(context);

  const prompt = `You are a body-positive body type stylist for an AI fashion assistant.

${formattedContext}

TASK:
Provide body type styling advice. If body type isn't specified, gently infer or use general flattering principles.

Rules:
1. ALWAYS be positive and empowering - never mention weight, size, or "hiding" anything
2. Focus on "highlighting" and "balancing" instead of "hiding" or "minimizing"
3. Suggest styles from the user's wardrobe that would flatter
4. Consider the occasion and desired mood
5. Celebrate all body types

Provide:
1. body_type - Identified or inferred body type (e.g., "hourglass", "pear", "rectangle", "apple", "inverted triangle", or "balanced")
2. flattering_styles - 3 specific style recommendations
3. rules - 2-3 styling rules for this body type (positive framing only)
4. highlight_areas - Body areas to highlight/celebrate
5. balance_tips - Tips for creating visual balance
6. application - How to apply these rules to the current request using wardrobe items

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "body_type": "...",
  "flattering_styles": ["...", "...", "..."],
  "rules": ["...", "...", "..."],
  "highlight_areas": ["...", "..."],
  "balance_tips": ["...", "..."],
  "application": "..."
}`;

  return callGeminiJson<BodyTypeAnalysis>(prompt, FALLBACK_BODY_ANALYSIS, {
    temperature: 0.6,
    timeout: 8000,
  });
}

/**
 * Get styling tips for body type (body-positive framing)
 */
export function getBodyTypeStylingTips(bodyType: string): {
  highlights: string[];
  styling: string[];
  flattering: string[];
} {
  const tips: Record<string, { highlights: string[]; styling: string[]; flattering: string[] }> = {
    hourglass: {
      highlights: ["defined waist", "balanced curves", "natural symmetry"],
      styling: [
        "Embrace your waist with fitted styles",
        "Wrap dresses and tops celebrate your shape",
        "High-waisted pieces enhance your natural proportions",
      ],
      flattering: [
        "Belted pieces",
        "Bodycon dresses",
        "Wrap styles",
        "V-necks",
        "Pencil skirts",
      ],
    },
    pear: {
      highlights: ["elegant shoulders", "defined waist", "feminine curves"],
      styling: [
        "Draw attention to your beautiful shoulders and décolletage",
        "A-line silhouettes flow gracefully",
        "Statement tops create gorgeous balance",
      ],
      flattering: [
        "Boat necks",
        "Statement sleeves",
        "A-line skirts",
        "Wide leg pants",
        "Detailed tops",
      ],
    },
    apple: {
      highlights: ["gorgeous legs", "elegant bust", "strong shoulders"],
      styling: [
        "V-necks create elegant length",
        "Empire waists highlight your beautiful bust",
        "Show off those amazing legs",
      ],
      flattering: [
        "V-neck tops",
        "Empire waist dresses",
        "Structured jackets",
        "A-line shapes",
        "Knee-length skirts",
      ],
    },
    rectangle: {
      highlights: ["athletic frame", "long limbs", "versatile proportions"],
      styling: [
        "Create curves with peplums and belts",
        "Layering adds beautiful dimension",
        "Fit and flare creates lovely shape",
      ],
      flattering: [
        "Peplum tops",
        "Belted dresses",
        "Ruffled details",
        "Layered looks",
        "Fit and flare",
      ],
    },
    inverted_triangle: {
      highlights: ["strong shoulders", "elegant posture", "athletic build"],
      styling: [
        "Balance with volume on your lower half",
        "V-necks soften your shoulder line beautifully",
        "A-line skirts create gorgeous proportion",
      ],
      flattering: [
        "V-necks",
        "Scoop necks",
        "A-line skirts",
        "Wide leg pants",
        "Full skirts",
      ],
    },
    balanced: {
      highlights: ["natural proportions", "versatile frame", "flexibility"],
      styling: [
        "You can rock almost any silhouette",
        "Experiment with different styles",
        "Define your waist for extra polish",
      ],
      flattering: [
        "Most silhouettes work well",
        "Experiment freely",
        "Define waist for structure",
        "Play with proportions",
      ],
    },
  };

  const lowerType = bodyType.toLowerCase().replace(/[- ]/g, "_");
  
  for (const [key, value] of Object.entries(tips)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }

  return tips.balanced;
}

/**
 * Get body-positive affirmation for the response
 */
export function getBodyPositiveAffirmation(bodyType: string): string {
  const affirmations: Record<string, string> = {
    hourglass: "Your natural curves are gorgeous - let's celebrate them!",
    pear: "Your beautiful proportions give you so many stunning options!",
    apple: "Your shape is perfect for elegant, elongating styles!",
    rectangle: "Your versatile frame means you can pull off so many looks!",
    inverted_triangle: "Your strong shoulders are a stunning feature to play with!",
    balanced: "Your proportions give you amazing flexibility in styling!",
  };

  const lowerType = bodyType.toLowerCase().replace(/[- ]/g, "_");
  
  for (const [key, value] of Object.entries(affirmations)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }

  return "Every body is beautiful - let's find what makes you feel amazing!";
}

