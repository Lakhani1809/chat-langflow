/**
 * V2 Memory Arbiter
 * Resolves conflicts in user preferences to produce canonical memory
 */

import type {
  ConversationMemory,
  CanonicalMemory,
  ResolvedPreference,
  PreferenceContradiction,
  ConfidenceScore,
  ConversationMessage,
  FashionIntelligence,
} from "../types";

// ============================================
// DEFAULT CANONICAL MEMORY
// ============================================

export const DEFAULT_CANONICAL_MEMORY: CanonicalMemory = {
  fit_preference: { value: "regular", source: "default", confidence: 0.3 },
  vibes: [],
  color_likes: [],
  color_avoids: [],
  formality_preference: { value: "casual", source: "default", confidence: 0.3 },
  climate_context: undefined,
  comfort_vs_style: undefined,
  do_not_suggest: [],
  last_confirmed_preferences: new Date().toISOString(),
  contradictions: [],
  needs_clarification: false,
  memory_confidence: { score: 0.3, basis: ["default"] },
};

// ============================================
// PREFERENCE EXTRACTION PATTERNS
// ============================================

const FIT_PATTERNS = {
  slim: ["slim", "fitted", "tight", "tailored", "form-fitting"],
  regular: ["regular", "normal", "standard", "classic"],
  relaxed: ["relaxed", "loose", "comfortable", "casual"],
  oversized: ["oversized", "baggy", "roomy", "large"],
};

const FORMALITY_PATTERNS = {
  casual: ["casual", "relaxed", "everyday", "informal"],
  "smart-casual": ["smart-casual", "business casual", "polished casual"],
  smart: ["smart", "professional", "office", "work-appropriate"],
  formal: ["formal", "dressy", "elegant", "sophisticated"],
};

const COMFORT_VS_STYLE_PATTERNS = {
  comfort: ["comfortable", "cozy", "practical", "easy", "functional"],
  style: ["stylish", "fashionable", "trendy", "chic", "cool"],
  balanced: ["balance", "both", "mix of"],
};

const NEGATIVE_PATTERNS = [
  "hate", "don't like", "avoid", "never", "not a fan of",
  "dislike", "can't stand", "won't wear", "not into", "no more",
];

const EXPLICIT_PATTERNS = [
  "i want", "i like", "i prefer", "i love", "i always",
  "my style is", "i'm into", "i go for", "i usually wear",
];

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Build canonical memory from raw memory and conversation
 * 
 * Also exported as `arbitrateMemory` for V2 route compatibility
 */
export function buildCanonicalMemory(
  rawMemory: ConversationMemory,
  currentMessage: string,
  fashionIntelligence?: FashionIntelligence,
  previousCanonical?: CanonicalMemory
): CanonicalMemory {
  const allUserMessages = [
    ...rawMemory.recentUserMessages,
    currentMessage,
  ];
  
  const contradictions: PreferenceContradiction[] = [];
  
  // Extract fit preference
  const fitResult = extractFitPreference(allUserMessages);
  if (fitResult.contradiction) {
    contradictions.push(fitResult.contradiction);
  }
  
  // Extract vibes/aesthetics
  const vibes = extractVibes(allUserMessages, rawMemory.frequentAesthetics);
  
  // Extract color preferences
  const colorLikes = extractColorLikes(allUserMessages, rawMemory.userPreferences);
  const colorAvoids = extractColorAvoids(allUserMessages);
  
  // Extract formality preference
  const formalityResult = extractFormalityPreference(allUserMessages);
  if (formalityResult.contradiction) {
    contradictions.push(formalityResult.contradiction);
  }
  
  // Extract comfort vs style
  const comfortVsStyle = extractComfortVsStyle(allUserMessages);
  
  // Extract climate context
  const climateContext = extractClimateContext(allUserMessages);
  
  // Extract hard negatives (do not suggest)
  const doNotSuggest = extractNegatives(allUserMessages);
  
  // Resolve conflicts
  const { resolvedFit, needsClarificationFit } = resolveFitConflicts(fitResult, vibes, doNotSuggest);
  
  // Calculate confidence
  const memoryConfidence = calculateMemoryConfidence(
    allUserMessages,
    contradictions,
    rawMemory
  );
  
  return {
    fit_preference: resolvedFit,
    vibes,
    color_likes: colorLikes,
    color_avoids: colorAvoids,
    formality_preference: formalityResult.preference,
    climate_context: climateContext,
    comfort_vs_style: comfortVsStyle,
    do_not_suggest: doNotSuggest,
    last_confirmed_preferences: new Date().toISOString(),
    contradictions,
    needs_clarification: contradictions.length > 0 || needsClarificationFit,
    memory_confidence: memoryConfidence,
    rawMemory,
  };
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

function extractFitPreference(messages: string[]): {
  preference: ResolvedPreference;
  contradiction?: PreferenceContradiction;
} {
  let foundFits: { fit: string; source: "explicit" | "inferred"; index: number }[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i].toLowerCase();
    const isExplicit = EXPLICIT_PATTERNS.some(p => msg.includes(p));
    const isNegative = NEGATIVE_PATTERNS.some(p => msg.includes(p));
    
    for (const [fit, patterns] of Object.entries(FIT_PATTERNS)) {
      for (const pattern of patterns) {
        if (msg.includes(pattern)) {
          if (isNegative) {
            // Skip negative mentions for positive preference
            continue;
          }
          foundFits.push({
            fit,
            source: isExplicit ? "explicit" : "inferred",
            index: i,
          });
        }
      }
    }
  }
  
  if (foundFits.length === 0) {
    return {
      preference: {
        value: "regular",
        source: "default",
        confidence: 0.3,
      },
    };
  }
  
  // Check for contradiction
  const uniqueFits = [...new Set(foundFits.map(f => f.fit))];
  let contradiction: PreferenceContradiction | undefined;
  
  if (uniqueFits.length > 1 && 
      (uniqueFits.includes("slim") && uniqueFits.includes("oversized"))) {
    contradiction = {
      field: "fit_preference",
      value1: "slim",
      value2: "oversized",
      source1: "user_message",
      source2: "user_message",
    };
  }
  
  // Prioritize: explicit > inferred, recent > older
  const explicitFits = foundFits.filter(f => f.source === "explicit");
  const bestFit = explicitFits.length > 0
    ? explicitFits[explicitFits.length - 1] // Most recent explicit
    : foundFits[foundFits.length - 1]; // Most recent overall
  
  return {
    preference: {
      value: bestFit.fit,
      source: bestFit.source,
      confidence: bestFit.source === "explicit" ? 0.9 : 0.6,
    },
    contradiction,
  };
}

function extractVibes(messages: string[], existingAesthetics: string[]): string[] {
  const vibePatterns = [
    "streetwear", "minimal", "preppy", "bohemian", "ethnic",
    "sporty", "elegant", "edgy", "classic", "trendy", "casual",
    "chic", "vintage", "modern", "retro", "grunge", "artsy",
  ];
  
  const foundVibes = new Set<string>(existingAesthetics);
  
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    for (const vibe of vibePatterns) {
      if (lower.includes(vibe)) {
        foundVibes.add(vibe);
      }
    }
  }
  
  return Array.from(foundVibes).slice(0, 5); // Limit to 5 vibes
}

function extractColorLikes(messages: string[], existingPrefs: string[]): string[] {
  const colorPatterns = [
    "black", "white", "grey", "gray", "navy", "blue", "red", "green",
    "beige", "brown", "pink", "purple", "yellow", "orange", "olive",
    "burgundy", "maroon", "teal", "coral", "cream", "khaki",
  ];
  
  const likes = new Set<string>();
  
  // Extract from existing preferences
  for (const pref of existingPrefs) {
    const lower = pref.toLowerCase();
    for (const color of colorPatterns) {
      if (lower.includes(color) && !NEGATIVE_PATTERNS.some(n => lower.includes(n))) {
        likes.add(color);
      }
    }
  }
  
  // Extract from messages
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    if (NEGATIVE_PATTERNS.some(n => lower.includes(n))) continue;
    
    for (const color of colorPatterns) {
      if (lower.includes(color)) {
        likes.add(color);
      }
    }
  }
  
  return Array.from(likes);
}

function extractColorAvoids(messages: string[]): string[] {
  const colorPatterns = [
    "black", "white", "grey", "gray", "navy", "blue", "red", "green",
    "beige", "brown", "pink", "purple", "yellow", "orange", "olive",
    "burgundy", "maroon", "teal", "coral", "cream", "khaki", "neon",
  ];
  
  const avoids = new Set<string>();
  
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    
    if (NEGATIVE_PATTERNS.some(n => lower.includes(n))) {
      for (const color of colorPatterns) {
        if (lower.includes(color)) {
          avoids.add(color);
        }
      }
    }
  }
  
  return Array.from(avoids);
}

function extractFormalityPreference(messages: string[]): {
  preference: ResolvedPreference;
  contradiction?: PreferenceContradiction;
} {
  let foundFormalities: { formality: string; source: "explicit" | "inferred" }[] = [];
  
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    const isExplicit = EXPLICIT_PATTERNS.some(p => lower.includes(p));
    
    for (const [formality, patterns] of Object.entries(FORMALITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          foundFormalities.push({
            formality,
            source: isExplicit ? "explicit" : "inferred",
          });
        }
      }
    }
  }
  
  if (foundFormalities.length === 0) {
    return {
      preference: {
        value: "casual",
        source: "default",
        confidence: 0.3,
      },
    };
  }
  
  const lastFormality = foundFormalities[foundFormalities.length - 1];
  
  return {
    preference: {
      value: lastFormality.formality,
      source: lastFormality.source,
      confidence: lastFormality.source === "explicit" ? 0.85 : 0.5,
    },
  };
}

function extractComfortVsStyle(messages: string[]): ResolvedPreference | undefined {
  for (const msg of messages.reverse()) {
    const lower = msg.toLowerCase();
    
    for (const [preference, patterns] of Object.entries(COMFORT_VS_STYLE_PATTERNS)) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          return {
            value: preference,
            source: EXPLICIT_PATTERNS.some(p => lower.includes(p)) ? "explicit" : "inferred",
            confidence: 0.6,
          };
        }
      }
    }
  }
  
  return undefined;
}

function extractClimateContext(messages: string[]): ResolvedPreference | undefined {
  const climatePatterns = {
    hot: ["summer", "hot", "warm weather", "beach", "tropical"],
    cold: ["winter", "cold", "snow", "freezing", "chilly"],
    mild: ["spring", "fall", "autumn", "moderate", "pleasant"],
  };
  
  for (const msg of messages.reverse()) {
    const lower = msg.toLowerCase();
    
    for (const [climate, patterns] of Object.entries(climatePatterns)) {
      for (const pattern of patterns) {
        if (lower.includes(pattern)) {
          return {
            value: climate,
            source: "inferred",
            confidence: 0.7,
          };
        }
      }
    }
  }
  
  return undefined;
}

function extractNegatives(messages: string[]): string[] {
  const negatives = new Set<string>();
  
  for (const msg of messages) {
    const lower = msg.toLowerCase();
    
    for (const negPattern of NEGATIVE_PATTERNS) {
      if (lower.includes(negPattern)) {
        // Extract the thing they don't like
        const words = lower.split(/\s+/);
        const negIndex = words.findIndex(w => negPattern.split(" ").includes(w));
        
        if (negIndex !== -1 && negIndex < words.length - 1) {
          // Get next few words after negative
          const target = words.slice(negIndex + 1, negIndex + 4).join(" ");
          if (target.length > 2) {
            negatives.add(target.trim());
          }
        }
      }
    }
  }
  
  return Array.from(negatives);
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

function resolveFitConflicts(
  fitResult: { preference: ResolvedPreference; contradiction?: PreferenceContradiction },
  vibes: string[],
  negatives: string[]
): { resolvedFit: ResolvedPreference; needsClarificationFit: boolean } {
  let resolvedFit = fitResult.preference;
  let needsClarificationFit = false;
  
  // Check if negatives override the fit preference
  for (const neg of negatives) {
    if (neg.includes("oversized") && resolvedFit.value === "oversized") {
      // User said they hate oversized but we detected oversized preference
      resolvedFit = {
        value: "regular",
        source: "inferred",
        confidence: 0.4,
      };
      needsClarificationFit = true;
    }
  }
  
  // Vibe-based adjustments
  if (vibes.includes("streetwear") && resolvedFit.value === "slim") {
    // Potential conflict: streetwear usually implies relaxed
    if (resolvedFit.source !== "explicit") {
      needsClarificationFit = true;
    }
  }
  
  return { resolvedFit, needsClarificationFit };
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

function calculateMemoryConfidence(
  messages: string[],
  contradictions: PreferenceContradiction[],
  rawMemory: ConversationMemory
): ConfidenceScore {
  let score = 0.5; // Base score
  const basis: string[] = [];
  
  // More messages = more confidence
  if (messages.length >= 5) {
    score += 0.15;
    basis.push("sufficient_history");
  } else if (messages.length >= 2) {
    score += 0.1;
  }
  
  // Explicit preferences boost confidence
  const hasExplicit = messages.some(m => 
    EXPLICIT_PATTERNS.some(p => m.toLowerCase().includes(p))
  );
  if (hasExplicit) {
    score += 0.2;
    basis.push("explicit_preferences");
  }
  
  // Contradictions lower confidence
  if (contradictions.length > 0) {
    score -= 0.15 * contradictions.length;
    basis.push("has_contradictions");
  }
  
  // Existing aesthetics boost
  if (rawMemory.frequentAesthetics.length > 0) {
    score += 0.1;
    basis.push("established_aesthetics");
  }
  
  return {
    score: Math.max(0.1, Math.min(1, score)),
    basis,
    degrade_reason: contradictions.length > 0 ? "Conflicting preferences detected" : undefined,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format canonical memory for LLM prompts
 */
export function formatCanonicalMemoryForPrompt(memory: CanonicalMemory): string {
  const parts: string[] = [];
  
  parts.push(`Fit: ${memory.fit_preference.value} (${memory.fit_preference.source}, confidence: ${memory.fit_preference.confidence.toFixed(2)})`);
  
  if (memory.vibes.length > 0) {
    parts.push(`Vibes: ${memory.vibes.join(", ")}`);
  }
  
  if (memory.color_likes.length > 0) {
    parts.push(`Colors liked: ${memory.color_likes.join(", ")}`);
  }
  
  if (memory.color_avoids.length > 0) {
    parts.push(`Colors to avoid: ${memory.color_avoids.join(", ")}`);
  }
  
  parts.push(`Formality: ${memory.formality_preference.value}`);
  
  if (memory.climate_context) {
    parts.push(`Climate: ${memory.climate_context.value}`);
  }
  
  if (memory.do_not_suggest.length > 0) {
    parts.push(`DO NOT suggest: ${memory.do_not_suggest.join(", ")}`);
  }
  
  if (memory.needs_clarification) {
    parts.push(`⚠️ Some preferences need clarification`);
  }
  
  return parts.join("\n");
}

/**
 * Get clarifying question based on contradictions
 */
export function getClarifyingQuestion(memory: CanonicalMemory): string | null {
  if (memory.contradictions.length === 0) return null;
  
  const firstContradiction = memory.contradictions[0];
  
  if (firstContradiction.field === "fit_preference") {
    return `Quick question: do you prefer ${firstContradiction.value1} or ${firstContradiction.value2} fits? Just want to get this right for you! 👀`;
  }
  
  return "Just to make sure I understand your style - could you tell me more about your fit preferences?";
}

// ============================================
// ALIAS FOR V2 ROUTE COMPATIBILITY
// ============================================

/**
 * Alias for buildCanonicalMemory
 * Used in route.ts for V2 pipeline
 */
export const arbitrateMemory = buildCanonicalMemory;

