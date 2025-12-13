/**
 * V2 Wardrobe Coverage Utility
 * Computes coverage profile to inform constraint-aware generation
 */

import type {
  WardrobeItem,
  WardrobeCoverageProfile,
  CategoryCoverage,
  CoverageLevel,
  OutfitSlot,
} from "../types";

// ============================================
// COVERAGE THRESHOLDS
// ============================================

const COVERAGE_THRESHOLDS = {
  none: 0,
  low: 1,
  medium: 3,
  high: 5,
};

// ============================================
// CATEGORY MAPPING
// ============================================

/**
 * Map wardrobe item categories to coverage categories
 */
function mapToCoverageCategory(item: WardrobeItem): keyof WardrobeCoverageProfile | null {
  const category = (item.category || "").toLowerCase();
  const itemType = (item.item_type || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  
  // Tops
  if (category.includes("top") || category.includes("shirt") || 
      category.includes("blouse") || category.includes("tee") ||
      itemType.includes("shirt") || itemType.includes("top")) {
    return "tops";
  }
  
  // Bottoms
  if (category.includes("bottom") || category.includes("pant") ||
      category.includes("jean") || category.includes("short") ||
      category.includes("skirt") || category.includes("trouser")) {
    return "bottoms";
  }
  
  // Footwear
  if (category.includes("shoe") || category.includes("footwear") ||
      category.includes("sneaker") || category.includes("boot") ||
      category.includes("sandal") || category.includes("heel")) {
    return "footwear";
  }
  
  // Outerwear
  if (category.includes("outer") || category.includes("jacket") ||
      category.includes("coat") || category.includes("blazer") ||
      category.includes("cardigan") || category.includes("sweater")) {
    return "outerwear";
  }
  
  // Accessories
  if (category.includes("accessor") || category.includes("bag") ||
      category.includes("belt") || category.includes("watch") ||
      category.includes("jewelry") || category.includes("scarf")) {
    return "accessories";
  }
  
  // Ethnic
  if (category.includes("ethnic") || category.includes("traditional") ||
      name.includes("kurta") || name.includes("saree") ||
      name.includes("lehenga")) {
    return "ethnic";
  }
  
  // Dresses
  if (category.includes("dress") || itemType.includes("dress") ||
      name.includes("dress") || name.includes("jumpsuit")) {
    return "dresses";
  }
  
  // Try to infer from name/itemType
  if (name.includes("jacket") || name.includes("coat")) return "outerwear";
  if (name.includes("shoe") || name.includes("sneaker")) return "footwear";
  
  return null;
}

/**
 * Check if item has an image
 */
function hasImage(item: WardrobeItem): boolean {
  return !!(item.processed_image_url || item.image_url);
}

/**
 * Determine coverage level from count
 */
function getCoverageLevel(count: number): CoverageLevel {
  if (count >= COVERAGE_THRESHOLDS.high) return "high";
  if (count >= COVERAGE_THRESHOLDS.medium) return "medium";
  if (count >= COVERAGE_THRESHOLDS.low) return "low";
  return "none";
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Compute wardrobe coverage profile
 */
export function computeWardrobeCoverage(
  wardrobeItems: WardrobeItem[]
): WardrobeCoverageProfile {
  // Initialize counts
  const categoryCounts: Record<string, { count: number; withImages: number }> = {
    tops: { count: 0, withImages: 0 },
    bottoms: { count: 0, withImages: 0 },
    footwear: { count: 0, withImages: 0 },
    outerwear: { count: 0, withImages: 0 },
    accessories: { count: 0, withImages: 0 },
    ethnic: { count: 0, withImages: 0 },
    dresses: { count: 0, withImages: 0 },
  };

  // Count items per category
  for (const item of wardrobeItems) {
    const coverageCategory = mapToCoverageCategory(item);
    if (coverageCategory && categoryCounts[coverageCategory]) {
      categoryCounts[coverageCategory].count++;
      if (hasImage(item)) {
        categoryCounts[coverageCategory].withImages++;
      }
    }
  }

  // Build category coverage objects
  const buildCoverage = (key: string): CategoryCoverage => ({
    count: categoryCounts[key].count,
    withImages: categoryCounts[key].withImages,
    level: getCoverageLevel(categoryCounts[key].count),
  });

  const tops = buildCoverage("tops");
  const bottoms = buildCoverage("bottoms");
  const footwear = buildCoverage("footwear");
  const outerwear = buildCoverage("outerwear");
  const accessories = buildCoverage("accessories");
  const ethnic = buildCoverage("ethnic");
  const dresses = buildCoverage("dresses");

  // Determine available slots
  const availableSlots: OutfitSlot[] = [];
  const missingMandatorySlots: OutfitSlot[] = [];

  if (tops.count > 0 || dresses.count > 0) {
    availableSlots.push("upper_wear");
  } else {
    missingMandatorySlots.push("upper_wear");
  }

  if (bottoms.count > 0) {
    availableSlots.push("lower_wear");
  } else {
    // Dresses can substitute for upper+lower
    if (dresses.count === 0) {
      missingMandatorySlots.push("lower_wear");
    }
  }

  if (footwear.count > 0) {
    availableSlots.push("footwear");
  } else {
    missingMandatorySlots.push("footwear");
  }

  if (outerwear.count > 0) {
    availableSlots.push("layering");
  }

  if (accessories.count > 0) {
    availableSlots.push("accessory");
  }

  // Can create complete outfit?
  const canCreateCompleteOutfit = 
    (tops.count > 0 || dresses.count > 0) &&
    (bottoms.count > 0 || dresses.count > 0) &&
    footwear.count > 0;

  return {
    tops,
    bottoms,
    footwear,
    outerwear,
    accessories,
    ethnic,
    dresses,
    totalItems: wardrobeItems.length,
    totalWithImages: wardrobeItems.filter(hasImage).length,
    availableSlots,
    missingMandatorySlots,
    canCreateCompleteOutfit,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a summary string for prompts
 */
export function formatCoverageForPrompt(profile: WardrobeCoverageProfile): string {
  const parts: string[] = [];

  parts.push(`Total items: ${profile.totalItems} (${profile.totalWithImages} with images)`);
  parts.push(`Tops: ${profile.tops.level} (${profile.tops.count})`);
  parts.push(`Bottoms: ${profile.bottoms.level} (${profile.bottoms.count})`);
  parts.push(`Footwear: ${profile.footwear.level} (${profile.footwear.count})`);
  parts.push(`Outerwear: ${profile.outerwear.level} (${profile.outerwear.count})`);
  parts.push(`Accessories: ${profile.accessories.level} (${profile.accessories.count})`);

  if (profile.missingMandatorySlots.length > 0) {
    parts.push(`⚠️ Missing: ${profile.missingMandatorySlots.join(", ")}`);
  }

  parts.push(`Can create complete outfit: ${profile.canCreateCompleteOutfit ? "YES" : "NO"}`);

  return parts.join("\n");
}

/**
 * Get coverage-based instructions for outfit generation
 */
export function getCoverageInstructions(profile: WardrobeCoverageProfile): string {
  const instructions: string[] = [];

  if (!profile.canCreateCompleteOutfit) {
    instructions.push("⚠️ Wardrobe is missing essential items for complete outfits.");
    
    if (profile.footwear.count === 0) {
      instructions.push("- No footwear available. Ask user to add shoes or suggest purchases.");
    }
    if (profile.tops.count === 0 && profile.dresses.count === 0) {
      instructions.push("- No tops/dresses available. Cannot create upper wear.");
    }
    if (profile.bottoms.count === 0 && profile.dresses.count === 0) {
      instructions.push("- No bottoms/dresses available. Cannot create lower wear.");
    }
  }

  if (profile.outerwear.level === "none") {
    instructions.push("- No outerwear. Do not suggest layering unless discussing purchases.");
  }

  if (profile.accessories.level === "none") {
    instructions.push("- No accessories. Skip accessory suggestions.");
  }

  return instructions.length > 0 ? instructions.join("\n") : "Wardrobe has good coverage for outfit creation.";
}

/**
 * Check if wardrobe can support visual outfits
 */
export function canSupportVisualOutfits(profile: WardrobeCoverageProfile): boolean {
  // Need images in mandatory categories
  return profile.canCreateCompleteOutfit &&
    profile.tops.withImages + profile.dresses.withImages > 0 &&
    (profile.bottoms.withImages > 0 || profile.dresses.withImages > 0) &&
    profile.footwear.withImages > 0;
}

/**
 * Get wardrobe confidence score
 */
export function getWardrobeConfidenceScore(profile: WardrobeCoverageProfile): number {
  let score = 0;

  // Base score from item counts
  if (profile.totalItems >= 10) score += 0.3;
  else if (profile.totalItems >= 5) score += 0.2;
  else if (profile.totalItems > 0) score += 0.1;

  // Mandatory slots coverage
  if (profile.tops.count > 0 || profile.dresses.count > 0) score += 0.2;
  if (profile.bottoms.count > 0 || profile.dresses.count > 0) score += 0.2;
  if (profile.footwear.count > 0) score += 0.2;

  // Optional slots bonus
  if (profile.outerwear.count > 0) score += 0.05;
  if (profile.accessories.count > 0) score += 0.05;

  return Math.min(1, score);
}

/**
 * Simple check if complete outfits can be created
 * Returns { canGenerate: boolean, missingSlots: string[] }
 */
export function canCreateCompleteOutfits(profile: WardrobeCoverageProfile): {
  canGenerate: boolean;
  missingSlots: OutfitSlot[];
} {
  return {
    canGenerate: profile.canCreateCompleteOutfit,
    missingSlots: profile.missingMandatorySlots,
  };
}

