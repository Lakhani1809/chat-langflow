/**
 * Safety Filter Against Hallucinations
 * Ensures outfit suggestions only include items from the user's wardrobe
 */

import type { WardrobeItem, Outfit, IntentType } from "../types";
import { getItemIdentifiers } from "./wardrobeFormatter";

// Intents that allow external item suggestions (up to 30%)
const EXTERNAL_ALLOWED_INTENTS: IntentType[] = [
  "shopping_help",
  "travel_packing",
  "trend_analysis",
];

const MAX_EXTERNAL_PERCENTAGE = 0.3; // 30%

/**
 * Filter outfits to only include valid wardrobe items
 */
export function filterOutfitsForSafety(
  outfits: Outfit[],
  wardrobeItems: WardrobeItem[],
  intent: IntentType
): Outfit[] {
  // If wardrobe is empty, allow all suggestions
  if (wardrobeItems.length === 0) {
    return outfits;
  }

  const allowExternal = EXTERNAL_ALLOWED_INTENTS.includes(intent);
  const identifiers = getItemIdentifiers(wardrobeItems);

  return outfits
    .map((outfit) => filterOutfitItems(outfit, identifiers, allowExternal))
    .filter((outfit) => outfit.items.length > 0);
}

/**
 * Filter individual outfit items
 */
function filterOutfitItems(
  outfit: Outfit,
  validIdentifiers: Set<string>,
  allowExternal: boolean
): Outfit {
  const validatedItems: string[] = [];
  const externalItems: string[] = [];

  for (const item of outfit.items) {
    const isValid = isItemInWardrobe(item, validIdentifiers);
    
    if (isValid) {
      validatedItems.push(item);
    } else if (allowExternal) {
      externalItems.push(item);
    }
  }

  // Calculate how many external items we can include
  const totalItems = outfit.items.length;
  const maxExternal = Math.floor(totalItems * MAX_EXTERNAL_PERCENTAGE);
  const allowedExternal = externalItems.slice(0, maxExternal);

  // Tag external items
  const taggedExternal = allowedExternal.map(
    (item) => `${item} (shopping suggestion)`
  );

  return {
    ...outfit,
    items: [...validatedItems, ...taggedExternal],
  };
}

/**
 * Check if an item description matches something in the wardrobe
 */
function isItemInWardrobe(
  itemDescription: string,
  validIdentifiers: Set<string>
): boolean {
  const lowerItem = itemDescription.toLowerCase();

  // Check for exact matches
  for (const identifier of validIdentifiers) {
    if (lowerItem.includes(identifier) || identifier.includes(lowerItem)) {
      return true;
    }
  }

  // Check for partial matches (color + generic category)
  const genericCategories = [
    "top",
    "tops",
    "shirt",
    "blouse",
    "t-shirt",
    "tee",
    "sweater",
    "hoodie",
    "jacket",
    "coat",
    "blazer",
    "cardigan",
    "pants",
    "jeans",
    "trousers",
    "shorts",
    "skirt",
    "dress",
    "jumpsuit",
    "romper",
    "shoes",
    "sneakers",
    "boots",
    "heels",
    "sandals",
    "flats",
    "loafers",
    "bag",
    "handbag",
    "purse",
    "backpack",
    "accessories",
    "jewelry",
    "watch",
    "belt",
    "scarf",
    "hat",
  ];

  for (const category of genericCategories) {
    if (lowerItem.includes(category)) {
      // Check if wardrobe has this category
      for (const identifier of validIdentifiers) {
        if (identifier.includes(category)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Filter item recommendations for safety
 */
export function filterItemsForSafety(
  items: string[],
  wardrobeItems: WardrobeItem[],
  intent: IntentType
): string[] {
  if (wardrobeItems.length === 0) {
    return items;
  }

  const allowExternal = EXTERNAL_ALLOWED_INTENTS.includes(intent);
  const identifiers = getItemIdentifiers(wardrobeItems);

  const validItems: string[] = [];
  const externalItems: string[] = [];

  for (const item of items) {
    const isValid = isItemInWardrobe(item, identifiers);
    
    if (isValid) {
      validItems.push(item);
    } else if (allowExternal) {
      externalItems.push(item);
    }
  }

  const maxExternal = Math.floor(items.length * MAX_EXTERNAL_PERCENTAGE);
  const taggedExternal = externalItems
    .slice(0, maxExternal)
    .map((item) => `${item} (shopping suggestion)`);

  return [...validItems, ...taggedExternal];
}

/**
 * Validate that outfit suggestions are grounded in wardrobe
 */
export function validateOutfitGrounding(
  outfit: Outfit,
  wardrobeItems: WardrobeItem[]
): {
  valid: boolean;
  groundedItems: string[];
  ungroundedItems: string[];
  groundingPercentage: number;
} {
  if (wardrobeItems.length === 0) {
    return {
      valid: true,
      groundedItems: outfit.items,
      ungroundedItems: [],
      groundingPercentage: 100,
    };
  }

  const identifiers = getItemIdentifiers(wardrobeItems);
  const groundedItems: string[] = [];
  const ungroundedItems: string[] = [];

  for (const item of outfit.items) {
    if (isItemInWardrobe(item, identifiers)) {
      groundedItems.push(item);
    } else {
      ungroundedItems.push(item);
    }
  }

  const groundingPercentage =
    outfit.items.length > 0
      ? (groundedItems.length / outfit.items.length) * 100
      : 100;

  return {
    valid: groundingPercentage >= 50, // At least 50% grounded
    groundedItems,
    ungroundedItems,
    groundingPercentage,
  };
}

/**
 * Apply safety filter to final response
 */
export function applySafetyFilter(
  response: {
    outfits?: Outfit[];
    items?: string[];
    packing_list?: string[];
  },
  wardrobeItems: WardrobeItem[],
  intent: IntentType
): {
  outfits?: Outfit[];
  items?: string[];
  packing_list?: string[];
} {
  const filtered = { ...response };

  if (filtered.outfits) {
    filtered.outfits = filterOutfitsForSafety(
      filtered.outfits,
      wardrobeItems,
      intent
    );
  }

  if (filtered.items) {
    filtered.items = filterItemsForSafety(
      filtered.items,
      wardrobeItems,
      intent
    );
  }

  // Packing list can have more external items for travel
  if (filtered.packing_list && intent === "travel_packing") {
    // Allow up to 50% external for packing lists
    const identifiers = getItemIdentifiers(wardrobeItems);
    filtered.packing_list = filtered.packing_list.map((item) => {
      if (!isItemInWardrobe(item, identifiers)) {
        return `${item} (to pack/buy)`;
      }
      return item;
    });
  }

  return filtered;
}

