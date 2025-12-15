/**
 * Smart Clarification Detector
 * 
 * Determines if we need to ask the user for more context.
 * 
 * V4 RULES (reduced aggressiveness):
 * 1. Only ask ONE clarifying question per session
 * 2. If user has provided context in message or history, don't ask
 * 3. If we've already asked, proceed with comprehensive response
 * 4. Provide suggestion pills to make answering easy
 * 5. ONLY ask when TRULY required (occasion OR climate missing for heavy intents)
 * 6. NEVER ask taste/preference questions (fit, color, aesthetic)
 * 7. Low confidence alone is NOT a trigger for clarification
 */

import type { 
  IntentType, 
  ConversationMemory, 
  FashionIntelligence,
  WardrobeContext,
} from "../types";

/**
 * Context signals we look for in the message
 */
interface ContextSignals {
  hasOccasion: boolean;
  hasVibe: boolean;
  hasFormality: boolean;
  hasTimeContext: boolean;
  hasWeatherContext: boolean;
  hasSpecificRequest: boolean;
}

/**
 * Clarification result
 */
export interface ClarificationResult {
  needsClarification: boolean;
  clarificationQuestion?: string;
  suggestionPills?: string[];
  detectedContext: Partial<{
    occasion: string;
    vibe: string;
    formality: string;
    timeContext: string;
    weatherContext: string;
  }>;
}

/**
 * Occasion keywords
 */
const OCCASION_KEYWORDS = [
  "work", "office", "meeting", "interview", "presentation",
  "date", "date night", "dinner", "lunch", "brunch",
  "party", "club", "nightout", "night out", "celebration",
  "wedding", "engagement", "reception", "ceremony",
  "casual", "hanging out", "friends", "chill",
  "gym", "workout", "exercise", "yoga",
  "travel", "trip", "vacation", "holiday",
  "college", "class", "lecture", "campus",
  "festival", "diwali", "holi", "eid", "christmas",
  "formal", "event", "function", "ceremony",
];

/**
 * Vibe keywords
 */
const VIBE_KEYWORDS = [
  "casual", "chill", "relaxed", "comfy", "comfortable",
  "formal", "professional", "business", "polished",
  "trendy", "stylish", "fashionable", "cool",
  "minimalist", "simple", "clean", "basic",
  "bold", "statement", "stand out", "attention",
  "cozy", "warm", "layered",
  "edgy", "street", "streetwear", "urban",
  "classy", "elegant", "sophisticated",
  "sporty", "athletic", "active",
  "bohemian", "boho", "flowy",
  "cute", "pretty", "feminine",
  "masculine", "rugged", "tough",
];

/**
 * Formality keywords
 */
const FORMALITY_KEYWORDS = [
  "formal", "semi-formal", "business", "professional",
  "casual", "smart casual", "business casual",
  "informal", "relaxed", "everyday",
  "dressy", "fancy", "elegant",
];

/**
 * Time context keywords
 */
const TIME_KEYWORDS = [
  "today", "tonight", "tomorrow", "this weekend", "weekend",
  "morning", "afternoon", "evening", "night",
  "now", "later", "soon",
];

/**
 * Weather context keywords
 */
const WEATHER_KEYWORDS = [
  "hot", "cold", "warm", "cool", "rainy", "sunny",
  "humid", "dry", "windy", "winter", "summer", "monsoon",
  "spring", "autumn", "fall",
];

/**
 * Detect context signals in user message
 */
function detectContextSignals(message: string): ContextSignals {
  const lowerMessage = message.toLowerCase();

  return {
    hasOccasion: OCCASION_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasVibe: VIBE_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasFormality: FORMALITY_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasTimeContext: TIME_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasWeatherContext: WEATHER_KEYWORDS.some(kw => lowerMessage.includes(kw)),
    hasSpecificRequest: lowerMessage.includes("for") || lowerMessage.includes("to go"),
  };
}

/**
 * Extract detected context from message
 */
function extractContext(message: string): Partial<{
  occasion: string;
  vibe: string;
  formality: string;
  timeContext: string;
  weatherContext: string;
}> {
  const lowerMessage = message.toLowerCase();
  const context: ReturnType<typeof extractContext> = {};

  // Find occasion
  for (const kw of OCCASION_KEYWORDS) {
    if (lowerMessage.includes(kw)) {
      context.occasion = kw;
      break;
    }
  }

  // Find vibe
  for (const kw of VIBE_KEYWORDS) {
    if (lowerMessage.includes(kw)) {
      context.vibe = kw;
      break;
    }
  }

  // Find formality
  for (const kw of FORMALITY_KEYWORDS) {
    if (lowerMessage.includes(kw)) {
      context.formality = kw;
      break;
    }
  }

  // Find time
  for (const kw of TIME_KEYWORDS) {
    if (lowerMessage.includes(kw)) {
      context.timeContext = kw;
      break;
    }
  }

  // Find weather
  for (const kw of WEATHER_KEYWORDS) {
    if (lowerMessage.includes(kw)) {
      context.weatherContext = kw;
      break;
    }
  }

  return context;
}

/**
 * Check conversation history for context
 */
function hasContextInHistory(memory: ConversationMemory): boolean {
  // Check if user has mentioned occasion/vibe in recent messages
  const allMessages = memory.recentUserMessages.join(" ").toLowerCase();
  
  const hasOccasion = OCCASION_KEYWORDS.some(kw => allMessages.includes(kw));
  const hasVibe = VIBE_KEYWORDS.some(kw => allMessages.includes(kw));
  
  return hasOccasion || hasVibe;
}

/**
 * Check if Fashion Intelligence Engine has enough context
 */
function hasFIEContext(fie?: FashionIntelligence): boolean {
  if (!fie) return false;
  
  // If FIE has specific occasion and vibe (not defaults), we have context
  const hasSpecificOccasion = fie.occasion && 
    !["everyday", "general", "casual"].includes(fie.occasion.toLowerCase());
  const hasSpecificVibe = fie.vibe && 
    !["versatile", "neutral", "general"].includes(fie.vibe.toLowerCase());
  
  return !!(hasSpecificOccasion || hasSpecificVibe);
}

/**
 * Generate clarification question with pills
 * 
 * V4: ONLY ask essential context questions:
 * - Occasion (for outfit/event styling)
 * - Climate (for travel packing)
 * 
 * NEVER ask about:
 * - Fit preference ("fitted or relaxed?")
 * - Color preference ("what colors do you like?")
 * - Aesthetic preference ("minimalist or bold?")
 * - Style uncertainty
 */
function generateClarificationQuestion(
  intent: IntentType,
  signals: ContextSignals
): { question: string; pills: string[] } {
  // V4: ONLY ask if BOTH occasion AND vibe are completely missing
  // If user has ANY context, proceed without asking
  if (intent === "outfit_generation" || intent === "event_styling") {
    // V4: Only ask if user message is very generic like "what should I wear"
    // AND has no context signals at all
    if (!signals.hasOccasion && !signals.hasVibe && !signals.hasTimeContext && !signals.hasFormality) {
      return {
        question: "What's the occasion? 📍",
        pills: ["Casual hangout", "Work/Office", "Date night", "Party", "Just everyday"],
      };
    }
    // V4: Don't ask separate vibe question - that's a taste question
    // If they've given occasion, we can infer vibe
  }

  if (intent === "travel_packing") {
    // Only ask about climate if truly missing
    if (!signals.hasWeatherContext && !signals.hasTimeContext) {
      return {
        question: "What's the weather like where you're going? 🌍",
        pills: ["Hot/Beach", "Cold/Winter", "Mild/Spring", "Mix of weather"],
      };
    }
  }

  // Default - no clarification needed
  // V4: When in doubt, don't ask - just proceed with best guess
  return { question: "", pills: [] };
}

/**
 * Main function: Determine if clarification is needed
 */
export function needsClarification(
  intent: IntentType,
  message: string,
  memory: ConversationMemory,
  fashionIntelligence?: FashionIntelligence,
  hasAlreadyAsked?: boolean
): ClarificationResult {
  // Intents that might need clarification
  const clarifiableIntents: IntentType[] = [
    "outfit_generation",
    "event_styling",
    "travel_packing",
  ];

  // If intent doesn't need clarification, skip
  if (!clarifiableIntents.includes(intent)) {
    return {
      needsClarification: false,
      detectedContext: extractContext(message),
    };
  }

  // Rule 1: If we've already asked, don't ask again
  if (hasAlreadyAsked) {
    console.log("📝 Already asked clarification - proceeding with response");
    return {
      needsClarification: false,
      detectedContext: extractContext(message),
    };
  }

  // Detect signals in current message
  const signals = detectContextSignals(message);
  const detectedContext = extractContext(message);

  // Rule 2: If message has sufficient context, don't ask
  if (signals.hasOccasion || signals.hasVibe || signals.hasSpecificRequest) {
    console.log("📝 Message has context - no clarification needed");
    return {
      needsClarification: false,
      detectedContext,
    };
  }

  // Rule 3: Check conversation history
  if (hasContextInHistory(memory)) {
    console.log("📝 History has context - no clarification needed");
    return {
      needsClarification: false,
      detectedContext,
    };
  }

  // Rule 4: Check if FIE already has context
  if (hasFIEContext(fashionIntelligence)) {
    console.log("📝 FIE has context - no clarification needed");
    return {
      needsClarification: false,
      detectedContext,
    };
  }

  // Need clarification - generate question
  const { question, pills } = generateClarificationQuestion(intent, signals);

  if (!question) {
    return {
      needsClarification: false,
      detectedContext,
    };
  }

  console.log("❓ Asking clarification question");
  return {
    needsClarification: true,
    clarificationQuestion: question,
    suggestionPills: pills,
    detectedContext,
  };
}

/**
 * Check if user's response is answering our clarification question
 */
export function isAnsweringClarification(
  message: string,
  lastQuestion?: string
): boolean {
  if (!lastQuestion) return false;

  const lowerMessage = message.toLowerCase();
  
  // Short responses are likely answers
  if (message.length < 50) {
    // Check if it contains any context keywords
    const hasContext = [
      ...OCCASION_KEYWORDS,
      ...VIBE_KEYWORDS,
      ...FORMALITY_KEYWORDS,
    ].some(kw => lowerMessage.includes(kw));
    
    if (hasContext) return true;
  }

  // Check if user clicked a suggestion pill (these are usually short)
  const commonPillResponses = [
    "casual", "work", "office", "date", "party", "everyday",
    "comfy", "trendy", "minimal", "bold", "polished",
    "beach", "cold", "city", "mix",
  ];
  
  return commonPillResponses.some(r => lowerMessage.includes(r));
}

/**
 * Build comprehensive prompt instruction when we don't have context
 * (When user doesn't answer clarification, we provide multiple options)
 */
export function getComprehensivePromptInstruction(): string {
  return `Since the user hasn't specified a particular occasion or vibe, provide a VERSATILE response that covers multiple scenarios:
1. Suggest one casual/everyday option
2. Suggest one polished/work-appropriate option
3. Briefly mention how to dress it up or down

Keep the response helpful without being overwhelming. The user can ask for more specific options if needed.`;
}

