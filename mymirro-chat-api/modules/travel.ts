/**
 * Travel Packing Module
 * Creates packing lists and travel outfit suggestions
 */

import { callGeminiJson } from "../utils/geminiClient";
import { formatRulesForModule } from "../analysis/rules";
import type {
  TravelPackingOutput,
  Outfit,
  RulesEngineOutput,
  WardrobeContext,
  FashionIntelligence,
} from "../types";
import { formatWardrobeForLLM } from "../utils/wardrobeFormatter";

const FALLBACK_OUTPUT: TravelPackingOutput = {
  packing_list: [
    "Versatile tops (2-3)",
    "Comfortable bottoms (2)",
    "Layering piece",
    "Comfortable walking shoes",
    "Evening option",
  ],
  outfits: [
    {
      title: "Travel Day Look",
      items: ["Comfortable top", "Easy pants", "Sneakers"],
      why_it_works: "Comfortable for transit while still put-together",
    },
  ],
  shopping_gaps: [],
  packing_tips: ["Roll clothes to save space", "Stick to a color palette"],
};

/**
 * Create travel packing recommendations
 */
export async function createTravelPacking(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence
): Promise<TravelPackingOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const prompt = `You are MyMirro, an expert AI fashion stylist specializing in travel packing.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Occasion: ${fashionIntelligence.occasion}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Create a capsule packing list and travel outfits.

Requirements:
1. Create a practical packing list prioritizing wardrobe items
2. Design 3-4 mix-and-match outfits from the packing list
3. Identify items they might need to pack that aren't in wardrobe
4. Provide packing tips

Consider:
- Destination/weather (infer from request)
- Trip duration (infer from request)
- Activities planned
- Versatility and mix-matching
- Wrinkle-resistance for travel

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "packing_list": [
    "specific item from wardrobe",
    "another item",
    "item they should pack (mark if not in wardrobe)"
  ],
  "outfits": [
    {
      "title": "Day 1: Exploration Look",
      "items": ["item 1", "item 2", "item 3"],
      "why_it_works": "...",
      "occasion": "sightseeing"
    }
  ],
  "shopping_gaps": ["items they might want to buy for the trip"],
  "packing_tips": ["practical tip 1", "tip 2"]
}`;

  return callGeminiJson<TravelPackingOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2500,
  });
}

/**
 * Extract trip details from message
 */
export function extractTripDetails(message: string): {
  destination?: string;
  duration?: string;
  activities?: string[];
  weather?: string;
} {
  const lowerMessage = message.toLowerCase();
  const details: {
    destination?: string;
    duration?: string;
    activities?: string[];
    weather?: string;
  } = {};

  // Extract duration
  const durationMatch = lowerMessage.match(
    /(\d+)\s*(day|days|night|nights|week|weeks)/
  );
  if (durationMatch) {
    details.duration = `${durationMatch[1]} ${durationMatch[2]}`;
  }

  // Extract weather hints
  const weatherKeywords: Record<string, string> = {
    beach: "warm/tropical",
    summer: "hot",
    winter: "cold",
    mountains: "cool/variable",
    tropical: "hot/humid",
    europe: "mild/variable",
    cold: "cold",
    hot: "hot",
    rainy: "wet",
  };

  for (const [keyword, weather] of Object.entries(weatherKeywords)) {
    if (lowerMessage.includes(keyword)) {
      details.weather = weather;
      break;
    }
  }

  // Extract activities
  const activities: string[] = [];
  const activityKeywords = [
    "sightseeing",
    "hiking",
    "beach",
    "dinner",
    "party",
    "wedding",
    "business",
    "meeting",
    "exploring",
    "shopping",
    "museum",
  ];

  for (const activity of activityKeywords) {
    if (lowerMessage.includes(activity)) {
      activities.push(activity);
    }
  }
  if (activities.length > 0) {
    details.activities = activities;
  }

  return details;
}

/**
 * Get packing essentials by trip type
 */
export function getPackingEssentials(
  tripType: string
): { category: string; items: string[] }[] {
  const essentials: Record<string, { category: string; items: string[] }[]> = {
    beach: [
      { category: "Swimwear", items: ["swimsuit", "cover-up"] },
      { category: "Tops", items: ["tank tops", "light tees", "linen shirt"] },
      { category: "Bottoms", items: ["shorts", "flowy skirt", "linen pants"] },
      { category: "Shoes", items: ["sandals", "flip flops", "espadrilles"] },
      { category: "Accessories", items: ["sun hat", "sunglasses", "beach bag"] },
    ],
    city: [
      { category: "Tops", items: ["versatile blouses", "tees", "light sweater"] },
      { category: "Bottoms", items: ["jeans", "dress pants", "skirt"] },
      { category: "Shoes", items: ["walking sneakers", "nice flats", "ankle boots"] },
      { category: "Outerwear", items: ["light jacket", "cardigan"] },
      { category: "Evening", items: ["nice top or dress for dinners"] },
    ],
    business: [
      { category: "Tops", items: ["dress shirts", "blouses", "professional tops"] },
      { category: "Bottoms", items: ["dress pants", "pencil skirt", "tailored trousers"] },
      { category: "Shoes", items: ["professional heels or loafers", "comfortable option"] },
      { category: "Outerwear", items: ["blazer", "structured jacket"] },
      { category: "Accessories", items: ["laptop bag", "professional accessories"] },
    ],
    adventure: [
      { category: "Tops", items: ["moisture-wicking tees", "layers", "fleece"] },
      { category: "Bottoms", items: ["hiking pants", "convertible pants", "leggings"] },
      { category: "Shoes", items: ["hiking boots", "trail shoes", "sandals"] },
      { category: "Outerwear", items: ["rain jacket", "down layer", "windbreaker"] },
      { category: "Gear", items: ["backpack", "hat", "sunglasses"] },
    ],
  };

  return essentials[tripType.toLowerCase()] || essentials.city;
}

/**
 * Calculate minimum items needed for trip length
 */
export function calculatePackingQuantities(
  days: number
): Record<string, number> {
  return {
    tops: Math.min(days, 5),
    bottoms: Math.ceil(days / 2),
    underwear: days + 1,
    sleepwear: 1,
    shoes: Math.min(3, Math.ceil(days / 3) + 1),
    outerwear: 1,
    evening_options: Math.ceil(days / 3),
  };
}

