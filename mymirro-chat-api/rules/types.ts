/**
 * V2 Rules Engine Types
 * Canonical clothing taxonomy and rule types
 */

// ============================================
// CLOTHING TAXONOMY
// ============================================

/**
 * Primary clothing categories
 */
export type ClothingCategory = 
  | "tops"
  | "bottoms"
  | "footwear"
  | "outerwear"
  | "accessories"
  | "ethnic"
  | "sportswear"
  | "formalwear"
  | "dresses";

/**
 * Subcategories for detailed classification
 */
export const SUBCATEGORY_MAP: Record<ClothingCategory, string[]> = {
  tops: ["t-shirt", "shirt", "blouse", "sweater", "hoodie", "tank", "polo", "crop-top", "kurta-top"],
  bottoms: ["jeans", "trousers", "shorts", "skirt", "leggings", "cargo", "chinos", "palazzos"],
  footwear: ["sneakers", "loafers", "heels", "boots", "sandals", "flats", "slides", "flip-flops", "formal-shoes"],
  outerwear: ["jacket", "blazer", "coat", "cardigan", "puffer", "windbreaker", "shrug"],
  accessories: ["bag", "belt", "watch", "jewelry", "scarf", "hat", "sunglasses"],
  ethnic: ["kurta", "saree", "lehenga", "sherwani", "salwar", "dupatta", "dhoti"],
  sportswear: ["track-pants", "sports-bra", "gym-shorts", "athletic-top"],
  formalwear: ["suit", "blazer-formal", "formal-shirt", "formal-trousers"],
  dresses: ["casual-dress", "formal-dress", "maxi", "midi", "mini", "gown"],
};

/**
 * Silhouette types
 */
export type Silhouette = "slim" | "regular" | "relaxed" | "longline" | "oversized";

/**
 * Formality levels
 */
export type FormalityLevel = "casual" | "smart-casual" | "smart" | "formal";

/**
 * Season/climate suitability
 */
export type SeasonType = "hot" | "mild" | "cold" | "all-season";

/**
 * Aesthetic tags
 */
export type AestheticTag = 
  | "streetwear"
  | "minimal"
  | "preppy"
  | "ethnic"
  | "bohemian"
  | "sporty"
  | "elegant"
  | "edgy"
  | "classic"
  | "trendy";

// ============================================
// ITEM CLASSIFICATION
// ============================================

/**
 * Classified clothing item with all attributes
 */
export type ClassifiedItem = {
  id: string | number;
  name: string;
  category: ClothingCategory;
  subcategory: string;
  silhouette: Silhouette;
  formality: FormalityLevel;
  season: SeasonType;
  aestheticTags: AestheticTag[];
  colorFamily: string;
  hasImage: boolean;
};

/**
 * Classify a wardrobe item into the taxonomy
 */
export function classifyItem(item: {
  id: string | number;
  name?: string;
  category: string;
  fit?: string;
  formality?: string;
  seasons?: string[];
  style_aesthetic?: string[];
  color?: string;
  image_url?: string;
  processed_image_url?: string;
  item_type?: string;
}): ClassifiedItem {
  const category = mapToCategory(item.category, item.item_type);
  const subcategory = inferSubcategory(item.name || "", item.item_type || "", category);
  
  return {
    id: item.id,
    name: item.name || `${item.color || ""} ${item.category}`.trim(),
    category,
    subcategory,
    silhouette: mapSilhouette(item.fit),
    formality: mapFormality(item.formality, category, subcategory),
    season: mapSeason(item.seasons),
    aestheticTags: mapAesthetics(item.style_aesthetic || []),
    colorFamily: item.color || "unknown",
    hasImage: !!(item.image_url || item.processed_image_url),
  };
}

/**
 * Map raw category to taxonomy category
 */
function mapToCategory(rawCategory: string, itemType?: string): ClothingCategory {
  const lower = (rawCategory || "").toLowerCase();
  const itemLower = (itemType || "").toLowerCase();
  
  // Check item type first
  if (itemLower.includes("kurta") || itemLower.includes("saree") || itemLower.includes("lehenga")) {
    return "ethnic";
  }
  if (itemLower.includes("dress") || lower.includes("dress")) {
    return "dresses";
  }
  
  // Then category
  if (lower.includes("top") || lower.includes("shirt") || lower.includes("blouse") || lower.includes("tee")) {
    return "tops";
  }
  if (lower.includes("bottom") || lower.includes("pant") || lower.includes("jean") || lower.includes("short") || lower.includes("skirt")) {
    return "bottoms";
  }
  if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("boot") || lower.includes("sandal") || lower.includes("heel") || lower.includes("footwear")) {
    return "footwear";
  }
  if (lower.includes("jacket") || lower.includes("coat") || lower.includes("blazer") || lower.includes("outer") || lower.includes("cardigan")) {
    return "outerwear";
  }
  if (lower.includes("accessory") || lower.includes("bag") || lower.includes("belt") || lower.includes("watch") || lower.includes("jewelry")) {
    return "accessories";
  }
  if (lower.includes("sport") || lower.includes("gym") || lower.includes("athletic")) {
    return "sportswear";
  }
  if (lower.includes("ethnic") || lower.includes("traditional")) {
    return "ethnic";
  }
  if (lower.includes("formal") || lower.includes("suit")) {
    return "formalwear";
  }
  
  // Default based on common patterns
  return "tops";
}

/**
 * Infer subcategory from name and item type
 */
function inferSubcategory(name: string, itemType: string, category: ClothingCategory): string {
  const searchText = `${name} ${itemType}`.toLowerCase();
  const subcategories = SUBCATEGORY_MAP[category] || [];
  
  for (const sub of subcategories) {
    if (searchText.includes(sub.replace("-", " ")) || searchText.includes(sub)) {
      return sub;
    }
  }
  
  // Default subcategory per category
  const defaults: Record<ClothingCategory, string> = {
    tops: "t-shirt",
    bottoms: "jeans",
    footwear: "sneakers",
    outerwear: "jacket",
    accessories: "bag",
    ethnic: "kurta",
    sportswear: "track-pants",
    formalwear: "formal-shirt",
    dresses: "casual-dress",
  };
  
  return defaults[category] || "other";
}

/**
 * Map fit to silhouette
 */
function mapSilhouette(fit?: string): Silhouette {
  const lower = (fit || "").toLowerCase();
  
  if (lower.includes("slim") || lower.includes("fitted") || lower.includes("tight")) {
    return "slim";
  }
  if (lower.includes("relaxed") || lower.includes("loose")) {
    return "relaxed";
  }
  if (lower.includes("oversized") || lower.includes("baggy")) {
    return "oversized";
  }
  if (lower.includes("longline") || lower.includes("long")) {
    return "longline";
  }
  
  return "regular";
}

/**
 * Map formality
 */
function mapFormality(formality?: string, category?: ClothingCategory, subcategory?: string): FormalityLevel {
  const lower = (formality || "").toLowerCase();
  
  if (lower.includes("formal")) return "formal";
  if (lower.includes("smart-casual") || lower.includes("business casual")) return "smart-casual";
  if (lower.includes("smart")) return "smart";
  if (lower.includes("casual")) return "casual";
  
  // Infer from category/subcategory
  if (category === "formalwear") return "formal";
  if (subcategory === "blazer" || subcategory === "formal-shoes") return "smart";
  if (subcategory === "flip-flops" || subcategory === "slides") return "casual";
  if (category === "sportswear") return "casual";
  
  return "casual";
}

/**
 * Map season
 */
function mapSeason(seasons?: string[]): SeasonType {
  if (!seasons || seasons.length === 0) return "all-season";
  
  const lower = seasons.map(s => s.toLowerCase());
  
  if (lower.some(s => s.includes("winter") || s.includes("cold"))) return "cold";
  if (lower.some(s => s.includes("summer") || s.includes("hot"))) return "hot";
  if (lower.some(s => s.includes("spring") || s.includes("fall") || s.includes("autumn"))) return "mild";
  
  return "all-season";
}

/**
 * Map aesthetics
 */
function mapAesthetics(aesthetics: string[]): AestheticTag[] {
  const validTags: AestheticTag[] = [
    "streetwear", "minimal", "preppy", "ethnic", "bohemian",
    "sporty", "elegant", "edgy", "classic", "trendy"
  ];
  
  return aesthetics
    .map(a => a.toLowerCase() as AestheticTag)
    .filter(a => validTags.includes(a));
}

// ============================================
// FORMALITY COMPATIBILITY MATRIX
// ============================================

/**
 * Formality compatibility rules
 * Returns true if items are compatible
 */
export function areFormalitiesCompatible(
  formality1: FormalityLevel,
  formality2: FormalityLevel
): boolean {
  const matrix: Record<FormalityLevel, FormalityLevel[]> = {
    casual: ["casual", "smart-casual"],
    "smart-casual": ["casual", "smart-casual", "smart"],
    smart: ["smart-casual", "smart", "formal"],
    formal: ["smart", "formal"],
  };
  
  return matrix[formality1]?.includes(formality2) || false;
}

/**
 * Check if footwear is too casual for the outfit formality
 */
export function isFootwearTooCasual(
  footwearSubcategory: string,
  outfitFormality: FormalityLevel
): boolean {
  const casualFootwear = ["flip-flops", "slides", "sandals"];
  
  if (outfitFormality === "formal" || outfitFormality === "smart") {
    return casualFootwear.includes(footwearSubcategory);
  }
  
  return false;
}

/**
 * Check if ethnic coherence is violated
 */
export function isEthnicCoherenceViolated(
  items: ClassifiedItem[]
): boolean {
  const hasEthnic = items.some(i => i.category === "ethnic");
  const hasSportswear = items.some(i => i.category === "sportswear");
  const hasGymShorts = items.some(i => 
    i.subcategory === "gym-shorts" || 
    (i.category === "sportswear" && i.subcategory.includes("short"))
  );
  
  // Ethnic with gym/sports items is a violation
  return hasEthnic && (hasSportswear || hasGymShorts);
}

