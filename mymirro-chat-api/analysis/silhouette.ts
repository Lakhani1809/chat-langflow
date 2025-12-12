/**
 * Silhouette & Proportion Analysis Module
 * Analyzes outfit structures, proportions, and layering
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatSharedContextForLLM } from "./intelligence";
import type { SilhouetteAnalysis, SharedContext } from "../types";

const FALLBACK_SILHOUETTE_ANALYSIS: SilhouetteAnalysis = {
  silhouette_verdict: "balanced proportions",
  recommended_structures: [
    "fitted top with relaxed bottom",
    "tucked top with high-waisted bottom",
  ],
  proportion_tips: [
    "Balance fitted pieces with looser ones",
    "Define waist for flattering silhouette",
  ],
  layering_suggestions: [
    "Add a structured outer layer for polish",
  ],
  notes: "Using balanced proportion principles for versatile styling.",
};

/**
 * Analyze silhouette and proportions
 */
export async function analyzeSilhouette(
  context: SharedContext
): Promise<SilhouetteAnalysis> {
  const formattedContext = formatSharedContextForLLM(context);

  const prompt = `You are a silhouette and proportion expert for an AI stylist.

${formattedContext}

TASK:
Analyze the user's wardrobe and request to provide silhouette and proportion advice.

Rules:
1. ONLY suggest structures using items from the wardrobe
2. Consider body type if mentioned
3. Balance proportions (fitted with loose, cropped with high-waisted, etc.)
4. Suggest layering options from available items
5. Keep the occasion and mood in mind

Provide:
1. silhouette_verdict - Overall silhouette direction (e.g., "column silhouette", "A-line balance")
2. recommended_structures - 2-3 outfit structures (e.g., "fitted top + wide leg pants")
3. proportion_tips - 2-3 specific proportion guidelines
4. layering_suggestions - 1-2 layering ideas using wardrobe items
5. notes - Additional styling notes

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "silhouette_verdict": "...",
  "recommended_structures": ["...", "..."],
  "proportion_tips": ["...", "..."],
  "layering_suggestions": ["..."],
  "notes": "..."
}`;

  return callGeminiJson<SilhouetteAnalysis>(prompt, FALLBACK_SILHOUETTE_ANALYSIS, {
    temperature: 0.6,
    timeout: 8000,
  });
}

/**
 * Get silhouette rules for body type
 */
export function getSilhouetteRulesForBodyType(
  bodyType: string
): { recommended: string[]; avoid: string[] } {
  const rules: Record<string, { recommended: string[]; avoid: string[] }> = {
    hourglass: {
      recommended: [
        "Fitted at waist",
        "Wrap styles",
        "Belted pieces",
        "V-neck tops",
        "Pencil skirts",
        "High-waisted bottoms",
      ],
      avoid: [
        "Boxy shapes that hide waist",
        "Very baggy oversized pieces",
        "Shapeless shift dresses",
      ],
    },
    pear: {
      recommended: [
        "A-line skirts",
        "Wide leg pants",
        "Detailed tops to draw eye up",
        "Boat necks",
        "Statement sleeves",
        "Dark bottoms",
      ],
      avoid: [
        "Skinny jeans without longer top",
        "Clingy fabrics on hips",
        "Horizontal stripes on bottom",
      ],
    },
    apple: {
      recommended: [
        "V-necks to elongate",
        "Empire waist",
        "A-line shapes",
        "Structured jackets",
        "Vertical details",
        "Flowy fabrics",
      ],
      avoid: [
        "Clingy fabrics at midsection",
        "High-waisted tight fits",
        "Cropped tops",
      ],
    },
    rectangle: {
      recommended: [
        "Create waist definition",
        "Peplum tops",
        "Belted pieces",
        "Layering for dimension",
        "Curved hems",
        "Fit and flare",
      ],
      avoid: [
        "Straight up-and-down shapes",
        "Boxy without waist detail",
      ],
    },
    inverted_triangle: {
      recommended: [
        "A-line skirts",
        "Wide leg pants",
        "V-necks to narrow shoulders",
        "Darker tops",
        "Volume on bottom half",
        "Simple necklines",
      ],
      avoid: [
        "Shoulder pads",
        "Puff sleeves",
        "Horizontal stripes on top",
        "Boat necks",
      ],
    },
  };

  const lowerType = bodyType.toLowerCase().replace(/[- ]/g, "_");
  
  for (const [key, value] of Object.entries(rules)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }

  // Default balanced rules
  return {
    recommended: [
      "Balanced proportions",
      "Define natural waist",
      "Mix fitted and relaxed",
    ],
    avoid: [
      "Overly baggy all over",
      "Overly tight all over",
    ],
  };
}

/**
 * Suggest outfit structure based on occasion
 */
export function suggestStructureForOccasion(
  occasion: string
): string[] {
  const structures: Record<string, string[]> = {
    date: [
      "Fitted top + high-waisted pants/skirt",
      "Wrap dress with heels",
      "Tucked blouse + midi skirt",
    ],
    office: [
      "Tailored blazer + trousers",
      "Structured top + pencil skirt",
      "Sheath dress + cardigan",
    ],
    casual: [
      "Relaxed tee + jeans",
      "Oversized sweater + leggings",
      "Button-down + shorts/chinos",
    ],
    party: [
      "Statement top + sleek pants",
      "Mini dress + structured jacket",
      "Crop top + high-waisted wide leg",
    ],
    brunch: [
      "Flowy blouse + jeans",
      "Sundress + denim jacket",
      "Linen set",
    ],
    travel: [
      "Comfortable layers",
      "Stretchy pants + oversized top",
      "Easy dress + sneakers",
    ],
  };

  const lowerOccasion = occasion.toLowerCase();
  
  for (const [key, value] of Object.entries(structures)) {
    if (lowerOccasion.includes(key)) {
      return value;
    }
  }

  return [
    "Fitted top + relaxed bottom",
    "Balanced proportions with defined waist",
  ];
}

