/**
 * Session-Only In-Memory Cache
 * Caches analysis results per session to reduce LLM calls
 * No Redis - pure in-memory, lives only during the session
 */

import type {
  FashionIntelligence,
  ColorAnalysis,
  SilhouetteAnalysis,
  BodyTypeAnalysis,
  RulesEngineOutput,
  GenderContext,
  CanonicalMemory,
} from "../types";

/**
 * Cached analysis data for a session
 * V2: Now includes canonicalMemory for preference resolution
 */
export interface SessionCache {
  fashionIntelligence?: FashionIntelligence;
  colorAnalysis?: ColorAnalysis;
  silhouetteAnalysis?: SilhouetteAnalysis;
  bodyTypeAnalysis?: BodyTypeAnalysis;
  rules?: RulesEngineOutput;
  genderContext?: GenderContext;
  lastOutfits?: Array<{ title: string; items: string[] }>;
  canonicalMemory?: CanonicalMemory; // V2: Canonical preferences
  timestamp: number;
}

/**
 * In-memory cache map
 * Key format: userId:conversationId
 */
const sessionCacheMap = new Map<string, SessionCache>();

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Max cache entries to prevent memory bloat
 */
const MAX_CACHE_ENTRIES = 1000;

/**
 * Generate cache key from userId and conversationId
 */
export function generateSessionKey(userId: string, conversationId?: string): string {
  return conversationId ? `${userId}:${conversationId}` : `${userId}:default`;
}

/**
 * Generate a new conversation ID if not provided
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get cached session data
 */
export function getSessionCache(sessionKey: string): SessionCache | undefined {
  const cached = sessionCacheMap.get(sessionKey);
  
  if (!cached) {
    return undefined;
  }
  
  // Check if cache is expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    sessionCacheMap.delete(sessionKey);
    return undefined;
  }
  
  return cached;
}

/**
 * Set session cache data
 */
export function setSessionCache(sessionKey: string, data: Partial<SessionCache>): void {
  // Evict oldest entries if we're at capacity
  if (sessionCacheMap.size >= MAX_CACHE_ENTRIES) {
    evictOldestEntries(100);
  }
  
  const existing = sessionCacheMap.get(sessionKey);
  
  sessionCacheMap.set(sessionKey, {
    ...existing,
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Update specific cache fields without overwriting others
 */
export function updateSessionCache(
  sessionKey: string,
  updates: Partial<Omit<SessionCache, "timestamp">>
): void {
  const existing = sessionCacheMap.get(sessionKey);
  
  if (existing) {
    sessionCacheMap.set(sessionKey, {
      ...existing,
      ...updates,
      timestamp: Date.now(),
    });
  } else {
    setSessionCache(sessionKey, updates);
  }
}

/**
 * Clear session cache
 */
export function clearSessionCache(sessionKey: string): void {
  sessionCacheMap.delete(sessionKey);
}

/**
 * Clear all expired caches
 */
export function clearExpiredCaches(): void {
  const now = Date.now();
  
  for (const [key, cache] of sessionCacheMap.entries()) {
    if (now - cache.timestamp > CACHE_TTL) {
      sessionCacheMap.delete(key);
    }
  }
}

/**
 * Evict oldest entries when at capacity
 */
function evictOldestEntries(count: number): void {
  const entries = Array.from(sessionCacheMap.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    sessionCacheMap.delete(entries[i][0]);
  }
}

/**
 * Check if we have complete analysis cached
 */
export function hasCompleteAnalysisCache(sessionKey: string): boolean {
  const cache = getSessionCache(sessionKey);
  
  if (!cache) return false;
  
  return !!(
    cache.fashionIntelligence &&
    cache.colorAnalysis &&
    cache.silhouetteAnalysis &&
    cache.bodyTypeAnalysis
  );
}

/**
 * Check if we have FIE cached (for lighter intents)
 */
export function hasFIECache(sessionKey: string): boolean {
  const cache = getSessionCache(sessionKey);
  return !!cache?.fashionIntelligence;
}

/**
 * Get cache statistics for logging
 */
export function getCacheStats(): {
  totalEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const entries = Array.from(sessionCacheMap.values());
  
  if (entries.length === 0) {
    return { totalEntries: 0, oldestEntry: null, newestEntry: null };
  }
  
  const timestamps = entries.map((e) => e.timestamp);
  
  return {
    totalEntries: entries.length,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
  };
}

// Clean up expired caches every 5 minutes
setInterval(clearExpiredCaches, 5 * 60 * 1000);

