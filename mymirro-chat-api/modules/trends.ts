/**
 * Trend Analysis Module
 * Analyzes fashion trends and how users can incorporate them
 */

import { callGeminiJson } from "../utils/geminiClient";
import type {
  TrendAnalysisOutput,
  WardrobeContext,
  FashionIntelligence,
} from "../types";
import { formatWardrobeForLLM } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: TrendAnalysisOutput = {
  trend_summary: "Current fashion trends focus on versatility and personal expression.",
  how_user_can_wear_it: "Incorporate trending elements using pieces you already own.",
  items_to_use: [],
  trend_longevity: "These styles are expected to remain relevant for the coming seasons.",
};

/**
 * Analyze trends and how user can incorporate them
 */
export async function analyzeTrends(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  fashionIntelligence: FashionIntelligence
): Promise<TrendAnalysisOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);

  const prompt = `You are MyMirro, an expert AI fashion stylist with deep knowledge of current trends.

USER REQUEST:
"${userMessage}"

USER'S AESTHETIC:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Style: ${fashionIntelligence.fit_preference}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Provide trend analysis and practical application advice.

Requirements:
1. Identify relevant trends based on the user's question or aesthetic
2. Explain how to incorporate these trends using their existing wardrobe
3. Be specific about which wardrobe items work for the trends
4. Provide honest assessment of trend longevity

Consider:
- Current 2024-2025 fashion trends
- Indian fashion context and local trends
- Gen-Z style preferences
- Practical wearability

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "trend_summary": "Overview of relevant trends...",
  "how_user_can_wear_it": "Specific advice on incorporating with their wardrobe...",
  "items_to_use": ["specific item from wardrobe", "another item that works"],
  "trend_longevity": "Assessment of how long this trend will last..."
}`;

  return callGeminiJson<TrendAnalysisOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.8,
    timeout: 10000,
  });
}

/**
 * Get current trend information
 */
export function getCurrentTrends(): {
  name: string;
  description: string;
  key_pieces: string[];
  longevity: string;
}[] {
  return [
    {
      name: "Quiet Luxury",
      description: "Understated elegance with quality fabrics and minimal branding",
      key_pieces: ["cashmere sweaters", "tailored trousers", "leather accessories", "neutral tones"],
      longevity: "Long-term trend, evolving into a permanent style category",
    },
    {
      name: "Mob Wife Aesthetic",
      description: "Bold, glamorous looks with fur, leopard print, and gold accents",
      key_pieces: ["faux fur coats", "gold jewelry", "leopard print", "red lips"],
      longevity: "Peak trend for 2024, may evolve by mid-2025",
    },
    {
      name: "Coquette",
      description: "Feminine, romantic style with bows, lace, and soft colors",
      key_pieces: ["bows", "ballet flats", "lace details", "pink tones", "pearls"],
      longevity: "Strong through 2024, softening into general romantic style",
    },
    {
      name: "Athleisure Evolution",
      description: "Elevated sportswear that transitions from gym to street",
      key_pieces: ["matching sets", "sneakers", "bomber jackets", "track pants"],
      longevity: "Permanent style category, continuously evolving",
    },
    {
      name: "Cherry Red",
      description: "Bold cherry/burgundy red as the color of the season",
      key_pieces: ["red dress", "red bag", "red shoes", "red lipstick"],
      longevity: "Strong for Fall/Winter 2024, transitioning to new colors",
    },
    {
      name: "Indie Sleaze Revival",
      description: "2000s-inspired edgy, grungy style",
      key_pieces: ["skinny jeans", "band tees", "leather jackets", "messy hair"],
      longevity: "Growing trend, expected to peak in 2025",
    },
    {
      name: "Minimalist Workwear",
      description: "Clean, professional aesthetics with modern twists",
      key_pieces: ["tailored blazers", "wide-leg trousers", "structured bags", "pointed shoes"],
      longevity: "Permanent professional style evolution",
    },
    {
      name: "Coastal Grandmother",
      description: "Relaxed, elegant style inspired by seaside living",
      key_pieces: ["linen pieces", "soft knits", "neutral colors", "comfortable elegance"],
      longevity: "Evolved into permanent relaxed-chic category",
    },
  ];
}

/**
 * Match user wardrobe to trends
 */
export function matchWardrobeToTrends(
  wardrobeContext: WardrobeContext
): { trend: string; matching_items: string[] }[] {
  const trends = getCurrentTrends();
  const matches: { trend: string; matching_items: string[] }[] = [];

  for (const trend of trends) {
    const matchingItems: string[] = [];

    for (const item of wardrobeContext.wardrobe_items) {
      const itemText = `${item.name} ${item.color} ${item.category} ${item.style_aesthetic?.join(" ")}`.toLowerCase();

      for (const keyPiece of trend.key_pieces) {
        if (itemText.includes(keyPiece.toLowerCase())) {
          matchingItems.push(item.name || `${item.color} ${item.category}`);
          break;
        }
      }
    }

    if (matchingItems.length > 0) {
      matches.push({
        trend: trend.name,
        matching_items: matchingItems,
      });
    }
  }

  return matches;
}

/**
 * Get trend advice based on aesthetic
 */
export function getTrendAdviceForAesthetic(aesthetic: string): string {
  const advice: Record<string, string> = {
    minimalist: "Focus on Quiet Luxury and Minimalist Workwear trends - they align perfectly with your aesthetic.",
    streetwear: "The Indie Sleaze Revival and evolved Athleisure trends will resonate with your style.",
    bohemian: "Adapt the Coastal Grandmother trend with your bohemian pieces for a fresh take.",
    romantic: "The Coquette trend is made for you - embrace bows, soft colors, and feminine details.",
    edgy: "Mob Wife Aesthetic and Indie Sleaze both offer bold options for your wardrobe.",
    preppy: "Quiet Luxury is your perfect trend match - focus on quality and subtle elegance.",
    vintage: "Mix Indie Sleaze with your vintage pieces for an authentic, curated look.",
  };

  const lowerAesthetic = aesthetic.toLowerCase();
  
  for (const [key, value] of Object.entries(advice)) {
    if (lowerAesthetic.includes(key)) {
      return value;
    }
  }

  return "Focus on trends that enhance your personal style rather than completely changing it.";
}

