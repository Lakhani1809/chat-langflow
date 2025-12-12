/**
 * Rules Engine Module
 * Merges all analysis outputs into actionable styling rules
 * Now includes gender-aware soft preferences
 */

import { callGeminiJson } from "../utils/geminiClient";
import type {
  ColorAnalysis,
  SilhouetteAnalysis,
  BodyTypeAnalysis,
  FashionIntelligence,
  RulesEngineOutput,
  GenderContext,
} from "../types";

const FALLBACK_RULES: RulesEngineOutput = {
  valid_pairs: [
    "dark top + light bottom",
    "fitted top + relaxed bottom",
    "neutral base + accent color",
  ],
  avoid_pairs: [],
  strong_outfit_bases: [
    "jeans + white top",
    "black pants + any colored top",
  ],
  core_directions: [
    "Keep proportions balanced",
    "Define waist when possible",
    "Add one statement piece",
  ],
  color_rules: ["Use neutrals as base", "Add one accent color"],
  silhouette_rules: ["Balance fitted with relaxed"],
  body_type_rules: ["Highlight your favorite features"],
  gender_style_notes: ["Style flexibly based on personal preference"],
};

/**
 * Get soft silhouette preferences based on gender context
 * These are SOFT preferences, never hard blocks
 */
function getGenderContextGuidance(genderContext: GenderContext): string {
  const guidance: Record<GenderContext, string> = {
    masculine: `GENDER STYLING CONTEXT: Masculine
- Softly prefer structured, angular silhouettes
- Tailored fits tend to work well
- Minimalist styling is often flattering
- IMPORTANT: Never block items that exist in wardrobe - if they own it, they can wear it
- These are soft preferences, not rules`,
    
    feminine: `GENDER STYLING CONTEXT: Feminine
- Softer, flowing silhouettes are welcome
- Waist definition often looks great
- Layering and accessories encouraged
- IMPORTANT: Never block items that exist in wardrobe - if they own it, they can wear it
- These are soft preferences, not rules`,
    
    androgynous: `GENDER STYLING CONTEXT: Androgynous
- Balance structure with softness
- Gender-neutral pieces work well
- Versatile, clean styling preferred
- IMPORTANT: Full flexibility - all wardrobe items are fair game
- No silhouette restrictions`,
    
    fluid: `GENDER STYLING CONTEXT: Fluid
- Mix masculine and feminine elements freely
- Encourage experimentation
- Break traditional styling rules
- IMPORTANT: Maximum flexibility - celebrate contrast and personal expression
- All wardrobe items encouraged`,
  };

  return guidance[genderContext] || guidance.androgynous;
}

/**
 * Merge all analyses into unified styling rules
 */
export async function generateStylingRules(
  fashionIntelligence: FashionIntelligence,
  colorAnalysis: ColorAnalysis,
  silhouetteAnalysis: SilhouetteAnalysis,
  bodyTypeAnalysis: BodyTypeAnalysis
): Promise<RulesEngineOutput> {
  const genderGuidance = getGenderContextGuidance(fashionIntelligence.gender_context);

  const prompt = `You are a fashion rules engine that synthesizes multiple style analyses into clear, actionable rules.

FASHION INTELLIGENCE:
${JSON.stringify(fashionIntelligence, null, 2)}

COLOR ANALYSIS:
${JSON.stringify(colorAnalysis, null, 2)}

SILHOUETTE ANALYSIS:
${JSON.stringify(silhouetteAnalysis, null, 2)}

BODY TYPE ANALYSIS:
${JSON.stringify(bodyTypeAnalysis, null, 2)}

${genderGuidance}

TASK:
Merge these analyses into a unified set of styling rules. This is for internal use by the outfit generation module, NOT for the user.

CRITICAL RULES:
1. NEVER hard-block any item that exists in the wardrobe
2. Gender context provides SOFT preferences only - not restrictions
3. Wardrobe reality always wins over styling conventions
4. If an item exists in their wardrobe, they can wear it regardless of gender context

Create:
1. valid_pairs - 3-4 specific clothing pairings that work (e.g., "navy blazer + white tee + dark jeans")
2. avoid_pairs - 1-2 combinations to DE-PRIORITIZE (not block), or empty if flexible
3. strong_outfit_bases - 2-3 base outfit combinations to build from
4. core_directions - 3-4 key styling directions for this user/request
5. color_rules - 2-3 specific color rules from the analysis
6. silhouette_rules - 2-3 silhouette/proportion rules
7. body_type_rules - 2-3 body type specific rules (positive framing)
8. gender_style_notes - 1-2 notes on how gender context influences styling (soft guidance only)

Be SPECIFIC using item types from the wardrobe context.

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "valid_pairs": ["...", "...", "..."],
  "avoid_pairs": ["...", "..."],
  "strong_outfit_bases": ["...", "..."],
  "core_directions": ["...", "...", "...", "..."],
  "color_rules": ["...", "..."],
  "silhouette_rules": ["...", "..."],
  "body_type_rules": ["...", "..."],
  "gender_style_notes": ["...", "..."]
}`;

  return callGeminiJson<RulesEngineOutput>(prompt, FALLBACK_RULES, {
    temperature: 0.5,
    timeout: 8000,
  });
}

/**
 * Validate rules engine output
 */
export function validateRulesOutput(rules: RulesEngineOutput): boolean {
  return (
    Array.isArray(rules.valid_pairs) &&
    Array.isArray(rules.avoid_pairs) &&
    Array.isArray(rules.strong_outfit_bases) &&
    Array.isArray(rules.core_directions) &&
    Array.isArray(rules.color_rules) &&
    Array.isArray(rules.silhouette_rules) &&
    Array.isArray(rules.body_type_rules)
  );
}

/**
 * Format rules for module input
 */
export function formatRulesForModule(rules: RulesEngineOutput): string {
  let formatted = `STYLING RULES:

VALID COMBINATIONS:
${rules.valid_pairs.map((p) => `• ${p}`).join("\n")}

SOFT AVOIDS (de-prioritize, don't block):
${rules.avoid_pairs.length > 0 ? rules.avoid_pairs.map((p) => `• ${p}`).join("\n") : "• No specific avoids - full flexibility"}

STRONG BASES TO BUILD FROM:
${rules.strong_outfit_bases.map((b) => `• ${b}`).join("\n")}

CORE DIRECTIONS:
${rules.core_directions.map((d) => `• ${d}`).join("\n")}

COLOR GUIDANCE:
${rules.color_rules.map((r) => `• ${r}`).join("\n")}

SILHOUETTE GUIDANCE:
${rules.silhouette_rules.map((r) => `• ${r}`).join("\n")}

BODY TYPE GUIDANCE:
${rules.body_type_rules.map((r) => `• ${r}`).join("\n")}`;

  if (rules.gender_style_notes && rules.gender_style_notes.length > 0) {
    formatted += `\n\nSTYLING DIRECTION NOTES:
${rules.gender_style_notes.map((n) => `• ${n}`).join("\n")}`;
  }

  return formatted;
}

/**
 * Create simplified rules for quick reference
 */
export function createQuickRules(rules: RulesEngineOutput): string[] {
  const quickRules: string[] = [];

  // Pick most important from each category
  if (rules.core_directions.length > 0) {
    quickRules.push(rules.core_directions[0]);
  }
  if (rules.color_rules.length > 0) {
    quickRules.push(rules.color_rules[0]);
  }
  if (rules.silhouette_rules.length > 0) {
    quickRules.push(rules.silhouette_rules[0]);
  }
  if (rules.body_type_rules.length > 0) {
    quickRules.push(rules.body_type_rules[0]);
  }

  return quickRules;
}

/**
 * Create quick rules from analyses WITHOUT LLM call
 * Used for latency optimization when full rules engine is not needed
 */
export function createQuickRulesFromAnalyses(
  fashionIntelligence: FashionIntelligence,
  colorAnalysis: ColorAnalysis,
  silhouetteAnalysis: SilhouetteAnalysis,
  bodyTypeAnalysis: BodyTypeAnalysis
): RulesEngineOutput {
  // Build valid pairs from analyses
  const validPairs: string[] = [];
  
  // From color analysis
  if (colorAnalysis.combos && colorAnalysis.combos.length > 0) {
    validPairs.push(...colorAnalysis.combos.slice(0, 2));
  }
  if (colorAnalysis.primary_palette && colorAnalysis.primary_palette.length >= 2) {
    validPairs.push(`${colorAnalysis.primary_palette[0]} + ${colorAnalysis.primary_palette[1]}`);
  }

  // From silhouette analysis
  if (silhouetteAnalysis.recommended_structures && silhouetteAnalysis.recommended_structures.length > 0) {
    validPairs.push(...silhouetteAnalysis.recommended_structures.slice(0, 2));
  }

  // Build avoid pairs from color analysis
  const avoidPairs: string[] = [];
  if (colorAnalysis.avoid_colors && colorAnalysis.avoid_colors.length > 0) {
    avoidPairs.push(`Avoid: ${colorAnalysis.avoid_colors.join(", ")}`);
  }

  // Strong outfit bases from silhouette
  const strongOutfitBases = silhouetteAnalysis.recommended_structures?.slice(0, 2) || [
    "fitted top + relaxed bottom",
  ];

  // Core directions from fashion intelligence
  const coreDirections: string[] = [];
  if (fashionIntelligence.vibe) {
    coreDirections.push(`Go for a ${fashionIntelligence.vibe} vibe`);
  }
  if (fashionIntelligence.aesthetic) {
    coreDirections.push(`${fashionIntelligence.aesthetic} aesthetic works well`);
  }
  if (fashionIntelligence.fit_preference) {
    coreDirections.push(`Lean towards ${fashionIntelligence.fit_preference} fits`);
  }
  if (fashionIntelligence.occasion) {
    coreDirections.push(`Perfect for ${fashionIntelligence.occasion}`);
  }

  // Color rules
  const colorRules: string[] = [];
  if (colorAnalysis.color_direction) {
    colorRules.push(`Go with ${colorAnalysis.color_direction}`);
  }
  if (colorAnalysis.primary_palette && colorAnalysis.primary_palette.length > 0) {
    colorRules.push(`Base palette: ${colorAnalysis.primary_palette.slice(0, 3).join(", ")}`);
  }
  if (colorAnalysis.accent_colors && colorAnalysis.accent_colors.length > 0) {
    colorRules.push(`Pop of ${colorAnalysis.accent_colors[0]} works`);
  }

  // Silhouette rules
  const silhouetteRules: string[] = [];
  if (silhouetteAnalysis.silhouette_verdict) {
    silhouetteRules.push(silhouetteAnalysis.silhouette_verdict);
  }
  if (silhouetteAnalysis.proportion_tips && silhouetteAnalysis.proportion_tips.length > 0) {
    silhouetteRules.push(...silhouetteAnalysis.proportion_tips.slice(0, 2));
  }

  // Body type rules
  const bodyTypeRules: string[] = [];
  if (bodyTypeAnalysis.flattering_styles && bodyTypeAnalysis.flattering_styles.length > 0) {
    bodyTypeRules.push(...bodyTypeAnalysis.flattering_styles.slice(0, 2));
  }
  if (bodyTypeAnalysis.highlight_areas && bodyTypeAnalysis.highlight_areas.length > 0) {
    bodyTypeRules.push(`Highlight your ${bodyTypeAnalysis.highlight_areas.join(", ")}`);
  }

  // Gender style notes
  const genderStyleNotes: string[] = [];
  const genderContext = fashionIntelligence.gender_context;
  if (genderContext === "masculine") {
    genderStyleNotes.push("Structured, clean lines work great");
  } else if (genderContext === "feminine") {
    genderStyleNotes.push("Flow and softness are your friends");
  } else if (genderContext === "androgynous") {
    genderStyleNotes.push("Mix and match freely - no rules!");
  } else if (genderContext === "fluid") {
    genderStyleNotes.push("Experiment with contrasts and layers");
  }

  return {
    valid_pairs: validPairs.length > 0 ? validPairs : ["versatile top + bottom"],
    avoid_pairs: avoidPairs,
    strong_outfit_bases: strongOutfitBases,
    core_directions: coreDirections.length > 0 ? coreDirections : ["Keep it comfortable"],
    color_rules: colorRules.length > 0 ? colorRules : ["Neutral base works"],
    silhouette_rules: silhouetteRules.length > 0 ? silhouetteRules : ["Balance proportions"],
    body_type_rules: bodyTypeRules.length > 0 ? bodyTypeRules : ["Highlight your best features"],
    gender_style_notes: genderStyleNotes,
  };
}

/**
 * Check if an outfit follows the rules
 * Note: avoid_pairs are SOFT - they reduce score but don't invalidate
 */
export function validateOutfitAgainstRules(
  outfitItems: string[],
  rules: RulesEngineOutput
): { valid: boolean; score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 100;
  const itemsLower = outfitItems.map((i) => i.toLowerCase());

  // Check avoid pairs - reduce score but don't invalidate
  for (const avoidPair of rules.avoid_pairs) {
    const pairParts = avoidPair.toLowerCase().split(/\s*[+&,]\s*/);
    const matchCount = pairParts.filter((part) =>
      itemsLower.some((item) => item.includes(part) || part.includes(item))
    ).length;

    if (matchCount >= 2) {
      score -= 15; // Soft penalty, not disqualification
      notes.push(`Contains de-prioritized combination: ${avoidPair}`);
    }
  }

  // Check for valid pairs - bonus points
  for (const validPair of rules.valid_pairs) {
    const pairParts = validPair.toLowerCase().split(/\s*[+&,]\s*/);
    const matchCount = pairParts.filter((part) =>
      itemsLower.some((item) => item.includes(part) || part.includes(item))
    ).length;

    if (matchCount >= 2) {
      score += 10; // Bonus for following good combinations
      notes.push(`Uses recommended combination: ${validPair}`);
    }
  }

  return {
    valid: true, // Always valid - wardrobe reality wins
    score: Math.max(0, Math.min(100, score)),
    notes,
  };
}
