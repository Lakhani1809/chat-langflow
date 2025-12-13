/**
 * Final Stylist Response Composer
 * V2: Shopping comparison framework + decisiveness + confidence-aware behavior
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
} from "../types";
import { formatMemoryForContext } from "./memory";
import { formatCanonicalMemoryForPrompt, getClarifyingQuestion } from "./memoryArbiter";
import { getConfidenceBehavior, getHedgingPhrase, getDecisivePhrase } from "./confidence";

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
  memory?: ConversationMemory
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

  // OPTIMIZED PROMPT: Includes rules reasoning + Gen-Z tone directly
  const prompt = `You are MyMirro, a world-class AI personal stylist for Gen-Z and young professionals in India.

USER MESSAGE:
"${userMessage}"

INTENT: ${intent}
MODULE USED: ${moduleName}

MODULE OUTPUT:
${moduleOutputStr}

STYLING GUIDANCE (use these to inform your response):
${quickRulesStr}

${memoryContext ? `CONVERSATION CONTEXT:\n${memoryContext}` : ""}

WARDROBE SIZE: ${wardrobeContext.wardrobe_items.length} items

USER'S COMMUNICATION STYLE: ${userTone}
TONE INSTRUCTION: ${toneInstruction}

TASK:
Create the final response for the user. You're their stylish bestie helping them slay.

Requirements:
1. Write in Gen-Z friendly tone as per the tone instruction above
2. Keep it SHORT - 2-3 sentences max for the message
3. Include the outfit suggestions from the module output (if any)
4. The "why_it_works" should be 1 SHORT natural sentence
5. Add 2 practical extra tips (keep them brief)
6. Sound like their fashion bestie, not a bot

TONE MUST BE:
- ${toneInstruction}
- Add 1-3 emojis naturally (don't overdo it)
- NO "I recommend" or "I suggest" - just tell them what slaps

DO NOT:
- Invent new outfit suggestions (use what's in module output)
- Make the message too long or formal
- Sound robotic or generic
- Use corporate/marketing language

IMPORTANT: Return ONLY valid JSON, no other text.

{
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

  const response = await callGeminiJson<FinalStylistOutput>(prompt, FALLBACK_OUTPUT, {
    model: GEMINI_FLASH, // Use flash model for final response
    temperature: 0.8,
    timeout: 12000,
    maxTokens: 2048,
  });

  // Generate suggestion pills based on response
  const hasOutfits = response.outfits && response.outfits.length > 0;
  const hasBrands = response.brands && response.brands.length > 0;
  const hasPackingList = response.packing_list && response.packing_list.length > 0;
  const hasTrendSummary = !!response.trend_summary;

  response.suggestion_pills = generateSuggestionPills(
    intent,
    hasOutfits || false,
    hasBrands || false,
    hasPackingList || false,
    hasTrendSummary
  );

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
 * DECISIVE - Must give a verdict, not neutral
 */
export async function composeShoppingComparisonV2(
  userMessage: string,
  canonicalMemory: CanonicalMemory,
  confidenceSummary: ConfidenceSummary,
  wardrobeContext?: WardrobeContext,
  explicitWardrobeRequest?: boolean
): Promise<FinalStylistOutput> {
  const memoryFormatted = formatCanonicalMemoryForPrompt(canonicalMemory);
  const behavior = getConfidenceBehavior(confidenceSummary.final.score);
  const userTone = canonicalMemory.rawMemory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  // Determine confidence preamble
  let confidencePreamble = "";
  if (behavior === "hedge_recommendation") {
    confidencePreamble = getHedgingPhrase();
  } else if (behavior === "decisive_recommendation") {
    confidencePreamble = getDecisivePhrase();
  }

  // Optional wardrobe styling hint
  const wardrobeHint = explicitWardrobeRequest && wardrobeContext && wardrobeContext.wardrobe_items.length > 0
    ? `\n\nWARDROBE CONTEXT (for styling hints only - NO full outfits):
${wardrobeContext.wardrobe_items.slice(0, 10).map(i => `- ${i.name || i.color + " " + i.category}`).join("\n")}`
    : "";

  const prompt = `You are MyMirro, a decisive fashion advisor for Gen-Z professionals in India.

USER MESSAGE:
"${userMessage}"

USER'S STYLE PROFILE:
${memoryFormatted}

${wardrobeHint}

TASK: SHOPPING COMPARISON
The user is asking for a shopping decision. You MUST:
1. Give a CLEAR VERDICT - recommend ONE option (not both, not "depends")
2. Provide 3 specific reasons tied to their style/preferences
3. Say when the OTHER option makes more sense (short clause)
4. If wardrobe relevant, give a SHORT text hint about styling (NO outfit arrays)

BE DECISIVE. DO NOT BE NEUTRAL.
- If confidence is ${behavior === "hedge_recommendation" ? "moderate" : "high"}, ${behavior === "hedge_recommendation" ? "acknowledge uncertainty but still commit" : "be very specific and confident"}
- ${confidencePreamble ? `Start with: "${confidencePreamble}"` : "Be direct and confident"}

RESPONSE FORMAT:
{
  "verdict": "Buy [specific item]",
  "reasons": [
    "reason 1 tied to their style/climate/occasion",
    "reason 2 tied to their wardrobe gaps or preferences",
    "reason 3 about versatility or value"
  ],
  "alternative_when": "Get [the other option] when [specific scenario]",
  "wardrobe_styling_hint": "Short 1-sentence text about how to style with what they have (optional, only if wardrobe provided)"
}

USER'S TONE: ${userTone}
TONE: ${toneInstruction}. Be conversational and genuine.

Now generate the DECISIVE shopping comparison response. Return JSON only.`;

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
 * Asks clarifying question if confidence is low
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
  }
): Promise<FinalStylistOutput> {
  const behavior = getConfidenceBehavior(confidenceSummary.final.score);
  
  // If confidence is low and we need clarification, ask first
  if (behavior === "ask_clarification" && canonicalMemory.needs_clarification) {
    const clarifyingQ = getClarifyingQuestion(canonicalMemory);
    if (clarifyingQ) {
      return {
        message: clarifyingQ,
        outfits: undefined,
        suggestion_pills: generateSuggestionPills(intent, false, false, false, false),
      };
    }
  }

  // Handle shopping comparison mode separately
  if (responseMode === "shopping_comparison") {
    return composeShoppingComparisonV2(
      userMessage,
      canonicalMemory,
      confidenceSummary,
      wardrobeContext,
      false // Not explicit wardrobe request
    );
  }

  // Build quick rules from analyses
  const quickRulesStr = buildQuickRulesFromAnalyses(
    rules,
    analyses.color,
    analyses.silhouette,
    analyses.bodyType,
    analyses.fashionIntelligence
  );

  const memoryFormatted = formatCanonicalMemoryForPrompt(canonicalMemory);
  const userTone = canonicalMemory.rawMemory?.userTone || "casual_friendly";
  const toneInstruction = getToneInstruction(userTone);

  // Confidence-aware preamble
  let confidenceInstruction = "";
  if (behavior === "hedge_recommendation") {
    confidenceInstruction = `\nCONFIDENCE: Medium. Use hedging language like "${getHedgingPhrase()}" but still provide specific recommendations.`;
  } else if (behavior === "decisive_recommendation") {
    confidenceInstruction = `\nCONFIDENCE: High. Be very specific and decisive. Use language like "${getDecisivePhrase()}"`;
  }

  // Response mode instruction
  let responseModeInstruction = "";
  if (responseMode === "advisory_text") {
    responseModeInstruction = "\nRESPONSE MODE: Text advice only. Do NOT include outfits array.";
  } else if (responseMode === "visual_outfit") {
    responseModeInstruction = "\nRESPONSE MODE: Include outfit suggestions from module output.";
  }

  const moduleOutputStr = JSON.stringify(moduleOutput, null, 2);

  const prompt = `You are MyMirro, a world-class AI personal stylist for Gen-Z and young professionals in India.

USER MESSAGE:
"${userMessage}"

INTENT: ${intent}
MODULE USED: ${moduleName}

MODULE OUTPUT:
${moduleOutputStr}

USER'S STYLE PROFILE:
${memoryFormatted}

STYLING GUIDANCE:
${quickRulesStr}
${confidenceInstruction}
${responseModeInstruction}

WARDROBE SIZE: ${wardrobeContext.wardrobe_items.length} items

USER'S TONE: ${userTone}
TONE: ${toneInstruction}

TASK:
Create the final response. Be their stylish bestie.

DECISIVENESS RULES:
- If comparing options: PICK ONE. Don't say "both are good"
- If recommending: Be specific, not vague
- If uncertain: Acknowledge but still commit to a recommendation
- Add personality - be memorable, not generic

Requirements:
1. Write in Gen-Z friendly tone as specified
2. Keep message SHORT - 2-3 sentences max
3. ${responseMode === "visual_outfit" ? "Include outfits from module output" : "NO outfits array"}
4. Add 2 practical, brief extra tips
5. Sound like their fashion bestie, not a bot

DO NOT:
- Be neutral or wishy-washy
- Say "it depends" without committing
- Sound robotic or generic
- Use corporate language

Return JSON:
{
  "message": "Short Gen-Z friendly message (2-3 sentences)...",
  ${responseMode === "visual_outfit" ? '"outfits": [{"title": "...", "items": [...], "why_it_works": "..."}],' : ""}
  "extra_tips": ["brief tip 1", "brief tip 2"]
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
