/**
 * Utils Module Exports
 */

export { extractJson, safeJsonParse, extractAndValidateJson, parseJsonArray, enforceStrictJson } from "./extractJson";
export { callGemini, callGeminiJson, callGeminiBatch, GEMINI_LITE, GEMINI_FLASH, MODEL_FOR_STAGE } from "./geminiClient";

// Session caching for latency optimization
export {
  generateSessionKey,
  generateConversationId,
  getSessionCache,
  setSessionCache,
  updateSessionCache,
  clearSessionCache,
  hasCompleteAnalysisCache,
  hasFIECache,
  getCacheStats,
} from "./sessionCache";
export type { SessionCache } from "./sessionCache";

// Execution map for intent-based optimization
export {
  EXECUTION_MAP,
  getExecutionConfig,
  needsFullAnalysis,
  canSkipWithCache,
  isHeavyIntent,
  isContinuation,
  getEstimatedLLMCalls,
  logExecutionPlan,
} from "./executionMap";
export type { ExecutionConfig } from "./executionMap";
export { classifyIntent, validateIntent, getIntentFromKeywords, getIntentDescription } from "./intentClassifier";
export { fetchWardrobe, fetchUserProfile, fetchWardrobeAndProfile, isWardrobeEmpty, getWardrobeStats } from "./supabaseClient";
export { buildConversationMemory, formatMemoryForContext, isContinuationQuery, extractOutfitsFromMessage } from "./memory";
export {
  formatWardrobeForLLM,
  formatWardrobeSummary,
  formatWardrobeForAnalysis,
  getAvailableColors,
  getAvailableCategories,
  findMatchingItems,
  getItemIdentifiers,
} from "./wardrobeFormatter";
export { filterOutfitsForSafety, filterItemsForSafety, validateOutfitGrounding, applySafetyFilter } from "./safetyFilter";
export { rewriteWithGenZTone, getGreeting, getSignOff, addContextualEmojis, simplifyFashionTerms } from "./toneRewriter";
export {
  composeFinalResponse,
  composeGeneralChatResponse,
  composeColorAnalysisResponse,
  composeBodyTypeResponse,
  mergeOutfits,
  formatFinalOutput,
  generateSuggestionPills,
} from "./finalComposer";
export {
  createLogEntry,
  startStage,
  recordStage,
  recordError,
  setIntent,
  setResponseSize,
  finalizeLog,
  sendToAnalytics,
  createStageTimer,
  formatTiming,
  createMetricsSummary,
} from "./logger";
export {
  resolveOutfitImages,
  resolveAllOutfitImages,
  hasEnoughImages,
  filterOutfitsWithImages,
  createFallbackVisualOutfit,
} from "./outfitImageResolver";
