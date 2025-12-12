/**
 * Module Exports and Router
 */

export { generateOutfits, generateMoreOutfits } from "./outfit";
export { recommendItems, findMatchingItems, recommendPairings } from "./items";
export { recommendByCategory, extractCategory, getItemsInCategory } from "./category";
export { provideShoppingHelp, getBrandsByAesthetic, getIndianBrandAlternatives, identifyWardrobeGaps } from "./shopping";
export { createTravelPacking, extractTripDetails, getPackingEssentials, calculatePackingQuantities } from "./travel";
export { analyzeTrends, getCurrentTrends, matchWardrobeToTrends, getTrendAdviceForAesthetic } from "./trends";

import type {
  IntentType,
  WardrobeContext,
  RulesEngineOutput,
  FashionIntelligence,
  ConversationMemory,
  Outfit,
} from "../types";

import { generateOutfits, generateMoreOutfits } from "./outfit";
import { recommendItems } from "./items";
import { recommendByCategory, extractCategory } from "./category";
import { provideShoppingHelp } from "./shopping";
import { createTravelPacking } from "./travel";
import { analyzeTrends } from "./trends";

/**
 * Route to appropriate module based on intent
 */
export async function routeToModule(
  intent: IntentType,
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence,
  memory?: ConversationMemory
): Promise<{
  moduleName: string;
  output: unknown;
}> {
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
      return {
        moduleName: "outfit",
        output: await generateOutfits(
          userMessage,
          wardrobeContext,
          rules,
          fashionIntelligence,
          memory
        ),
      };

    case "item_recommendation":
    case "wardrobe_query":
      return {
        moduleName: "items",
        output: await recommendItems(
          userMessage,
          wardrobeContext,
          rules,
          fashionIntelligence
        ),
      };

    case "category_recommendation":
      const category = extractCategory(userMessage);
      return {
        moduleName: "category",
        output: await recommendByCategory(
          userMessage,
          category,
          wardrobeContext,
          fashionIntelligence
        ),
      };

    case "shopping_help":
      return {
        moduleName: "shopping",
        output: await provideShoppingHelp(
          userMessage,
          wardrobeContext,
          fashionIntelligence
        ),
      };

    case "travel_packing":
      return {
        moduleName: "travel",
        output: await createTravelPacking(
          userMessage,
          wardrobeContext,
          rules,
          fashionIntelligence
        ),
      };

    case "trend_analysis":
      return {
        moduleName: "trends",
        output: await analyzeTrends(
          userMessage,
          wardrobeContext,
          fashionIntelligence
        ),
      };

    case "color_analysis":
      // Return color analysis directly (already computed)
      return {
        moduleName: "color",
        output: {
          message: "Here's your color analysis!",
          // The actual color analysis is passed separately
        },
      };

    case "body_type_advice":
      // Return body type analysis directly (already computed)
      return {
        moduleName: "body",
        output: {
          message: "Here's styling advice for your body type!",
          // The actual body analysis is passed separately
        },
      };

    case "continuation_query":
      // Get more options based on previous output
      if (memory?.lastOutfitSuggestions && memory.lastOutfitSuggestions.length > 0) {
        return {
          moduleName: "outfit_continuation",
          output: await generateMoreOutfits(
            memory.lastOutfitSuggestions,
            wardrobeContext,
            rules,
            fashionIntelligence
          ),
        };
      }
      // Fall through to general if no previous context
      return {
        moduleName: "general",
        output: { message: "What would you like more options for?" },
      };

    case "general_chat":
    default:
      return {
        moduleName: "general",
        output: { message: "" }, // Will be handled by general chat
      };
  }
}

/**
 * Extract outfits from module output
 */
export function extractOutfitsFromOutput(
  moduleName: string,
  output: unknown
): Outfit[] {
  if (!output || typeof output !== "object") return [];

  const obj = output as Record<string, unknown>;

  if ("outfits" in obj && Array.isArray(obj.outfits)) {
    return obj.outfits as Outfit[];
  }

  return [];
}

/**
 * Extract items from module output
 */
export function extractItemsFromOutput(
  moduleName: string,
  output: unknown
): string[] {
  if (!output || typeof output !== "object") return [];

  const obj = output as Record<string, unknown>;

  if ("items" in obj && Array.isArray(obj.items)) {
    return obj.items as string[];
  }

  if ("recommended_items" in obj && Array.isArray(obj.recommended_items)) {
    return obj.recommended_items as string[];
  }

  if ("packing_list" in obj && Array.isArray(obj.packing_list)) {
    return obj.packing_list as string[];
  }

  return [];
}

