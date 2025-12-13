/**
 * Comprehensive Logging Utility
 * Tracks per-module timings, success/failure, and fallback usage
 */

import type { LogEntry, StageTiming, StageTimings, IntentType } from "../types";

/**
 * Create a new log entry
 */
export function createLogEntry(
  userId: string,
  inputMessage: string,
  conversationId?: string
): LogEntry {
  return {
    userId,
    conversationId,
    timestamp: new Date().toISOString(),
    inputMessage,
    stages: {},
    errors: [],
    fallbacksUsed: [],
    success: true,
  };
}

/**
 * Start timing a stage
 */
export function startStage(stageName: string): number {
  return Date.now();
}

/**
 * Record stage completion
 */
export function recordStage(
  logEntry: LogEntry,
  stageName: keyof StageTimings,
  startTime: number,
  success: boolean,
  options?: {
    fallback?: boolean;
    moduleName?: string;
    cached?: boolean;
    fromCache?: Record<string, boolean>;
    skipped?: Record<string, boolean>;
  }
): void {
  const endTime = Date.now();
  const timing: StageTiming = {
    start: startTime,
    end: endTime,
    duration: endTime - startTime,
    success,
    ...options,
  };

  logEntry.stages[stageName] = timing;

  if (!success) {
    logEntry.success = false;
  }

  if (options?.fallback) {
    logEntry.fallbacksUsed.push(stageName);
  }
}

/**
 * Record an error
 */
export function recordError(logEntry: LogEntry, error: string): void {
  logEntry.errors.push(error);
  logEntry.success = false;
}

/**
 * Set intent in log entry
 */
export function setIntent(logEntry: LogEntry, intent: IntentType): void {
  logEntry.intent = intent;
}

/**
 * Set final response size
 */
export function setResponseSize(logEntry: LogEntry, response: unknown): void {
  try {
    logEntry.finalResponseSize = JSON.stringify(response).length;
  } catch {
    logEntry.finalResponseSize = 0;
  }
}

/**
 * Finalize and output the log entry
 */
export function finalizeLog(logEntry: LogEntry): void {
  // Calculate total timing
  const allTimings = Object.values(logEntry.stages).filter(
    (t): t is StageTiming => t !== undefined
  );

  if (allTimings.length > 0) {
    const minStart = Math.min(...allTimings.map((t) => t.start));
    const maxEnd = Math.max(...allTimings.map((t) => t.end));
    logEntry.stages.total = {
      start: minStart,
      end: maxEnd,
      duration: maxEnd - minStart,
      success: logEntry.success,
    };
  }

  // Output log
  outputLog(logEntry);
}

/**
 * Output log to console and optionally to external service
 */
function outputLog(logEntry: LogEntry): void {
  // Console output with color coding
  const status = logEntry.success ? "✅" : "❌";
  const totalDuration = logEntry.stages.total?.duration || 0;

  console.log(`\n${status} Chat Request Log:`);
  console.log(`   User: ${logEntry.userId}`);
  console.log(`   Intent: ${logEntry.intent || "unknown"}`);
  console.log(`   Total Duration: ${totalDuration}ms`);
  console.log(`   Response Size: ${logEntry.finalResponseSize || 0} bytes`);

  // Stage timings
  console.log("   Stage Timings:");
  for (const [stage, timing] of Object.entries(logEntry.stages)) {
    if (timing && stage !== "total") {
      const statusIcon = timing.success ? "✓" : "✗";
      const fallbackIndicator = timing.fallback ? " (fallback)" : "";
      console.log(
        `     ${statusIcon} ${stage}: ${timing.duration}ms${fallbackIndicator}`
      );
    }
  }

  // Errors
  if (logEntry.errors.length > 0) {
    console.log("   Errors:");
    logEntry.errors.forEach((err) => console.log(`     - ${err}`));
  }

  // Fallbacks
  if (logEntry.fallbacksUsed.length > 0) {
    console.log(`   Fallbacks Used: ${logEntry.fallbacksUsed.join(", ")}`);
  }

  // Full JSON log in development
  if (process.env.NODE_ENV === "development") {
    console.log("\n   Full Log Entry:");
    console.log(JSON.stringify(logEntry, null, 2));
  }
}

/**
 * Send log to external analytics service (if configured)
 */
export async function sendToAnalytics(logEntry: LogEntry): Promise<void> {
  const analyticsUrl = process.env.ANALYTICS_URL;

  if (!analyticsUrl) {
    return;
  }

  try {
    await fetch(analyticsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logEntry),
      signal: AbortSignal.timeout(2000),
    });
  } catch (error) {
    console.warn("Failed to send analytics:", error);
  }
}

/**
 * Create a stage timer helper
 */
export function createStageTimer() {
  const timers: Record<string, number> = {};

  return {
    start: (stage: string) => {
      timers[stage] = Date.now();
      return timers[stage];
    },
    end: (stage: string) => {
      const start = timers[stage];
      if (start) {
        return Date.now() - start;
      }
      return 0;
    },
    getStart: (stage: string) => timers[stage] || Date.now(),
  };
}

/**
 * Format timing for display
 */
export function formatTiming(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Create summary metrics from log entry
 */
export function createMetricsSummary(logEntry: LogEntry): {
  totalDuration: number;
  averageStageDuration: number;
  slowestStage: string;
  fastestStage: string;
  errorCount: number;
  fallbackCount: number;
} {
  const stages = Object.entries(logEntry.stages)
    .filter(([name, timing]) => name !== "total" && timing)
    .map(([name, timing]) => ({ name, duration: timing!.duration }));

  const totalDuration = logEntry.stages.total?.duration || 0;
  const averageStageDuration =
    stages.length > 0
      ? stages.reduce((sum, s) => sum + s.duration, 0) / stages.length
      : 0;

  const sortedStages = stages.sort((a, b) => b.duration - a.duration);
  const slowestStage = sortedStages[0]?.name || "none";
  const fastestStage = sortedStages[sortedStages.length - 1]?.name || "none";

  return {
    totalDuration,
    averageStageDuration: Math.round(averageStageDuration),
    slowestStage,
    fastestStage,
    errorCount: logEntry.errors.length,
    fallbackCount: logEntry.fallbacksUsed.length,
  };
}

