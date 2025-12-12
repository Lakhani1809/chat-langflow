/**
 * Outfit Image Resolver
 * Matches LLM item hints to real wardrobe items and attaches images
 * LLMs output logical references only - this utility resolves to actual images
 */

import type {
  WardrobeItem,
  Outfit,
  VisualOutfit,
  VisualOutfitItem,
  OutfitItemLayer,
  OutfitLayout,
} from "../types";

/**
 * Layer priority for display ordering
 */
const LAYER_PRIORITY: Record<OutfitItemLayer, number> = {
  outer: 1,
  top: 2,
  "one-piece": 2,
  dress: 2,
  bottom: 3,
  shoes: 4,
  accessory: 5,
};

/**
 * Category to layer mapping
 */
const CATEGORY_TO_LAYER: Record<string, OutfitItemLayer> = {
  // Tops
  top: "top",
  tops: "top",
  shirt: "top",
  blouse: "top",
  tee: "top",
  "t-shirt": "top",
  sweater: "top",
  hoodie: "top",
  tank: "top",
  polo: "top",
  crop: "top",
  
  // Bottoms
  bottom: "bottom",
  bottoms: "bottom",
  pants: "bottom",
  jeans: "bottom",
  trousers: "bottom",
  shorts: "bottom",
  skirt: "bottom",
  leggings: "bottom",
  
  // One-pieces
  dress: "dress",
  dresses: "dress",
  jumpsuit: "one-piece",
  romper: "one-piece",
  
  // Outerwear
  jacket: "outer",
  coat: "outer",
  blazer: "outer",
  cardigan: "outer",
  outerwear: "outer",
  hoodie: "outer",
  
  // Shoes
  shoe: "shoes",
  shoes: "shoes",
  sneakers: "shoes",
  heels: "shoes",
  boots: "shoes",
  sandals: "shoes",
  flats: "shoes",
  loafers: "shoes",
  
  // Accessories
  accessory: "accessory",
  accessories: "accessory",
  bag: "accessory",
  handbag: "accessory",
  purse: "accessory",
  jewelry: "accessory",
  watch: "accessory",
  belt: "accessory",
  scarf: "accessory",
  hat: "accessory",
  sunglasses: "accessory",
};

/**
 * Determine layer from item description or category
 */
function determineLayer(item: WardrobeItem, hintText?: string): OutfitItemLayer {
  const searchText = `${item.category} ${item.item_type} ${item.name} ${hintText || ""}`.toLowerCase();
  
  // Check for specific layer keywords
  for (const [keyword, layer] of Object.entries(CATEGORY_TO_LAYER)) {
    if (searchText.includes(keyword)) {
      return layer;
    }
  }
  
  // Default based on category
  const categoryLower = (item.category || "").toLowerCase();
  return CATEGORY_TO_LAYER[categoryLower] || "accessory";
}

/**
 * Calculate similarity score between item hint and wardrobe item
 */
function calculateSimilarity(hint: string, item: WardrobeItem): number {
  const hintLower = hint.toLowerCase();
  let score = 0;
  
  // Name match (highest weight)
  const itemName = (item.name || "").toLowerCase();
  if (itemName && hintLower.includes(itemName)) {
    score += 50;
  } else if (itemName) {
    // Partial name match
    const nameWords = itemName.split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && hintLower.includes(word)) {
        score += 15;
      }
    }
  }
  
  // Color match
  const itemColor = (item.color || item.primary_color || "").toLowerCase();
  if (itemColor && hintLower.includes(itemColor)) {
    score += 25;
  }
  
  // Category match
  const itemCategory = (item.category || "").toLowerCase();
  if (itemCategory && hintLower.includes(itemCategory)) {
    score += 20;
  }
  
  // Item type match
  const itemType = (item.item_type || "").toLowerCase();
  if (itemType && hintLower.includes(itemType)) {
    score += 20;
  }
  
  // Fabric match
  const fabric = (item.fabric || "").toLowerCase();
  if (fabric && hintLower.includes(fabric)) {
    score += 10;
  }
  
  // Fit match
  const fit = (item.fit || "").toLowerCase();
  if (fit && hintLower.includes(fit)) {
    score += 10;
  }
  
  // Style aesthetic match
  if (item.style_aesthetic) {
    for (const style of item.style_aesthetic) {
      if (hintLower.includes(style.toLowerCase())) {
        score += 8;
      }
    }
  }
  
  return score;
}

/**
 * Find best matching wardrobe item for a hint
 */
function findBestMatch(
  hint: string,
  wardrobeItems: WardrobeItem[],
  usedItemIds: Set<string | number>
): WardrobeItem | null {
  let bestMatch: WardrobeItem | null = null;
  let bestScore = 0;
  
  for (const item of wardrobeItems) {
    // Skip already used items
    if (usedItemIds.has(item.id)) continue;
    
    // Skip items without images
    if (!item.processed_image_url && !item.image_url) continue;
    
    const score = calculateSimilarity(hint, item);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  // Only return if we have a reasonable match
  return bestScore >= 15 ? bestMatch : null;
}

/**
 * Determine optimal layout based on number of items
 */
function determineLayout(itemCount: number): OutfitLayout {
  switch (itemCount) {
    case 1:
      return "1x1";
    case 2:
      return "2x1";
    case 3:
      return "3x1";
    case 4:
    default:
      return "2x2";
  }
}

/**
 * Resolve outfit items to visual items with images
 */
export function resolveOutfitImages(
  outfit: Outfit,
  wardrobeItems: WardrobeItem[]
): VisualOutfit {
  const usedItemIds = new Set<string | number>();
  const resolvedItems: VisualOutfitItem[] = [];
  
  // Process each item hint
  for (const itemHint of outfit.items) {
    const matchedItem = findBestMatch(itemHint, wardrobeItems, usedItemIds);
    
    if (matchedItem) {
      usedItemIds.add(matchedItem.id);
      
      const layer = determineLayer(matchedItem, itemHint);
      const imageUrl = matchedItem.processed_image_url || matchedItem.image_url || "";
      
      if (imageUrl) {
        resolvedItems.push({
          id: String(matchedItem.id),
          name: matchedItem.name || `${matchedItem.color} ${matchedItem.category}`,
          image_url: imageUrl,
          layer,
        });
      }
    }
  }
  
  // Sort by layer priority
  resolvedItems.sort((a, b) => LAYER_PRIORITY[a.layer] - LAYER_PRIORITY[b.layer]);
  
  // Limit to reasonable number for display
  const displayItems = resolvedItems.slice(0, 4);
  
  return {
    title: outfit.title,
    layout: determineLayout(displayItems.length),
    items: displayItems,
    why_it_works: outfit.why_it_works,
    occasion: outfit.occasion,
    vibe: outfit.vibe,
  };
}

/**
 * Resolve multiple outfits to visual outfits
 */
export function resolveAllOutfitImages(
  outfits: Outfit[],
  wardrobeItems: WardrobeItem[]
): VisualOutfit[] {
  return outfits.map((outfit) => resolveOutfitImages(outfit, wardrobeItems));
}

/**
 * Check if an outfit has enough resolved images to display
 */
export function hasEnoughImages(visualOutfit: VisualOutfit): boolean {
  return visualOutfit.items.length >= 1;
}

/**
 * Filter outfits to only those with sufficient images
 */
export function filterOutfitsWithImages(visualOutfits: VisualOutfit[]): VisualOutfit[] {
  return visualOutfits.filter(hasEnoughImages);
}

/**
 * Create a fallback visual outfit when image resolution fails
 */
export function createFallbackVisualOutfit(outfit: Outfit): VisualOutfit {
  return {
    title: outfit.title,
    layout: "2x1",
    items: [],
    why_it_works: outfit.why_it_works,
    occasion: outfit.occasion,
    vibe: outfit.vibe,
  };
}

