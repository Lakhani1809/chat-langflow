/**
 * Wardrobe Formatter Utility
 * Formats wardrobe data for LLM consumption
 */

import type { WardrobeItem, WardrobeContext } from "../types";

/**
 * Format wardrobe items for LLM context
 */
export function formatWardrobeForLLM(context: WardrobeContext): string {
  if (context.wardrobe_items.length === 0) {
    return "User's wardrobe is empty - no items uploaded yet.";
  }

  // Group items by category
  const byCategory = groupItemsByCategory(context.wardrobe_items);

  let formatted = `User has ${context.wardrobe_items.length} items in their wardrobe:\n\n`;

  for (const [category, items] of Object.entries(byCategory)) {
    formatted += `## ${category} (${items.length} items)\n`;

    for (const item of items) {
      const details = formatItemDetails(item);
      formatted += `- ${item.name || item.item_type || "Item"}: ${details}\n`;
    }
    formatted += "\n";
  }

  return formatted;
}

/**
 * Format wardrobe as a compact summary
 */
export function formatWardrobeSummary(context: WardrobeContext): string {
  if (context.wardrobe_items.length === 0) {
    return "Empty wardrobe";
  }

  const byCategory = groupItemsByCategory(context.wardrobe_items);
  const parts: string[] = [];

  for (const [category, items] of Object.entries(byCategory)) {
    const colors = [...new Set(items.map((i) => i.color).filter(Boolean))];
    const colorStr = colors.length > 0 ? ` (${colors.slice(0, 3).join(", ")})` : "";
    parts.push(`${category}: ${items.length} items${colorStr}`);
  }

  return parts.join(" | ");
}

/**
 * Format wardrobe with full metadata for analysis
 */
export function formatWardrobeForAnalysis(context: WardrobeContext): string {
  if (context.wardrobe_items.length === 0) {
    return "No wardrobe items available for analysis.";
  }

  const lines: string[] = [
    `Total items: ${context.wardrobe_items.length}`,
    "",
  ];

  // Color distribution
  const colorCounts = countAttribute(context.wardrobe_items, "color");
  lines.push(`Color distribution: ${formatCounts(colorCounts)}`);

  // Category distribution
  const categoryCounts = countAttribute(context.wardrobe_items, "category");
  lines.push(`Categories: ${formatCounts(categoryCounts)}`);

  // Fabric distribution
  const fabricCounts = countAttribute(context.wardrobe_items, "fabric");
  if (Object.keys(fabricCounts).length > 0) {
    lines.push(`Fabrics: ${formatCounts(fabricCounts)}`);
  }

  // Style aesthetics
  const allAesthetics = context.wardrobe_items.flatMap(
    (i) => i.style_aesthetic || []
  );
  const aestheticCounts = allAesthetics.reduce(
    (acc, a) => {
      acc[a] = (acc[a] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  if (Object.keys(aestheticCounts).length > 0) {
    lines.push(`Style aesthetics: ${formatCounts(aestheticCounts)}`);
  }

  // Formality levels
  const formalityCounts = countAttribute(context.wardrobe_items, "formality");
  if (Object.keys(formalityCounts).length > 0) {
    lines.push(`Formality: ${formatCounts(formalityCounts)}`);
  }

  lines.push("");
  lines.push("--- Detailed Items ---");

  // Detailed items by category
  const byCategory = groupItemsByCategory(context.wardrobe_items);
  for (const [category, items] of Object.entries(byCategory)) {
    lines.push(`\n[${category.toUpperCase()}]`);
    for (const item of items) {
      lines.push(`• ${formatItemCompact(item)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Group items by category
 */
function groupItemsByCategory(
  items: WardrobeItem[]
): Record<string, WardrobeItem[]> {
  const grouped: Record<string, WardrobeItem[]> = {};

  for (const item of items) {
    const category = item.category || "Other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }

  return grouped;
}

/**
 * Format individual item details
 */
function formatItemDetails(item: WardrobeItem): string {
  const details: string[] = [];

  if (item.color) details.push(`Color: ${item.color}`);
  if (item.fabric) details.push(`Fabric: ${item.fabric}`);
  if (item.fit) details.push(`Fit: ${item.fit}`);
  if (item.formality) details.push(`Formality: ${item.formality}`);
  if (item.style_aesthetic?.length) {
    details.push(`Style: ${item.style_aesthetic.join(", ")}`);
  }
  if (item.occasions?.length) {
    details.push(`Good for: ${item.occasions.join(", ")}`);
  }
  if (item.seasons?.length) {
    details.push(`Seasons: ${item.seasons.join(", ")}`);
  }

  return details.length > 0 ? details.join(" | ") : "No details available";
}

/**
 * Format item in compact form
 */
function formatItemCompact(item: WardrobeItem): string {
  const parts: string[] = [];

  if (item.color) parts.push(item.color);
  if (item.fabric) parts.push(item.fabric);
  parts.push(item.name || item.item_type || item.category);

  const extras: string[] = [];
  if (item.fit) extras.push(item.fit);
  if (item.formality) extras.push(item.formality);

  let result = parts.join(" ");
  if (extras.length > 0) {
    result += ` (${extras.join(", ")})`;
  }

  return result;
}

/**
 * Count occurrences of an attribute
 */
function countAttribute(
  items: WardrobeItem[],
  attribute: keyof WardrobeItem
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const value = item[attribute];
    if (value && typeof value === "string") {
      counts[value] = (counts[value] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Format counts as string
 */
function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => `${key} (${count})`)
    .join(", ");
}

/**
 * Get available colors from wardrobe
 */
export function getAvailableColors(items: WardrobeItem[]): string[] {
  const colors = items
    .map((item) => item.color || item.primary_color)
    .filter((color): color is string => Boolean(color));
  return [...new Set(colors)];
}

/**
 * Get available categories from wardrobe
 */
export function getAvailableCategories(items: WardrobeItem[]): string[] {
  const categories = items.map((item) => item.category).filter(Boolean);
  return [...new Set(categories)];
}

/**
 * Find items matching criteria
 */
export function findMatchingItems(
  items: WardrobeItem[],
  criteria: {
    color?: string;
    category?: string;
    occasion?: string;
    formality?: string;
  }
): WardrobeItem[] {
  return items.filter((item) => {
    if (criteria.color && !item.color?.toLowerCase().includes(criteria.color.toLowerCase())) {
      return false;
    }
    if (criteria.category && item.category?.toLowerCase() !== criteria.category.toLowerCase()) {
      return false;
    }
    if (criteria.occasion && !item.occasions?.some((o) => o.toLowerCase().includes(criteria.occasion!.toLowerCase()))) {
      return false;
    }
    if (criteria.formality && item.formality?.toLowerCase() !== criteria.formality.toLowerCase()) {
      return false;
    }
    return true;
  });
}

/**
 * Get item names for safety filter
 */
export function getItemIdentifiers(items: WardrobeItem[]): Set<string> {
  const identifiers = new Set<string>();

  for (const item of items) {
    // Add name
    if (item.name) {
      identifiers.add(item.name.toLowerCase());
    }
    // Add item type
    if (item.item_type) {
      identifiers.add(item.item_type.toLowerCase());
    }
    // Add category
    if (item.category) {
      identifiers.add(item.category.toLowerCase());
    }
    // Add color
    if (item.color) {
      identifiers.add(item.color.toLowerCase());
    }
    // Add color + category combo
    if (item.color && item.category) {
      identifiers.add(`${item.color} ${item.category}`.toLowerCase());
    }
  }

  return identifiers;
}

