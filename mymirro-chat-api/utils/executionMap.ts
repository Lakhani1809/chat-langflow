/**
 * Intent-Based Execution Map
 * V2: Includes response mode, output contract, and candidate generation
 */

import type { 
  IntentType, 
  ResponseMode, 
  OutputContract,
  ExecutionConfigV2,
  MultiIntentResult,
} from "../types";
import { 
  detectWardrobeRequest, 
  inferResponseMode, 
  getOutputContract,
} from "./wardrobeRequestDetector";

/**
 * Execution configuration for each intent
 */
export interface ExecutionConfig {
  /** Run Fashion Intelligence Engine */
  runFIE: boolean;
  /** Run Color/Silhouette/Body analysis (parallel) */
  runAnalysis: boolean;
  /** Run Rules Engine (merged into final composer now) */
  runRules: boolean;
  /** Can use cached analysis from previous messages */
  canUseCache: boolean;
  /** Requires wardrobe data */
  requiresWardrobe: boolean;
  /** Primary model to use for specialized module */
  moduleModel: "gemini-2.5-flash-lite" | "gemini-2.0-flash";
}

/**
 * Execution map - defines what to run for each intent
 */
export const EXECUTION_MAP: Record<IntentType, ExecutionConfig> = {
  // Heavy intents - need full pipeline
  outfit_generation: {
    runFIE: true,
    runAnalysis: true,
    runRules: true,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  event_styling: {
    runFIE: true,
    runAnalysis: true,
    runRules: true,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  travel_packing: {
    runFIE: true,
    runAnalysis: true,
    runRules: false, // Rules less critical for packing
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  // Medium intents - need FIE but not full analysis
  item_recommendation: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  category_recommendation: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  shopping_help: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  // Light intents - minimal processing
  trend_analysis: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: false,
    moduleModel: "gemini-2.0-flash",
  },
  
  color_analysis: {
    runFIE: true,
    runAnalysis: true, // Needs color analysis specifically
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
  },
  
  body_type_advice: {
    runFIE: false,
    runAnalysis: true, // Needs body type analysis
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
  },
  
  wardrobe_query: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
  },
  
  // Lightweight intents - reuse everything
  continuation_query: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: true, // CRITICAL: reuse all cached analysis
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
  },
  
  general_chat: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: false,
    moduleModel: "gemini-2.5-flash-lite",
  },
};

/**
 * Get execution config for an intent
 */
export function getExecutionConfig(intent: IntentType): ExecutionConfig {
  return EXECUTION_MAP[intent] || EXECUTION_MAP.general_chat;
}

/**
 * Check if intent needs full analysis pipeline
 */
export function needsFullAnalysis(intent: IntentType): boolean {
  const config = getExecutionConfig(intent);
  return config.runFIE && config.runAnalysis && config.runRules;
}

/**
 * Check if intent can skip analysis with cache
 */
export function canSkipWithCache(intent: IntentType): boolean {
  const config = getExecutionConfig(intent);
  return config.canUseCache && !config.runAnalysis;
}

/**
 * Check if intent is a "heavy" intent that benefits most from caching
 */
export function isHeavyIntent(intent: IntentType): boolean {
  return ["outfit_generation", "event_styling", "travel_packing"].includes(intent);
}

/**
 * Check if intent is a continuation/follow-up
 */
export function isContinuation(intent: IntentType): boolean {
  return intent === "continuation_query";
}

/**
 * Get estimated LLM calls for an intent (with/without cache)
 */
export function getEstimatedLLMCalls(
  intent: IntentType,
  hasCachedAnalysis: boolean
): { withCache: number; withoutCache: number } {
  const config = getExecutionConfig(intent);
  
  let withoutCache = 1; // At minimum: final composer
  let withCache = 1;
  
  // Intent classification (if not keyword-matched)
  withoutCache += 1;
  withCache += 1;
  
  // FIE
  if (config.runFIE) {
    withoutCache += 1;
    if (!hasCachedAnalysis) withCache += 1;
  }
  
  // Analysis (3 parallel calls = 1 "round")
  if (config.runAnalysis) {
    withoutCache += 1;
    if (!hasCachedAnalysis) withCache += 1;
  }
  
  // Specialized module
  withoutCache += 1;
  withCache += 1;
  
  return { withCache, withoutCache };
}

/**
 * Log execution plan for debugging
 */
export function logExecutionPlan(intent: IntentType, hasCachedAnalysis: boolean): void {
  const config = getExecutionConfig(intent);
  const calls = getEstimatedLLMCalls(intent, hasCachedAnalysis);
  
  console.log(`📋 Execution Plan for "${intent}":`);
  console.log(`   - FIE: ${config.runFIE ? (hasCachedAnalysis && config.canUseCache ? "CACHED" : "RUN") : "SKIP"}`);
  console.log(`   - Analysis: ${config.runAnalysis ? (hasCachedAnalysis && config.canUseCache ? "CACHED" : "RUN") : "SKIP"}`);
  console.log(`   - Rules: ${config.runRules ? "MERGED" : "SKIP"}`);
  console.log(`   - Model: ${config.moduleModel}`);
  console.log(`   - Est. LLM calls: ${hasCachedAnalysis && config.canUseCache ? calls.withCache : calls.withoutCache}`);
}

// ============================================
// V2: EXECUTION MAP WITH RESPONSE MODE
// ============================================

/**
 * V2 Execution Map - includes response mode and output contract
 */
export const EXECUTION_MAP_V2: Record<IntentType, Omit<ExecutionConfigV2, "responseMode" | "outputContract">> = {
  outfit_generation: {
    runFIE: true,
    runAnalysis: true,
    runRules: true,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: true,
    candidateCount: 8,
  },
  
  event_styling: {
    runFIE: true,
    runAnalysis: true,
    runRules: true,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: true,
    candidateCount: 8,
  },
  
  travel_packing: {
    runFIE: true,
    runAnalysis: true,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: true,
    candidateCount: 6,
  },
  
  item_recommendation: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: false,
  },
  
  category_recommendation: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: false,
  },
  
  shopping_help: {
    runFIE: true,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: false, // Shopping doesn't require wardrobe by default
    moduleModel: "gemini-2.0-flash",
    generateCandidates: false,
  },
  
  trend_analysis: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: false,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: false,
  },
  
  color_analysis: {
    runFIE: true,
    runAnalysis: true,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
    generateCandidates: false,
  },
  
  body_type_advice: {
    runFIE: false,
    runAnalysis: true,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
    generateCandidates: false,
  },
  
  wardrobe_query: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: true,
    moduleModel: "gemini-2.5-flash-lite",
    generateCandidates: false,
  },
  
  continuation_query: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: true,
    requiresWardrobe: true,
    moduleModel: "gemini-2.0-flash",
    generateCandidates: true,
    candidateCount: 6,
  },
  
  general_chat: {
    runFIE: false,
    runAnalysis: false,
    runRules: false,
    canUseCache: false,
    requiresWardrobe: false,
    moduleModel: "gemini-2.5-flash-lite",
    generateCandidates: false,
  },
};

/**
 * V2: Get full execution config with response mode
 */
export function getExecutionConfigV2(
  message: string,
  intentResult: MultiIntentResult
): ExecutionConfigV2 {
  const baseConfig = EXECUTION_MAP_V2[intentResult.primary_intent] || EXECUTION_MAP_V2.general_chat;
  
  // Determine response mode based on message and intent
  const isWardrobeRequest = detectWardrobeRequest(message);
  const responseMode = inferResponseMode(message, intentResult.primary_intent);
  const outputContract = getOutputContract(responseMode, isWardrobeRequest);
  
  // Adjust requiresWardrobe based on response mode
  // Explicit wardrobe request always requires wardrobe
  const requiresWardrobe = responseMode === "visual_outfit" || 
    isWardrobeRequest ||
    baseConfig.requiresWardrobe;
  
  return {
    ...baseConfig,
    responseMode,
    outputContract,
    requiresWardrobe,
    // Only generate candidates if outputContract allows outfits
    generateCandidates: baseConfig.generateCandidates && outputContract !== "no_outfits",
  };
}

/**
 * V2: Log execution plan with response mode
 */
export function logExecutionPlanV2(
  config: ExecutionConfigV2,
  intent: IntentType,
  hasCachedAnalysis: boolean
): void {
  console.log(`📋 V2 Execution Plan for "${intent}":`);
  console.log(`   - Response Mode: ${config.responseMode}`);
  console.log(`   - Output Contract: ${config.outputContract}`);
  console.log(`   - FIE: ${config.runFIE ? (hasCachedAnalysis && config.canUseCache ? "CACHED" : "RUN") : "SKIP"}`);
  console.log(`   - Analysis: ${config.runAnalysis ? (hasCachedAnalysis && config.canUseCache ? "CACHED" : "RUN") : "SKIP"}`);
  console.log(`   - Rules: ${config.runRules ? "RUN" : "SKIP"}`);
  console.log(`   - Generate Candidates: ${config.generateCandidates ? `YES (${config.candidateCount || 6})` : "NO"}`);
  console.log(`   - Model: ${config.moduleModel}`);
}

/**
 * V2: Check if outfits should be generated
 */
export function shouldGenerateOutfits(config: ExecutionConfigV2): boolean {
  return config.outputContract !== "no_outfits" && config.generateCandidates;
}

/**
 * V2: Check if outfits are required (must not be empty)
 */
export function areOutfitsRequired(config: ExecutionConfigV2): boolean {
  return config.outputContract === "outfits_required";
}

/**
 * V2: Get default response mode for intent (without message context)
 */
export function getDefaultResponseMode(intent: IntentType): ResponseMode {
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
    case "travel_packing":
    case "continuation_query":
      return "visual_outfit";
    
    case "shopping_help":
    case "item_recommendation":
      return "shopping_comparison";
    
    case "trend_analysis":
    case "color_analysis":
    case "body_type_advice":
    case "general_chat":
    case "wardrobe_query":
    case "category_recommendation":
    default:
      return "advisory_text";
  }
}

