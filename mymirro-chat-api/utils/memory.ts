/**
 * Conversation Memory Layer
 * Manages conversation history, user preferences, and context
 */

import type {
  ConversationMessage,
  ConversationMemory,
  Outfit,
  IntentType,
} from "../types";

const MAX_USER_MESSAGES = 5;
const MAX_ASSISTANT_MESSAGES = 5;
const MAX_OUTFIT_HISTORY = 2;

/**
 * Build conversation memory from history
 */
export function buildConversationMemory(
  history: ConversationMessage[] = [],
  lastOutfits: Outfit[] = [],
  lastIntent?: IntentType,
  lastModuleOutput?: unknown
): ConversationMemory {
  const userMessages = history
    .filter((msg) => msg.role === "user")
    .slice(-MAX_USER_MESSAGES)
    .map((msg) => msg.content);

  const assistantMessages = history
    .filter((msg) => msg.role === "assistant")
    .slice(-MAX_ASSISTANT_MESSAGES)
    .map((msg) => msg.content);

  const userTone = extractUserTone(userMessages);
  const userPreferences = extractUserPreferences(userMessages);
  const frequentAesthetics = extractFrequentAesthetics([
    ...userMessages,
    ...assistantMessages,
  ]);

  return {
    recentUserMessages: userMessages,
    recentAssistantMessages: assistantMessages,
    lastOutfitSuggestions: lastOutfits.slice(-MAX_OUTFIT_HISTORY),
    userTone,
    userPreferences,
    frequentAesthetics,
    lastIntent,
    lastModuleOutput,
  };
}

/**
 * Extract user's communication tone from messages
 */
function extractUserTone(messages: string[]): string {
  const allText = messages.join(" ").toLowerCase();

  // Check for casual indicators
  const casualIndicators = [
    "hey",
    "yo",
    "lol",
    "haha",
    "omg",
    "bruh",
    "ngl",
    "tbh",
    "fr",
    "lowkey",
    "highkey",
    "vibe",
    "slay",
    "lit",
    "fire",
    "sick",
    "dope",
  ];
  const casualCount = casualIndicators.filter((word) =>
    allText.includes(word)
  ).length;

  // Check for formal indicators
  const formalIndicators = [
    "please",
    "thank you",
    "could you",
    "would you",
    "kindly",
    "appreciate",
    "professional",
    "formal",
  ];
  const formalCount = formalIndicators.filter((word) =>
    allText.includes(word)
  ).length;

  // Check for enthusiastic indicators
  const enthusiasticIndicators = ["!", "love", "amazing", "perfect", "great", "excited"];
  const enthusiasticCount = enthusiasticIndicators.filter((word) =>
    allText.includes(word)
  ).length;

  if (casualCount >= 3) return "very_casual_genz";
  if (casualCount >= 1) return "casual_friendly";
  if (formalCount >= 2) return "polite_professional";
  if (enthusiasticCount >= 2) return "enthusiastic";
  
  return "neutral_friendly";
}

/**
 * Extract user preferences from message content
 */
function extractUserPreferences(messages: string[]): string[] {
  const preferences: string[] = [];
  const allText = messages.join(" ").toLowerCase();

  // Color preferences
  const colorKeywords = [
    "black",
    "white",
    "blue",
    "red",
    "green",
    "pink",
    "beige",
    "neutral",
    "bright",
    "dark",
    "pastel",
    "earthy",
    "muted",
  ];
  colorKeywords.forEach((color) => {
    if (allText.includes(color)) {
      preferences.push(`likes ${color}`);
    }
  });

  // Style preferences
  const styleKeywords = [
    "casual",
    "formal",
    "elegant",
    "sporty",
    "bohemian",
    "minimalist",
    "streetwear",
    "vintage",
    "modern",
    "classic",
    "edgy",
    "feminine",
    "androgynous",
  ];
  styleKeywords.forEach((style) => {
    if (allText.includes(style)) {
      preferences.push(`prefers ${style}`);
    }
  });

  // Fit preferences
  const fitKeywords = [
    "oversized",
    "fitted",
    "loose",
    "tight",
    "relaxed",
    "slim",
    "baggy",
  ];
  fitKeywords.forEach((fit) => {
    if (allText.includes(fit)) {
      preferences.push(`likes ${fit} fit`);
    }
  });

  // Comfort preferences
  if (allText.includes("comfortable") || allText.includes("comfy")) {
    preferences.push("prioritizes comfort");
  }

  return [...new Set(preferences)]; // Remove duplicates
}

/**
 * Extract frequently mentioned aesthetics/vibes
 */
function extractFrequentAesthetics(messages: string[]): string[] {
  const aesthetics: Record<string, number> = {};
  const allText = messages.join(" ").toLowerCase();

  const aestheticKeywords = [
    "minimalist",
    "bohemian",
    "streetwear",
    "cottagecore",
    "dark academia",
    "light academia",
    "coastal",
    "y2k",
    "90s",
    "vintage",
    "preppy",
    "grunge",
    "athleisure",
    "old money",
    "clean girl",
    "mob wife",
    "coquette",
    "corporate",
    "quiet luxury",
    "indie",
    "artsy",
    "edgy",
    "soft girl",
    "baddie",
    "korean",
    "parisian",
    "scandinavian",
  ];

  aestheticKeywords.forEach((aesthetic) => {
    const count = (allText.match(new RegExp(aesthetic, "g")) || []).length;
    if (count > 0) {
      aesthetics[aesthetic] = count;
    }
  });

  // Sort by frequency and return top 3
  return Object.entries(aesthetics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([aesthetic]) => aesthetic);
}

/**
 * Format memory for LLM context
 */
export function formatMemoryForContext(memory: ConversationMemory): string {
  const parts: string[] = [];

  if (memory.recentUserMessages.length > 0) {
    parts.push(
      `Recent conversation topics: ${memory.recentUserMessages.slice(-3).join(" | ")}`
    );
  }

  if (memory.userTone) {
    parts.push(`User communication style: ${memory.userTone}`);
  }

  if (memory.userPreferences.length > 0) {
    parts.push(`User preferences: ${memory.userPreferences.join(", ")}`);
  }

  if (memory.frequentAesthetics.length > 0) {
    parts.push(
      `Frequently mentioned aesthetics: ${memory.frequentAesthetics.join(", ")}`
    );
  }

  if (memory.lastOutfitSuggestions.length > 0) {
    const outfitTitles = memory.lastOutfitSuggestions.map((o) => o.title);
    parts.push(`Previously suggested outfits: ${outfitTitles.join(", ")}`);
  }

  if (memory.lastIntent) {
    parts.push(`Last query type: ${memory.lastIntent}`);
  }

  return parts.join("\n");
}

/**
 * Check if this is a continuation query
 */
export function isContinuationQuery(
  message: string,
  memory: ConversationMemory
): boolean {
  const continuationPhrases = [
    "more",
    "another",
    "other options",
    "something else",
    "different",
    "alternatives",
    "what else",
    "show me more",
    "any other",
    "keep going",
    "next",
  ];

  const lowerMessage = message.toLowerCase();

  // Check for continuation phrases
  const hasContinuationPhrase = continuationPhrases.some((phrase) =>
    lowerMessage.includes(phrase)
  );

  // Must have previous context to be a continuation
  const hasPreviousContext =
    memory.lastOutfitSuggestions.length > 0 || memory.lastModuleOutput !== undefined;

  return hasContinuationPhrase && hasPreviousContext;
}

/**
 * Extract outfit suggestions from assistant message
 */
export function extractOutfitsFromMessage(assistantMessage: string): Outfit[] {
  // This is a simplified extraction - in production, you'd parse the structured response
  const outfits: Outfit[] = [];

  // Look for outfit patterns in the message
  const outfitMatches = assistantMessage.match(
    /(?:Outfit|Look|Option)\s*\d*[:\s]*([^\n]+)/gi
  );

  if (outfitMatches) {
    outfitMatches.forEach((match, index) => {
      outfits.push({
        title: `Look ${index + 1}`,
        items: [match.replace(/(?:Outfit|Look|Option)\s*\d*[:\s]*/i, "").trim()],
        why_it_works: "Previous suggestion",
      });
    });
  }

  return outfits;
}

