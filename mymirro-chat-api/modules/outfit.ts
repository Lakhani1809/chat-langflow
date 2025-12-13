/**
 * Outfit Generation Module
 * V2: Multi-candidate generation with slot-based structure and rule evaluation
 */

import { callGeminiJson, GEMINI_FLASH } from "../utils/geminiClient";
import { formatRulesForModule } from "../analysis/rules";
import type {
  Outfit,
  OutfitGenerationOutput,
  RulesEngineOutput,
  WardrobeContext,
  FashionIntelligence,
  ConversationMemory,
  OutfitDraft,
  OutfitSlotItem,
  WardrobeCoverageProfile,
  CanonicalMemory,
  RuleContext,
} from "../types";
import { formatWardrobeForLLM } from "../utils/wardrobeFormatter";
import { formatCoverageForPrompt, getCoverageInstructions } from "../utils/wardrobeCoverage";
import { formatCanonicalMemoryForPrompt } from "../utils/memoryArbiter";
import { evaluateCandidates, evaluateWithRelaxedRules, isOutfitComplete, getMissingSlots } from "../rules";

const FALLBACK_OUTPUT: OutfitGenerationOutput = {
  outfits: [
    {
      title: "Classic Everyday Look",
      items: ["A versatile top", "Comfortable bottoms", "Everyday shoes"],
      why_it_works: "A balanced, comfortable combination perfect for daily wear.",
    },
  ],
  styling_notes: "Focus on pieces that make you feel confident and comfortable.",
};

/**
 * Generate outfit suggestions
 */
export async function generateOutfits(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence,
  memory?: ConversationMemory
): Promise<OutfitGenerationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const memoryContext = memory
    ? `
CONVERSATION CONTEXT:
- User's tone: ${memory.userTone}
- User preferences: ${memory.userPreferences.join(", ") || "None noted"}
- Frequent aesthetics: ${memory.frequentAesthetics.join(", ") || "None noted"}
${memory.lastOutfitSuggestions.length > 0 ? `- Previously suggested: ${memory.lastOutfitSuggestions.map((o) => o.title).join(", ")} (suggest different options)` : ""}`
    : "";

  const prompt = `You are MyMirro, an expert AI fashion stylist creating personalized outfit suggestions.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Fit Preference: ${fashionIntelligence.fit_preference}
- Color Direction: ${fashionIntelligence.color_direction}
- Occasion: ${fashionIntelligence.occasion}
- Mood: ${fashionIntelligence.mood}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

${memoryContext}

TASK:
Create 2-3 complete outfit suggestions using ONLY items from the user's wardrobe.

Requirements:
1. Each outfit MUST use specific items by name from the wardrobe
2. Include top, bottom, and optionally shoes/accessories
3. Explain why each outfit works for the occasion and body type
4. Make each outfit distinct from the others
5. Follow the styling rules provided
6. Give each outfit a catchy, Gen-Z friendly title

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "outfits": [
    {
      "title": "...",
      "items": ["specific item from wardrobe", "another item", "..."],
      "why_it_works": "...",
      "occasion": "...",
      "vibe": "..."
    }
  ],
  "styling_notes": "..."
}`;

  return callGeminiJson<OutfitGenerationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2048,
  });
}

/**
 * Generate more outfit options (for continuation queries)
 */
export async function generateMoreOutfits(
  previousOutfits: Outfit[],
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence
): Promise<OutfitGenerationOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);

  const previousTitles = previousOutfits.map((o) => o.title).join(", ");
  const previousItems = previousOutfits.flatMap((o) => o.items);

  const prompt = `You are MyMirro, an expert AI fashion stylist.

The user asked for MORE outfit options. Here's what we've already suggested:
- Previous outfits: ${previousTitles}
- Items already used: ${previousItems.join(", ")}

FASHION CONTEXT:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Occasion: ${fashionIntelligence.occasion}

${rulesFormatted}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Create 2-3 NEW outfit suggestions that are DIFFERENT from the previous ones.

Requirements:
1. Use DIFFERENT items or different combinations
2. Each outfit uses items by name from the wardrobe
3. Keep the same occasion/vibe unless items suggest otherwise
4. Make these feel fresh and distinct

IMPORTANT: Return ONLY valid JSON, no other text.

{
  "outfits": [
    {
      "title": "...",
      "items": ["...", "..."],
      "why_it_works": "...",
      "occasion": "...",
      "vibe": "..."
    }
  ],
  "styling_notes": "..."
}`;

  return callGeminiJson<OutfitGenerationOutput>(prompt, FALLBACK_OUTPUT, {
    temperature: 0.85,
    timeout: 12000,
  });
}

/**
 * Validate outfit output
 */
export function validateOutfitOutput(output: OutfitGenerationOutput): boolean {
  return (
    Array.isArray(output.outfits) &&
    output.outfits.length > 0 &&
    output.outfits.every(
      (o) =>
        typeof o.title === "string" &&
        Array.isArray(o.items) &&
        o.items.length > 0 &&
        typeof o.why_it_works === "string"
    )
  );
}

// ============================================
// V2: MULTI-CANDIDATE GENERATION
// ============================================

/**
 * V2 Output type with slot-based structure
 */
export type OutfitCandidatesOutput = {
  candidates: OutfitDraft[];
  styling_notes: string;
  coverage_warning?: string;
};

/**
 * V2: Generate multiple outfit candidates with slot structure
 * Generates 6-10 candidates, then filters with rule evaluator
 */
export async function generateOutfitCandidatesV2(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence,
  coverageProfile: WardrobeCoverageProfile,
  canonicalMemory?: CanonicalMemory,
  candidateCount: number = 8
): Promise<OutfitCandidatesOutput> {
  const wardrobeFormatted = formatWardrobeForLLM(wardrobeContext);
  const rulesFormatted = formatRulesForModule(rules);
  const coverageFormatted = formatCoverageForPrompt(coverageProfile);
  const coverageInstructions = getCoverageInstructions(coverageProfile);
  
  // Format canonical memory if available
  const memoryContext = canonicalMemory
    ? `
USER STYLE PROFILE (CANONICAL):
${formatCanonicalMemoryForPrompt(canonicalMemory)}

HARD NEGATIVES (DO NOT SUGGEST):
${canonicalMemory.do_not_suggest.length > 0 ? canonicalMemory.do_not_suggest.join(", ") : "None"}
`
    : "";

  const prompt = `You are MyMirro, an expert AI fashion stylist creating personalized outfit suggestions.

USER REQUEST:
"${userMessage}"

FASHION INTELLIGENCE:
- Vibe: ${fashionIntelligence.vibe}
- Aesthetic: ${fashionIntelligence.aesthetic}
- Fit Preference: ${fashionIntelligence.fit_preference}
- Color Direction: ${fashionIntelligence.color_direction}
- Occasion: ${fashionIntelligence.occasion}
- Mood: ${fashionIntelligence.mood}
- Gender Context: ${fashionIntelligence.gender_context}

${rulesFormatted}

${memoryContext}

WARDROBE COVERAGE:
${coverageFormatted}

COVERAGE INSTRUCTIONS:
${coverageInstructions}

USER'S WARDROBE:
${wardrobeFormatted}

TASK:
Generate ${candidateCount} complete outfit candidates using ONLY items from the user's wardrobe.

OUTFIT COMPLETENESS CONTRACT:
Each outfit MUST include:
- upper_wear (MANDATORY) - shirt, top, blouse, kurta, dress, etc.
- lower_wear (MANDATORY unless dress/jumpsuit) - pants, jeans, skirt, etc.
- footwear (MANDATORY) - shoes, sneakers, heels, etc.

Optional (include only if wardrobe has them and they make sense):
- layering - jacket, cardigan, blazer, etc.
- accessories - bag, belt, jewelry, watch (max 2)

DO NOT limit to 4 items. A complete look can be 3-6 items.

Return each outfit with SPECIFIC ITEM NAMES from wardrobe and slot assignments.

IMPORTANT: Return ONLY valid JSON array, no other text.

{
  "candidates": [
    {
      "id": "outfit_1",
      "title": "Catchy Gen-Z title",
      "slots": {
        "upper_wear": {
          "hint": "exact item name from wardrobe",
          "category": "tops|ethnic|dresses",
          "formality": "casual|smart|formal",
          "silhouette": "slim|regular|relaxed|oversized",
          "colorFamily": "black|white|blue|etc"
        },
        "lower_wear": {
          "hint": "exact item name from wardrobe",
          "category": "bottoms",
          "formality": "casual|smart|formal",
          "silhouette": "slim|regular|relaxed"
        },
        "footwear": {
          "hint": "exact item name from wardrobe",
          "category": "footwear",
          "subcategory": "sneakers|heels|boots|sandals|loafers|flip-flops",
          "formality": "casual|smart|formal"
        },
        "layering": {
          "hint": "exact item name OR null if not needed",
          "category": "outerwear"
        },
        "accessories": [
          {"hint": "exact item name", "category": "accessories"}
        ]
      },
      "why_it_works": "2-3 sentences explaining fit, color harmony, occasion appropriateness",
      "occasion": "${fashionIntelligence.occasion}",
      "vibe": "${fashionIntelligence.vibe}",
      "source": "llm"
    }
  ],
  "styling_notes": "Overall notes about the styling direction"
}`;

  type LLMCandidatesResponse = {
    candidates: OutfitDraft[];
    styling_notes?: string;
  };

  const fallbackCandidates: LLMCandidatesResponse = {
    candidates: createFallbackCandidates(wardrobeContext),
    styling_notes: "Using safe default suggestions",
  };

  const result = await callGeminiJson<LLMCandidatesResponse>(
    prompt,
    fallbackCandidates,
    {
      model: GEMINI_FLASH,
      temperature: 0.85,
      timeout: 15000,
      maxTokens: 4096,
    }
  );

  // Add coverage warning if wardrobe is incomplete
  let coverageWarning: string | undefined;
  if (!coverageProfile.canCreateCompleteOutfit) {
    coverageWarning = `Wardrobe missing: ${coverageProfile.missingMandatorySlots.join(", ")}`;
  }

  return {
    candidates: result.candidates || [],
    styling_notes: result.styling_notes || "",
    coverage_warning: coverageWarning,
  };
}

/**
 * V2: Evaluate and rank candidates, return top N
 */
export function evaluateAndRankCandidates(
  candidates: OutfitDraft[],
  rules: RulesEngineOutput,
  context: RuleContext,
  topN: number = 3
): {
  topOutfits: OutfitDraft[];
  passedCount: number;
  blockedCount: number;
  needsFallback: boolean;
  fallbackReason?: string;
} {
  if (candidates.length === 0) {
    return {
      topOutfits: [],
      passedCount: 0,
      blockedCount: 0,
      needsFallback: true,
      fallbackReason: "No candidates generated",
    };
  }

  // Use relaxed rules first (gives more chances to pass)
  const result = evaluateWithRelaxedRules(candidates, context, rules, topN);

  return {
    topOutfits: result.topOutfits,
    passedCount: result.passedCount,
    blockedCount: result.blockedCount,
    needsFallback: result.needsFallback,
    fallbackReason: result.fallbackReason,
  };
}

/**
 * V2: Convert OutfitDraft to legacy Outfit format
 */
export function convertDraftToOutfit(draft: OutfitDraft): Outfit {
  const items: string[] = [];

  if (draft.slots.upper_wear?.hint) {
    items.push(draft.slots.upper_wear.hint);
  }
  if (draft.slots.lower_wear?.hint) {
    items.push(draft.slots.lower_wear.hint);
  }
  if (draft.slots.footwear?.hint) {
    items.push(draft.slots.footwear.hint);
  }
  if (draft.slots.layering?.hint) {
    items.push(draft.slots.layering.hint);
  }
  if (draft.slots.accessories) {
    for (const acc of draft.slots.accessories) {
      if (acc.hint) items.push(acc.hint);
    }
  }

  return {
    title: draft.title,
    items,
    why_it_works: draft.why_it_works,
    occasion: draft.occasion,
    vibe: draft.vibe,
  };
}

/**
 * V2: Convert array of drafts to legacy format
 */
export function convertDraftsToOutfits(drafts: OutfitDraft[]): Outfit[] {
  return drafts.map(convertDraftToOutfit);
}

/**
 * V2: Create fallback candidates when LLM fails
 */
function createFallbackCandidates(wardrobeContext: WardrobeContext): OutfitDraft[] {
  const items = wardrobeContext.wardrobe_items;
  
  // Find items by category
  const tops = items.filter(i => 
    i.category?.toLowerCase().includes("top") || 
    i.category?.toLowerCase().includes("shirt")
  );
  const bottoms = items.filter(i => 
    i.category?.toLowerCase().includes("bottom") || 
    i.category?.toLowerCase().includes("pant") ||
    i.category?.toLowerCase().includes("jean")
  );
  const footwear = items.filter(i => 
    i.category?.toLowerCase().includes("shoe") || 
    i.category?.toLowerCase().includes("footwear")
  );

  if (tops.length === 0 || bottoms.length === 0 || footwear.length === 0) {
    // Not enough items for a complete outfit
    return [{
      id: "fallback_1",
      title: "Basic Look",
      slots: {
        upper_wear: { hint: tops[0]?.name || "A versatile top", category: "tops" },
        lower_wear: { hint: bottoms[0]?.name || "Comfortable bottoms", category: "bottoms" },
        footwear: { hint: footwear[0]?.name || "Your favorite shoes", category: "footwear" },
      },
      why_it_works: "A comfortable, everyday combination.",
      source: "fallback",
    }];
  }

  // Create a simple outfit from available items
  return [{
    id: "fallback_1",
    title: "Everyday Essential",
    slots: {
      upper_wear: { 
        hint: tops[0].name || `${tops[0].color} ${tops[0].category}`,
        category: "tops",
      },
      lower_wear: { 
        hint: bottoms[0].name || `${bottoms[0].color} ${bottoms[0].category}`,
        category: "bottoms",
      },
      footwear: { 
        hint: footwear[0].name || `${footwear[0].color} ${footwear[0].category}`,
        category: "footwear",
      },
    },
    why_it_works: "A safe, comfortable combination from your wardrobe.",
    source: "fallback",
  }];
}

/**
 * V2: Full outfit generation pipeline
 */
export async function generateOutfitsV2(
  userMessage: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  fashionIntelligence: FashionIntelligence,
  coverageProfile: WardrobeCoverageProfile,
  canonicalMemory?: CanonicalMemory,
  options?: {
    candidateCount?: number;
    topN?: number;
    climate?: "hot" | "mild" | "cold";
    formality?: "casual" | "smart" | "formal";
  }
): Promise<{
  outfits: Outfit[];
  drafts: OutfitDraft[];
  passedCount: number;
  blockedCount: number;
  needsFallback: boolean;
  coverageWarning?: string;
  styling_notes: string;
}> {
  const candidateCount = options?.candidateCount || 8;
  const topN = options?.topN || 3;

  // Step 1: Generate candidates
  const candidatesResult = await generateOutfitCandidatesV2(
    userMessage,
    wardrobeContext,
    rules,
    fashionIntelligence,
    coverageProfile,
    canonicalMemory,
    candidateCount
  );

  // Step 2: Create rule context
  const ruleContext: RuleContext = {
    responseMode: "visual_outfit",
    hasWardrobeItems: wardrobeContext.wardrobe_items.length > 0,
    climate: options?.climate || canonicalMemory?.climate_context?.value as any,
    formality: options?.formality || canonicalMemory?.formality_preference?.value as any,
  };

  // Step 3: Evaluate and rank
  const evalResult = evaluateAndRankCandidates(
    candidatesResult.candidates,
    rules,
    ruleContext,
    topN
  );

  // Step 4: Convert to legacy format
  const outfits = convertDraftsToOutfits(evalResult.topOutfits);

  return {
    outfits,
    drafts: evalResult.topOutfits,
    passedCount: evalResult.passedCount,
    blockedCount: evalResult.blockedCount,
    needsFallback: evalResult.needsFallback,
    coverageWarning: candidatesResult.coverage_warning,
    styling_notes: candidatesResult.styling_notes,
  };
}

/**
 * V2: Check if wardrobe can support outfit generation
 */
export function canGenerateOutfits(coverageProfile: WardrobeCoverageProfile): {
  canGenerate: boolean;
  missingSlots: string[];
  clarifyingQuestion?: string;
} {
  if (coverageProfile.canCreateCompleteOutfit) {
    return { canGenerate: true, missingSlots: [] };
  }

  const missingSlots = coverageProfile.missingMandatorySlots;
  let clarifyingQuestion: string | undefined;

  if (missingSlots.includes("footwear")) {
    clarifyingQuestion = "I noticed you don't have shoes in your wardrobe yet. Would you like me to suggest some to add, or should I create outfits and you can pair with shoes you have offline?";
  } else if (missingSlots.includes("upper_wear")) {
    clarifyingQuestion = "Your wardrobe seems to be missing tops. Would you like shopping suggestions to fill the gap?";
  } else if (missingSlots.includes("lower_wear")) {
    clarifyingQuestion = "I don't see any bottoms in your wardrobe. Want me to recommend some to add?";
  }

  return {
    canGenerate: false,
    missingSlots,
    clarifyingQuestion,
  };
}

