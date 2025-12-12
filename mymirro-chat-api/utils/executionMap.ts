/**
 * Intent-Based Execution Map
 * Determines which modules to run based on user intent
 * Saves unnecessary LLM calls for simple intents
 */

import type { IntentType } from "../types";

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

