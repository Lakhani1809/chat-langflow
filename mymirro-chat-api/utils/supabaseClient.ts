/**
 * Supabase Client for Wardrobe and Profile Data
 * Includes gender for gender-aware styling
 */

import type { WardrobeContext, WardrobeItem, UserProfile, Gender } from "../types";
import { parseJsonArray } from "./extractJson";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

/**
 * Fetch wardrobe items for a user
 */
export async function fetchWardrobe(userId: string): Promise<WardrobeContext> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("⚠️ Supabase credentials not configured");
    return { userId, wardrobe_items: [] };
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/wardrobe_items?user_id=eq.${userId}&select=*`;

    console.log(`🔍 Fetching wardrobe for user ${userId}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Supabase error:", response.status, errorText);
      throw new Error(`Supabase error (${response.status}): ${errorText}`);
    }

    const rawItems = await response.json();
    console.log(`📦 Supabase returned ${rawItems.length} items`);

    // Transform items
    const wardrobeItems: WardrobeItem[] = rawItems.map(transformWardrobeItem);

    if (wardrobeItems.length > 0) {
      console.log(
        "📋 Sample items:",
        wardrobeItems.slice(0, 3).map((i) => `${i.name} (${i.color} ${i.category})`).join(", ")
      );
      
      // Log image availability
      const withImages = wardrobeItems.filter(i => i.processed_image_url || i.image_url).length;
      console.log(`🖼️ Items with images: ${withImages}/${wardrobeItems.length}`);
    }

    return {
      userId,
      wardrobe_items: wardrobeItems,
    };
  } catch (error) {
    console.error("❌ Failed to fetch wardrobe:", error);
    return { userId, wardrobe_items: [] };
  }
}

/**
 * Fetch user profile (including gender)
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {};
  }

  try {
    // Include gender and avatar in the select
    const url = `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=body_type,gender,style_keywords,preferred_colors,avoided_colors,avatar_image_url`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const profiles = await response.json();
      if (profiles.length > 0) {
        const profile = profiles[0];
        
        // Validate gender value
        const validGenders: Gender[] = ["male", "female", "other"];
        const gender: Gender | undefined = validGenders.includes(profile.gender) 
          ? profile.gender 
          : undefined;

        if (gender) {
          console.log(`👤 User gender: ${gender}`);
        }

        return {
          body_type: profile.body_type,
          gender,
          style_keywords: parseJsonArray(profile.style_keywords),
          preferred_colors: parseJsonArray(profile.preferred_colors),
          avoided_colors: parseJsonArray(profile.avoided_colors),
          avatar_image_url: profile.avatar_image_url ? String(profile.avatar_image_url) : undefined,
        };
      }
    }
  } catch (error) {
    console.debug("User profile not found or error:", error);
  }

  return {};
}

/**
 * Fetch wardrobe and profile together
 */
export async function fetchWardrobeAndProfile(
  userId: string
): Promise<WardrobeContext & { profile?: UserProfile }> {
  const [wardrobeContext, profile] = await Promise.all([
    fetchWardrobe(userId),
    fetchUserProfile(userId),
  ]);

  return {
    ...wardrobeContext,
    body_type: profile.body_type,
    gender: profile.gender,
    style_keywords: profile.style_keywords,
    profile,
  };
}

/**
 * Transform raw Supabase item to WardrobeItem
 * Includes processed_image_url for visual outfit composition
 */
function transformWardrobeItem(raw: Record<string, unknown>): WardrobeItem {
  return {
    id: String(raw.id || ""),
    name: String(raw.name || raw.item_type || "Unknown item"),
    category: String(raw.category || "Other"),
    color: String(raw.color || raw.primary_color || ""),
    image_url: raw.image_url ? String(raw.image_url) : undefined,
    processed_image_url: raw.processed_image_url ? String(raw.processed_image_url) : undefined,
    texture: raw.texture ? String(raw.texture) : undefined,
    primary_color: raw.primary_color ? String(raw.primary_color) : undefined,
    fabric: raw.fabric_primary ? String(raw.fabric_primary) : undefined,
    pattern_type: raw.pattern_type ? String(raw.pattern_type) : undefined,
    fit: raw.fit_type ? String(raw.fit_type) : undefined,
    length: raw.length ? String(raw.length) : undefined,
    style_aesthetic: parseJsonArray(raw.style_aesthetic as string),
    formality: raw.formality_level ? String(raw.formality_level) : undefined,
    style_notes: raw.style_notes_detailed ? String(raw.style_notes_detailed) : undefined,
    occasions: parseJsonArray(raw.suitable_occasions as string),
    seasons: parseJsonArray(raw.season as string),
    weather_suitability: raw.weather_suitability ? String(raw.weather_suitability) : undefined,
    item_type: raw.item_type ? String(raw.item_type) : undefined,
  };
}

/**
 * Check if wardrobe is empty
 */
export function isWardrobeEmpty(context: WardrobeContext): boolean {
  return context.wardrobe_items.length === 0;
}

/**
 * Get wardrobe statistics
 */
export function getWardrobeStats(context: WardrobeContext): {
  totalItems: number;
  categories: Record<string, number>;
  colors: Record<string, number>;
  hasItems: boolean;
  itemsWithImages: number;
} {
  const categories: Record<string, number> = {};
  const colors: Record<string, number> = {};
  let itemsWithImages = 0;

  for (const item of context.wardrobe_items) {
    // Count categories
    const cat = item.category || "Other";
    categories[cat] = (categories[cat] || 0) + 1;

    // Count colors
    const color = item.color || "Unknown";
    colors[color] = (colors[color] || 0) + 1;

    // Count items with images
    if (item.processed_image_url || item.image_url) {
      itemsWithImages++;
    }
  }

  return {
    totalItems: context.wardrobe_items.length,
    categories,
    colors,
    hasItems: context.wardrobe_items.length > 0,
    itemsWithImages,
  };
}
