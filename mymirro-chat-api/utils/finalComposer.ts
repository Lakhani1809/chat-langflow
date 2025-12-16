/**
 * Final Stylist Response Composer
 * V2: Shopping comparison framework + decisiveness + confidence-aware behavior
 * V3: Engagement engine integration - keeps conversations alive
 * V4: Stylist Decision Layer - Forces decisive, non-hedging responses
 * V6: Canonical decision examples + compressed inputs for maximum authority
 */

import { callGeminiJson, GEMINI_FLASH } from "./geminiClient";
import type {
  FinalStylistOutput,
  IntentType,
  WardrobeContext,
  RulesEngineOutput,
  ConversationMemory,
  ColorAnalysis,
  SilhouetteAnalysis,
  BodyTypeAnalysis,
  Outfit,
  FashionIntelligence,
  ResponseMode,
  CanonicalMemory,
  ConfidenceSummary,
  ShoppingComparisonOutput,
  WardrobeCoverageProfile,
} from "../types";
import { formatMemoryForContext } from "./memory";
import { formatCanonicalMemoryForPrompt, getClarifyingQuestion } from "./memoryArbiter";
import { getConfidenceBehavior, getHedgingPhrase, getDecisivePhrase } from "./confidence";
import { 
  generateEngagement, 
  shouldShowGapMessage,
  type EngagementResult,
} from "./engagementEngine";
import type { StylistDecision } from "./stylistDecision";

// ============================================
// V6: CANONICAL DECISION EXAMPLES (HIGHEST ROI)
// These examples teach the LLM decisive stylist behavior
// DO NOT modify or add more than 5 examples
// ============================================

const CANONICAL_DECISION_EXAMPLES = `
Examples of decisive stylist behavior:

User: "Should I wear a hoodie or a jacket?"
A: "Jacket. It sharpens your silhouette and elevates the look. Skip the hoodie for this occasion."

User: "Is this outfit okay or should I change?"
A: "Change it. The fit is too relaxed for the setting and flattens your proportions."

User: "Can I wear sneakers to this dinner?"
A: "No. Go with clean loafers or boots — sneakers will underdress the look."

User: "Which color works better - blue or black?"
A: "Black. It's sharper for this vibe and easier to style. Blue reads more casual here."

User: "I'm not sure about this look"
A: "Trust it. The proportions are right and the colors work. You're overthinking — go with it."

Follow this decision style exactly.
`;

// ============================================
// V6: NON-OVERRIDABLE DECISION INSTRUCTION
// The LLM must explain decisions, not re-evaluate them
// ============================================

const DECISION_AUTHORITY_INSTRUCTION = `
IMPORTANT:
A stylist decision has already been made upstream.
You must NOT reconsider it.
You must NOT present alternatives.
You must NOT hedge.
Your role is to confidently explain and justify the chosen direction.
`;

const FORCE_DECISIVE_INSTRUCTION = `
Even if confidence is low, you must remain decisive and directional.
Do not express uncertainty. Commit to the decision fully.
`;

// ============================================
// V4: ANTI-HEDGING CONSTANTS
// ============================================

const MAX_EXPLANATION_LINES = 2;
const MAX_REASON_LINES = 2;

/**
 * Hedging phrases to strip from responses
 */
const HEDGING_PHRASES = [
  "you could",
  "you might",
  "might work",
  "could work",
  "both are good",
  "both work",
  "either would",
  "it depends",
  "depends on your preference",
  "up to you",
  "personal preference",
  "whatever you prefer",
  "you may want to",
  "you may consider",
  "consider trying",
  "you can try",
  "perhaps",
  "maybe",
  "possibly",
];

/**
 * Decisive replacements for hedging phrases
 */
const DECISIVE_REPLACEMENTS: Record<string, string> = {
  "you could": "go with",
  "you might": "try",
  "might work": "works",
  "could work": "works",
  "both are good": "this one hits harder",
  "both work": "this is the better choice",
  "either would": "go with",
  "it depends": "here's the move",
  "depends on your preference": "here's what I'd pick",
  "up to you": "here's the call",
  "personal preference": "here's my take",
  "whatever you prefer": "here's the winner",
  "you may want to": "go ahead and",
  "you may consider": "try",
  "consider trying": "rock",
  "you can try": "rock",
  "perhaps": "",
  "maybe": "",
  "possibly": "",
};

/**
 * Remove hedging language from a message
 */
function removeHedging(message: string): string {
  let result = message;
  
  for (const [hedge, replacement] of Object.entries(DECISIVE_REPLACEMENTS)) {
    const regex = new RegExp(hedge, "gi");
    result = result.replace(regex, replacement);
  }
  
  // Clean up double spaces
  result = result.replace(/\s{2,}/g, " ").trim();
  
  return result;
}

/**
 * Limit explanation length
 */
function limitExplanation(text: string, maxLines: number = MAX_EXPLANATION_LINES): string {
  const lines = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (lines.length <= maxLines) return text;
  
  return lines.slice(0, maxLines).join(". ").trim() + ".";
}

/**
 * V6: Build NON-OVERRIDABLE decision context
 * The LLM must explain the decision, not re-evaluate it
 */
function buildDecisionContext(decision: StylistDecision): string {
  if (!decision) return "";
  
  const lines: string[] = [];
  
  // V6: Add authority instruction first
  lines.push(DECISION_AUTHORITY_INSTRUCTION);
  
  if (decision.decisionType === "choose_one" && decision.chosenOption) {
    lines.push(`FINAL DECISION: "${decision.chosenOption}"`);
    lines.push(`REASON: ${decision.rationale}`);
    if (decision.rejectedOption) {
      lines.push(`SKIPPED: "${decision.rejectedOption}" (mention briefly as justification, NEVER as alternative)`);
    }
    lines.push("OUTPUT RULE: Reference ONLY the chosen option. The rejected option is NOT an alternative.");
  } else if (decision.decisionType === "outfit_set") {
    lines.push("DECISION: Generate complete, opinionated outfit sets.");
    lines.push("RULE: Each outfit is a full look. No alternatives within outfits.");
  } else if (decision.decisionType === "no_outfit") {
    lines.push("DECISION: Advisory response only - NO outfits.");
  }
  
  // V6: Add force decisive instruction if needed
  if (decision.forceDecisive) {
    lines.push(FORCE_DECISIVE_INSTRUCTION);
  }
  
  return lines.join("\n");
}

/**
 * V6: Compress analysis into 1-line constraints only
 * No paragraphs, no theory, no multi-line reasoning
 */
function compressAnalysis(analyses: {
  color?: ColorAnalysis;
  silhouette?: SilhouetteAnalysis;
  bodyType?: BodyTypeAnalysis;
  fashionIntelligence?: FashionIntelligence;
}): string {
  const constraints: string[] = [];
  
  // Extract only final conclusions - no theory
  if (analyses.color?.color_direction) {
    constraints.push(`Color: ${analyses.color.color_direction}`);
  }
  if (analyses.silhouette?.silhouette_verdict) {
    constraints.push(`Silhouette: ${analyses.silhouette.silhouette_verdict}`);
  }
  if (analyses.bodyType?.body_type) {
    constraints.push(`Body: ${analyses.bodyType.body_type}`);
  }
  if (analyses.fashionIntelligence?.vibe) {
    constraints.push(`Vibe: ${analyses.fashionIntelligence.vibe}`);
  }
  if (analyses.fashionIntelligence?.occasion) {
    constraints.push(`Occasion: ${analyses.fashionIntelligence.occasion}`);
  }
  
  if (constraints.length === 0) return "";
  
  return `CONSTRAINTS: ${constraints.join(" | ")}`;
}

/**
 * V6: Compress wardrobe to counts only
 */
function compressWardrobe(wardrobeContext: WardrobeContext): string {
  const count = wardrobeContext.wardrobe_items.length;
  if (count === 0) return "WARDROBE: Empty";
  return `WARDROBE: ${count} items available`;
}

/**
 * Build wardrobe gap context (one honest line)
 */
function buildWardrobeGapContext(coverage?: WardrobeCoverageProfile): string {
  if (!coverage) return "";
  
  const missingSlots = coverage.missingMandatorySlots || [];
  
  if (missingSlots.length === 0) return "";
  
  // Only mention if significant gaps
  if (missingSlots.length >= 2) {
    const formatted = missingSlots.slice(0, 2).map(s => s.replace("_", " ")).join(" and ");
    return `WARDROBE NOTE: User is missing ${formatted} - acknowledge this briefly but still provide best options.`;
  }
  
  return "";
}

const FALLBACK_OUTPUT: FinalStylistOutput = {
  message: "I'd love to help you with your style! Let me know what you're looking for.",
  outfits: [],
  extra_tips: ["Focus on pieces that make you feel confident!"],
  suggestion_pills: ["Show me outfits", "What colors work?", "Shopping ideas"],
};

/**
 * Build quick rules string from analyses (no LLM call)
 */
function buildQuickRulesFromAnalyses(
  rules: RulesEngineOutput,
  colorAnalysis?: ColorAnalysis,
  silhouetteAnalysis?: SilhouetteAnalysis,
  bodyTypeAnalysis?: BodyTypeAnalysis,
  fashionIntelligence?: FashionIntelligence
): string {
  const rulesList: string[] = [];

  // Core directions
  if (rules.core_directions.length > 0) {
    rulesList.push(...rules.core_directions.slice(0, 2));
  }

  // Color rules
  if (colorAnalysis?.color_direction) {
    rulesList.push(`Color direction: ${colorAnalysis.color_direction}`);
  }
  if (colorAnalysis?.combos && colorAnalysis.combos.length > 0) {
    rulesList.push(`Good combos: ${colorAnalysis.combos.slice(0, 2).join(", ")}`);
  }

  // Silhouette
  if (silhouetteAnalysis?.silhouette_verdict) {
    rulesList.push(`Silhouette: ${silhouetteAnalysis.silhouette_verdict}`);
  }

  // Body type
  if (bodyTypeAnalysis?.flattering_styles && bodyTypeAnalysis.flattering_styles.length > 0) {
    rulesList.push(`Flattering: ${bodyTypeAnalysis.flattering_styles[0]}`);
  }

  // Fashion intelligence
  if (fashionIntelligence?.vibe) {
    rulesList.push(`Vibe: ${fashionIntelligence.vibe}`);
  }
  if (fashionIntelligence?.aesthetic) {
    rulesList.push(`Aesthetic: ${fashionIntelligence.aesthetic}`);
  }

  return rulesList.length > 0 ? rulesList.map(r => `• ${r}`).join("\n") : "• Keep it stylish and comfortable";
}

/**
 * Get user tone instruction for Gen-Z rewriting
 */
function getToneInstruction(userTone?: string): string {
  const toneGuide: Record<string, string> = {
    very_casual_genz: "Use Gen-Z slang naturally (slay, it's giving, no cap). Be super casual and fun.",
    casual_friendly: "Light and conversational. Use occasional fun words. Like texting a friend.",
    neutral_friendly: "Warm but not too casual. Minimal slang. Professional yet approachable.",
    polite_professional: "Friendly but polished. Clear and helpful without being stiff.",
    enthusiastic: "Extra excited energy! Use exclamation points. Be a hype bestie!",
  };

  return toneGuide[userTone || "casual_friendly"] || toneGuide.casual_friendly;
}

/**
 * Generate contextual suggestion pills based on response
 */
export function generateSuggestionPills(
  intent: IntentType,
  hasOutfits: boolean,
  hasBrands: boolean,
  hasPackingList: boolean,
  hasTrendSummary: boolean
): string[] {
  const pills: string[] = [];

  // Intent-specific pills
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
      pills.push("More outfits");
      pills.push("Make it casual");
      pills.push("Add accessories");
      pills.push("Formal version");
      break;
      
    case "item_recommendation":
    case "category_recommendation":
      pills.push("Show similar items");
      pills.push("Style this piece");
      pills.push("What goes with it?");
      pills.push("Shop alternatives");
      break;
      
    case "shopping_help":
      pills.push("Budget options");
      pills.push("Premium picks");
      pills.push("Show me outfits");
      pills.push("Local brands");
      break;
      
    case "trend_analysis":
      pills.push("How to wear this");
      pills.push("Shop the trend");
      pills.push("Make it work for me");
      pills.push("Next trend?");
      break;
      
    case "travel_packing":
      pills.push("More outfit combos");
      pills.push("What to buy");
      pills.push("Beach looks");
      pills.push("Evening options");
      break;
      
    case "color_analysis":
      pills.push("Show me outfits");
      pills.push("Contrast colors");
      pills.push("Monochrome look");
      pills.push("Bold accent ideas");
      break;
      
    case "body_type_advice":
      pills.push("Show me outfits");
      pills.push("Best silhouettes");
      pills.push("Patterns that work");
      pills.push("Casual options");
      break;
      
    case "wardrobe_query":
      pills.push("Style these items");
      pills.push("What's missing?");
      pills.push("Outfit ideas");
      pills.push("Capsule wardrobe");
      break;
      
    case "continuation_query":
      pills.push("Even more options");
      pills.push("Different style");
      pills.push("Simpler look");
      pills.push("Statement piece");
      break;
      
    case "general_chat":
    default:
      pills.push("Outfit for today");
      pills.push("What's trending?");
      pills.push("My wardrobe");
      pills.push("Shopping help");
      break;
  }

  // Contextual additions based on response content
  if (hasOutfits) {
    if (!pills.includes("Add accessories")) {
      pills.push("Add layers");
    }
  }
  
  if (!hasBrands && intent !== "shopping_help") {
    pills.push("Shop similar");
  }

  // Shuffle slightly for variety and limit to 4-6
  return shuffleArray(pills).slice(0, 6);
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Compose final response from all inputs
 * OPTIMIZED: Now includes Gen-Z tone rewriting directly (saves 1 LLM call)
 * V4: Enforces stylist decision - no hedging allowed
 */
export async function composeFinalResponse(
  intent: IntentType,
  userMessage: string,
  moduleOutput: unknown,
  moduleName: string,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  analyses: {
    color?: ColorAnalysis;
    silhouette?: SilhouetteAnalysis;
    bodyType?: BodyTypeAnalysis;
    fashionIntelligence?: FashionIntelligence;
  },
  memory?: ConversationMemory,
  stylistDecision?: StylistDecision,
  wardrobeCoverage?: WardrobeCoverageProfile
): Promise<FinalStylistOutput> {
  // Build quick rules from all analyses (merged reasoning - saves 1 LLM call)
  const quickRulesStr = buildQuickRulesFromAnalyses(
    rules,
    analyses.color,
    analyses.silhouette,
    analyses.bodyType,
    analyses.fashionIntelligence
  );
  
  const memoryContext = memory ? formatMemoryForContext(memory) : "";
  const userTone = memory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  // Build module output summary
  const moduleOutputStr = JSON.stringify(moduleOutput, null, 2);

  // Determine if this intent should generate outfits
  const outfitIntents: IntentType[] = [
    "outfit_generation", 
    "event_styling", 
    "travel_packing", 
    "continuation_query"
  ];
  const shouldGenerateOutfits = outfitIntents.includes(intent);

  // Build intent-specific JSON structure
  const getResponseStructure = () => {
    if (shouldGenerateOutfits) {
      return `{
  "message": "Short Gen-Z friendly message with emoji (2-3 sentences max)...",
  "outfits": [
    {
      "title": "Catchy outfit name",
      "items": ["item 1", "item 2", "item 3"],
      "why_it_works": "One short natural sentence"
    }
  ],
  "extra_tips": ["brief tip 1", "brief tip 2"]
}`;
    } else if (intent === "trend_analysis") {
      return `{
  "message": "Short Gen-Z friendly message about the trends with emoji (2-3 sentences max)...",
  "trend_summary": "Key trends and insights from the module output",
  "extra_tips": ["how to incorporate trend 1", "how to incorporate trend 2"]
}`;
    } else if (intent === "shopping_help") {
      return `{
  "message": "Short Gen-Z friendly shopping advice with emoji (2-3 sentences max)...",
  "items": ["recommended item 1", "recommended item 2"],
  "brands": ["brand suggestion 1", "brand suggestion 2"],
  "extra_tips": ["shopping tip 1", "shopping tip 2"]
}`;
    } else {
      return `{
  "message": "Short Gen-Z friendly response with emoji (2-3 sentences max)...",
  "extra_tips": ["helpful tip 1", "helpful tip 2"]
}`;
    }
  };

  // Get intent-specific instructions
  const getIntentInstructions = () => {
    if (shouldGenerateOutfits) {
      return `3. Include the outfit suggestions from the module output
4. The "why_it_works" should be 1 SHORT natural sentence`;
    } else if (intent === "trend_analysis") {
      return `3. Focus on trends and fashion insights - DO NOT generate outfit suggestions
4. Explain what's trending and how to incorporate it generally`;
    } else if (intent === "shopping_help") {
      return `3. Focus on shopping advice and recommendations - DO NOT generate complete outfit suggestions
4. Recommend specific items or brands to look for`;
    } else {
      return `3. Answer the user's question directly
4. Be helpful and conversational`;
    }
  };

  // V6: Build decision enforcement string (NON-OVERRIDABLE)
  const decisionContext = stylistDecision ? buildDecisionContext(stylistDecision) : "";
  
  // V6: Compress analysis to 1-line constraints only
  const compressedConstraints = compressAnalysis(analyses);
  
  // V6: Compress wardrobe to counts only
  const wardrobeSummary = compressWardrobe(wardrobeContext);
  
  // V6: Wardrobe gap context (one honest line)
  const wardrobeGapContext = buildWardrobeGapContext(wardrobeCoverage);

  // V6 OPTIMIZED PROMPT: Canonical examples + compressed inputs + decision authority
  const prompt = `You are MyMirro, a decisive AI personal stylist.

${CANONICAL_DECISION_EXAMPLES}

${decisionContext}

USER: "${userMessage}"
INTENT: ${intent}
${compressedConstraints}
${wardrobeSummary}
${wardrobeGapContext}
TONE: ${toneInstruction}

MODULE OUTPUT:
${moduleOutputStr}

TASK: Respond decisively. 2-3 sentences max.

RULES:
1. ${getIntentInstructions()}
2. Be SHORT and CONFIDENT
3. No hedging, no alternatives
4. Add 1-2 brief tips

${getResponseStructure()}`;

  const response = await callGeminiJson<FinalStylistOutput>(prompt, FALLBACK_OUTPUT, {
    model: GEMINI_FLASH, // Use flash model for final response
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2048,
  });

  // V4: Post-process to remove any remaining hedging language
  if (response.message) {
    response.message = removeHedging(response.message);
  }
  
  // V4: Limit explanation length in outfit descriptions
  if (response.outfits) {
    response.outfits = response.outfits.map(outfit => ({
      ...outfit,
      why_it_works: outfit.why_it_works ? limitExplanation(outfit.why_it_works) : outfit.why_it_works,
    }));
  }
  
  // V4: Limit extra tips length
  if (response.extra_tips) {
    response.extra_tips = response.extra_tips.map(tip => limitExplanation(tip, 2));
  }

  // Generate suggestion pills based on response
  const hasOutfits = response.outfits && response.outfits.length > 0;
  const hasBrands = response.brands && response.brands.length > 0;
  const hasPackingList = response.packing_list && response.packing_list.length > 0;
  const hasTrendSummary = !!response.trend_summary;

  // V3: Generate engagement content
  const conversationTurn = memory?.recentUserMessages?.length || 1;
  const engagement = generateEngagement(
    intent,
    wardrobeContext,
    hasOutfits || false,
    conversationTurn,
    memory
  );

  // Use engagement pills instead of standard pills (more engaging)
  response.suggestion_pills = engagement.engagementPills;

  // Append next step suggestion to message if not already long
  if (response.message && response.message.length < 300) {
    // Add next step as a new line
    response.message = `${response.message}\n\n${engagement.nextStepSuggestion}`;
    
    // V4: Add wardrobe gap message only if relevant and not spammy
    // This is now handled in prompt context, so only add engagement gap message for upload CTA
    if (engagement.wardrobeGapMessage && 
        wardrobeCoverage?.totalItems === 0 && 
        shouldShowGapMessage(conversationTurn, wardrobeContext.wardrobe_items.length)) {
      response.extra_tips = response.extra_tips || [];
      response.extra_tips.unshift(engagement.wardrobeGapMessage); // Put at start for visibility
    }
  }

  return response;
}

/**
 * Compose response for general chat (no module)
 * OPTIMIZED: Includes Gen-Z tone directly
 */
export async function composeGeneralChatResponse(
  userMessage: string,
  memory?: ConversationMemory
): Promise<FinalStylistOutput> {
  const memoryContext = memory ? formatMemoryForContext(memory) : "";
  const userTone = memory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  const prompt = `You are MyMirro, a friendly AI personal stylist for Gen-Z and young professionals in India.

${memoryContext ? `CONVERSATION CONTEXT:\n${memoryContext}\n` : ""}

USER MESSAGE:
"${userMessage}"

USER'S TONE: ${userTone}
TONE INSTRUCTION: ${toneInstruction}

TASK:
Respond like a stylish bestie texting back. Keep it SHORT (2-3 sentences max).

You're their fashion bestie. Be:
- ${toneInstruction}
- Add 1-2 emojis naturally
- Warm and genuine

If they're asking about fashion - give quick helpful advice.
If they're just chatting - be friendly and steer toward style topics.

Return JSON with just the message:
{
  "message": "Your short Gen-Z friendly response with emoji..."
}`;

  try {
    const response = await callGeminiJson<{ message: string }>(
      prompt,
      { message: "Hey! I'm here for all your style questions. What's up? ✨" },
      { model: GEMINI_FLASH, temperature: 0.85, timeout: 8000 }
    );
    
    const message = typeof response === "string" ? response : response.message || "";
    
    return {
      message,
      suggestion_pills: generateSuggestionPills("general_chat", false, false, false, false),
    };
  } catch {
    return {
      message: "Hey! I'm here for all your style questions. What's up? ✨",
      suggestion_pills: ["Outfit for today", "What's trending?", "My wardrobe", "Shopping help"],
    };
  }
}

/**
 * Compose response for color analysis intent
 * OPTIMIZED: Includes Gen-Z tone directly
 */
export async function composeColorAnalysisResponse(
  userMessage: string,
  colorAnalysis: ColorAnalysis,
  wardrobeContext: WardrobeContext,
  memory?: ConversationMemory
): Promise<FinalStylistOutput> {
  const userTone = memory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  const prompt = `You are MyMirro, a color expert stylist and fashion bestie.

USER MESSAGE: "${userMessage}"

COLOR ANALYSIS:
${JSON.stringify(colorAnalysis, null, 2)}

WARDROBE SIZE: ${wardrobeContext.wardrobe_items.length} items

USER'S TONE: ${userTone}
TONE INSTRUCTION: ${toneInstruction}

TASK:
Give color advice like a stylish bestie would. Keep it SHORT and conversational.

Include:
1. Quick personalized color advice (2-3 sentences)
2. Specific combos they can try
3. Brief tips

TONE: ${toneInstruction}. Add 1-2 emojis naturally. NO marketing speak.

IMPORTANT: Return ONLY valid JSON.

{
  "message": "Short Gen-Z friendly color advice with emoji...",
  "outfits": [],
  "extra_tips": ["color tip 1", "color tip 2"]
}`;

  const response = await callGeminiJson<FinalStylistOutput>(prompt, FALLBACK_OUTPUT, {
    model: GEMINI_FLASH,
    temperature: 0.8,
    timeout: 10000,
  });

  response.suggestion_pills = generateSuggestionPills("color_analysis", false, false, false, false);

  return response;
}

/**
 * Compose response for body type advice intent
 * OPTIMIZED: Includes Gen-Z tone directly
 */
export async function composeBodyTypeResponse(
  userMessage: string,
  bodyTypeAnalysis: BodyTypeAnalysis,
  wardrobeContext: WardrobeContext,
  memory?: ConversationMemory
): Promise<FinalStylistOutput> {
  const userTone = memory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  const prompt = `You are MyMirro, a body-positive stylist and fashion bestie.

USER MESSAGE: "${userMessage}"

BODY TYPE ANALYSIS:
${JSON.stringify(bodyTypeAnalysis, null, 2)}

WARDROBE SIZE: ${wardrobeContext.wardrobe_items.length} items

USER'S TONE: ${userTone}
TONE INSTRUCTION: ${toneInstruction}

TASK:
Give body-positive styling advice like a supportive bestie. Keep it SHORT.

Requirements:
1. Be empowering (NEVER mention weight, hiding, or minimizing)
2. Focus on highlighting their best features
3. Give quick practical tips
4. Sound like their hype bestie

TONE: ${toneInstruction}. Add 1-2 emojis naturally. Be a supportive friend cheering them on.

IMPORTANT: Return ONLY valid JSON.

{
  "message": "Short empowering Gen-Z message with emoji...",
  "outfits": [],
  "extra_tips": ["styling tip 1", "tip 2"]
}`;

  const response = await callGeminiJson<FinalStylistOutput>(prompt, FALLBACK_OUTPUT, {
    model: GEMINI_FLASH,
    temperature: 0.8,
    timeout: 10000,
  });

  response.suggestion_pills = generateSuggestionPills("body_type_advice", false, false, false, false);

  return response;
}

/**
 * Merge multiple outfit arrays without duplicates
 */
export function mergeOutfits(
  ...outfitArrays: (Outfit[] | undefined)[]
): Outfit[] {
  const seen = new Set<string>();
  const merged: Outfit[] = [];

  for (const outfits of outfitArrays) {
    if (!outfits) continue;
    for (const outfit of outfits) {
      const key = outfit.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(outfit);
      }
    }
  }

  return merged;
}

/**
 * Format final output for API response
 */
export function formatFinalOutput(
  intent: IntentType,
  composedResponse: FinalStylistOutput,
  moduleOutput: unknown
): {
  message: string;
  outfits?: Outfit[];
  items?: string[];
  brands?: string[];
  packing_list?: string[];
  trend_summary?: string;
  extra_tips?: string[];
  suggestion_pills?: string[];
} {
  const output: {
    message: string;
    outfits?: Outfit[];
    items?: string[];
    brands?: string[];
    packing_list?: string[];
    trend_summary?: string;
    extra_tips?: string[];
    suggestion_pills?: string[];
  } = {
    message: composedResponse.message,
  };

  // Add outfits if present
  if (composedResponse.outfits && composedResponse.outfits.length > 0) {
    output.outfits = composedResponse.outfits;
  }

  // Add extra tips
  if (composedResponse.extra_tips && composedResponse.extra_tips.length > 0) {
    output.extra_tips = composedResponse.extra_tips;
  }

  // Add suggestion pills
  if (composedResponse.suggestion_pills && composedResponse.suggestion_pills.length > 0) {
    output.suggestion_pills = composedResponse.suggestion_pills;
  }

  // Add module-specific fields
  const mod = moduleOutput as Record<string, unknown>;

  if (mod) {
    if (Array.isArray(mod.items)) {
      output.items = mod.items as string[];
    }
    if (Array.isArray(mod.brands)) {
      output.brands = mod.brands as string[];
    }
    if (Array.isArray(mod.packing_list)) {
      output.packing_list = mod.packing_list as string[];
    }
    if (typeof mod.trend_summary === "string") {
      output.trend_summary = mod.trend_summary;
    }
  }

  return output;
}

// ============================================
// V2: SHOPPING COMPARISON FRAMEWORK
// ============================================

/**
 * V2: Compose shopping comparison response
 * V6: DECISIVE - Uses canonical examples + non-overridable decision
 */
export async function composeShoppingComparisonV2(
  userMessage: string,
  canonicalMemory: CanonicalMemory,
  confidenceSummary: ConfidenceSummary,
  wardrobeContext?: WardrobeContext,
  explicitWardrobeRequest?: boolean,
  stylistDecision?: StylistDecision
): Promise<FinalStylistOutput> {
  const userTone = canonicalMemory.rawMemory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  // V6: Compress memory to key preferences only
  const compressedPrefs = [
    canonicalMemory.vibes?.slice(0, 2).join(", "),
    canonicalMemory.formality_preference?.value,
    canonicalMemory.fit_preference?.value,
  ].filter(Boolean).join(" | ");

  // V6: Compress wardrobe to count only
  const wardrobeCount = wardrobeContext?.wardrobe_items.length || 0;

  // V6: Build non-overridable decision context
  const decisionContext = stylistDecision ? buildDecisionContext(stylistDecision) : "";

  // V6 OPTIMIZED PROMPT: Canonical examples + decision authority
  const prompt = `You are MyMirro, a decisive stylist.

${CANONICAL_DECISION_EXAMPLES}

${decisionContext}

USER: "${userMessage}"
PREFS: ${compressedPrefs || "versatile style"}
WARDROBE: ${wardrobeCount} items
TONE: ${toneInstruction}

TASK: SHOPPING VERDICT
Pick ONE option. No "both work". No "depends".

{
  "verdict": "Buy [item] - [1 sentence why]",
  "reasons": ["reason 1", "reason 2"],
  "alternative_when": "Get the other when [specific scenario]"
}

Return JSON only.`;

  type ShoppingResponse = {
    verdict: string;
    reasons: string[];
    alternative_when: string;
    wardrobe_styling_hint?: string;
  };

  const fallback: ShoppingResponse = {
    verdict: "Go with the more versatile option",
    reasons: [
      "It'll work with more outfits in your wardrobe",
      "Better value for your style goals",
      "Matches your current aesthetic"
    ],
    alternative_when: "Consider the other when you need something for a specific occasion"
  };

  const response = await callGeminiJson<ShoppingResponse>(prompt, fallback, {
    model: GEMINI_FLASH,
    temperature: 0.7,
    timeout: 10000,
  });

  // Format as final output message
  const message = formatShoppingComparisonMessage(response, userTone);

  return {
    message,
    outfits: undefined, // NO outfits in shopping comparison
    extra_tips: response.reasons,
    suggestion_pills: generateSuggestionPills("shopping_help", false, true, false, false),
  };
}

/**
 * Format shopping comparison into a natural message
 */
function formatShoppingComparisonMessage(
  response: {
    verdict: string;
    reasons: string[];
    alternative_when: string;
    wardrobe_styling_hint?: string;
  },
  userTone: string
): string {
  const emoji = userTone.includes("genz") ? "🔥" : "✨";
  
  let message = `${emoji} ${response.verdict}!\n\n`;
  message += `Here's why:\n`;
  message += response.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  message += `\n\n${response.alternative_when}`;
  
  if (response.wardrobe_styling_hint) {
    message += `\n\n💡 Styling tip: ${response.wardrobe_styling_hint}`;
  }
  
  return message;
}

// ============================================
// V2: CONFIDENCE-AWARE RESPONSE COMPOSER
// ============================================

/**
 * V2: Compose response with confidence awareness
 * V6: Uses canonical examples + compressed inputs + non-overridable decisions
 */
export async function composeFinalResponseV2(
  intent: IntentType,
  userMessage: string,
  moduleOutput: unknown,
  moduleName: string,
  responseMode: ResponseMode,
  canonicalMemory: CanonicalMemory,
  confidenceSummary: ConfidenceSummary,
  wardrobeContext: WardrobeContext,
  rules: RulesEngineOutput,
  analyses: {
    color?: ColorAnalysis;
    silhouette?: SilhouetteAnalysis;
    bodyType?: BodyTypeAnalysis;
    fashionIntelligence?: FashionIntelligence;
  },
  stylistDecision?: StylistDecision
): Promise<FinalStylistOutput> {
  const behavior = getConfidenceBehavior(confidenceSummary.final.score);
  
  // V6: Don't ask clarification - proceed decisively
  // (Clarification is now handled upstream in route.ts)

  // Handle shopping comparison mode separately
  if (responseMode === "shopping_comparison") {
    return composeShoppingComparisonV2(
      userMessage,
      canonicalMemory,
      confidenceSummary,
      wardrobeContext,
      false,
      stylistDecision
    );
  }

  // V6: Compress analysis to 1-line constraints only
  const compressedConstraints = compressAnalysis(analyses);
  
  // V6: Compress wardrobe to count only
  const wardrobeSummary = compressWardrobe(wardrobeContext);

  const userTone = canonicalMemory.rawMemory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  // V6: Build non-overridable decision context
  const decisionContext = stylistDecision ? buildDecisionContext(stylistDecision) : "";

  const moduleOutputStr = JSON.stringify(moduleOutput, null, 2);

  // V6 OPTIMIZED PROMPT: Canonical examples + compressed inputs
  const prompt = `You are MyMirro, a decisive stylist.

${CANONICAL_DECISION_EXAMPLES}

${decisionContext}

USER: "${userMessage}"
INTENT: ${intent}
${compressedConstraints}
${wardrobeSummary}
TONE: ${toneInstruction}

MODULE OUTPUT:
${moduleOutputStr}

TASK: Respond decisively. 2-3 sentences max.
${responseMode === "advisory_text" ? "NO outfits." : "Include outfits from module output."}

{
  "message": "Short confident message...",
  ${responseMode === "visual_outfit" ? '"outfits": [{"title": "...", "items": [...], "why_it_works": "1 sentence"}],' : ""}
  "extra_tips": ["tip 1", "tip 2"]
}`;

  const response = await callGeminiJson<FinalStylistOutput>(prompt, FALLBACK_OUTPUT, {
    model: GEMINI_FLASH,
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2048,
  });

  // Enforce response mode contract
  // Note: shopping_comparison is already handled above, but we check both for safety
  if (responseMode === "advisory_text" || (responseMode as string) === "shopping_comparison") {
    response.outfits = undefined;
  }

  // Generate suggestion pills
  const hasOutfits = response.outfits && response.outfits.length > 0;
  const hasBrands = response.brands && response.brands.length > 0;

  response.suggestion_pills = generateSuggestionPills(
    intent,
    hasOutfits || false,
    hasBrands || false,
    false,
    false
  );

  return response;
}

// ============================================
// V2: CLARIFYING QUESTION COMPOSER
// ============================================

/**
 * V2: Compose a clarifying question response
 */
export function composeClarifyingQuestionResponse(
  canonicalMemory: CanonicalMemory,
  coverageWarning?: string
): FinalStylistOutput {
  let question = getClarifyingQuestion(canonicalMemory);
  
  // If coverage issue, prioritize that
  if (coverageWarning && coverageWarning.includes("footwear")) {
    question = "Quick question - I noticed you don't have shoes in your wardrobe yet. Should I suggest some to add, or create outfits that you can pair with shoes you have offline? 👟";
  } else if (coverageWarning) {
    question = `Heads up: ${coverageWarning}. Should I suggest what to add, or work with what you have? 🤔`;
  }

  return {
    message: question || "Just to make sure I get this right - tell me a bit more about what you're looking for? 💭",
    outfits: undefined,
    suggestion_pills: ["Use what I have", "Suggest what to buy", "Skip and give me options"],
  };
}

// ============================================
// V2: FORMAT OUTPUT WITH RESPONSE MODE
// ============================================

/**
 * V2: Format final output respecting response mode
 */
export function formatFinalOutputV2(
  intent: IntentType,
  responseMode: ResponseMode,
  composedResponse: FinalStylistOutput,
  moduleOutput: unknown
): {
  message: string;
  outfits?: Outfit[];
  items?: string[];
  brands?: string[];
  packing_list?: string[];
  trend_summary?: string;
  extra_tips?: string[];
  suggestion_pills?: string[];
} {
  const baseOutput = formatFinalOutput(intent, composedResponse, moduleOutput);

  // Enforce response mode contract
  if (responseMode === "advisory_text" || responseMode === "shopping_comparison") {
    delete baseOutput.outfits;
  }

  return baseOutput;
}
