/**
 * Gen-Z Persona Tone Rewriter
 * Adjusts the message tone to be Gen-Z friendly while maintaining content
 */

import { callGemini } from "./geminiClient";
import type { ConversationMemory } from "../types";

/**
 * Rewrite message with Gen-Z persona
 */
export async function rewriteWithGenZTone(
  originalMessage: string,
  memory?: ConversationMemory
): Promise<string> {
  const userTone = memory?.userTone || "casual_friendly";

  const prompt = `You are a tone adapter for MyMirro, a Gen-Z fashion AI assistant in India.

ORIGINAL MESSAGE:
"${originalMessage}"

USER'S COMMUNICATION STYLE: ${userTone}

TASK:
Rewrite this message to match Gen-Z Indian speaking style while preserving ALL the content, outfit recommendations, and tips.

Guidelines:
1. Keep it warm, friendly, and relatable
2. Use Gen-Z vocabulary naturally (but don't overdo it)
3. Add appropriate emojis sparingly (1-3 max)
4. Keep fashion advice intact - don't change outfit names or item descriptions
5. Match the user's energy level
6. Make it feel like advice from a stylish friend
7. Keep it concise and easy to read

Tone levels:
- very_casual_genz: Use more slang ("slay", "it's giving", "no cap", "fr fr")
- casual_friendly: Light, conversational, occasional fun words
- neutral_friendly: Warm but professional, minimal slang
- polite_professional: Friendly but polished
- enthusiastic: Extra excited energy with exclamation points

DO NOT:
- Change specific outfit recommendations
- Remove any tips or advice
- Make it sound fake or trying too hard
- Add information that wasn't there
- Use offensive or inappropriate language

Just return the rewritten message, nothing else.`;

  try {
    const rewritten = await callGemini(prompt, {
      temperature: 0.8,
      timeout: 8000,
      maxTokens: 1500,
    });

    return rewritten.trim();
  } catch (error) {
    console.warn("Tone rewriting failed, using original:", error);
    return originalMessage;
  }
}

/**
 * Get tone-appropriate greeting
 */
export function getGreeting(userTone: string): string {
  const greetings: Record<string, string[]> = {
    very_casual_genz: [
      "Heyy bestie! 💕",
      "Okayy let's get into it! ✨",
      "Yo! Ready to slay?",
      "Girllll (or boyy) let's gooo!",
    ],
    casual_friendly: [
      "Hey there! 👋",
      "Hiii! Let's style you up!",
      "Hey! Ready for some outfit inspo?",
      "Hi! Let's find your perfect look!",
    ],
    neutral_friendly: [
      "Hi there!",
      "Hello! Happy to help.",
      "Hey! Let's work on your style.",
      "Hi! I've got some ideas for you.",
    ],
    polite_professional: [
      "Hello!",
      "Hi, thanks for reaching out.",
      "Hello! I'd be happy to help.",
      "Hi there, let me assist you.",
    ],
    enthusiastic: [
      "OMG hi!! 🎉",
      "Yay! Let's do this! ✨",
      "So excited to help you! 💫",
      "Yes yes yes! Let's style! 🙌",
    ],
  };

  const options = greetings[userTone] || greetings.casual_friendly;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get tone-appropriate sign-off
 */
export function getSignOff(userTone: string): string {
  const signOffs: Record<string, string[]> = {
    very_casual_genz: [
      "Go slay! 💅",
      "You're gonna look fire! 🔥",
      "Serve! ✨",
      "Main character energy incoming! 💫",
    ],
    casual_friendly: [
      "Have fun styling! ✨",
      "You've got this! 💪",
      "Go rock that look!",
      "Can't wait to see how it turns out!",
    ],
    neutral_friendly: [
      "Hope this helps!",
      "Let me know if you need more ideas!",
      "Enjoy your new looks!",
      "Happy styling!",
    ],
    polite_professional: [
      "I hope these suggestions help.",
      "Please let me know if you need anything else.",
      "Best wishes with your styling.",
      "Looking forward to helping you again.",
    ],
    enthusiastic: [
      "So excited for you!! 🎉",
      "You're going to look AMAZING! ✨",
      "Ahhh can't wait! 💕",
      "This is going to be so good!! 🙌",
    ],
  };

  const options = signOffs[userTone] || signOffs.casual_friendly;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Add appropriate emojis based on content
 */
export function addContextualEmojis(text: string): string {
  const emojiMap: Record<string, string> = {
    outfit: "👗",
    top: "👚",
    bottom: "👖",
    shoes: "👟",
    dress: "👗",
    jeans: "👖",
    heels: "👠",
    sneakers: "👟",
    bag: "👜",
    jewelry: "💍",
    date: "💕",
    party: "🎉",
    office: "💼",
    casual: "✨",
    elegant: "✨",
    summer: "☀️",
    winter: "❄️",
    beach: "🏖️",
    travel: "✈️",
    wedding: "💒",
  };

  let result = text;
  let emojiCount = 0;
  const maxEmojis = 3;

  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    if (emojiCount >= maxEmojis) break;
    
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(result) && !result.includes(emoji)) {
      // Add emoji after first occurrence of the word
      result = result.replace(regex, `${keyword} ${emoji}`);
      emojiCount++;
      break; // Only add one emoji per keyword match
    }
  }

  return result;
}

/**
 * Simplify complex fashion terms for Gen-Z audience
 */
export function simplifyFashionTerms(text: string): string {
  const simplifications: Record<string, string> = {
    "silhouette": "shape",
    "proportions": "balance",
    "monochromatic": "one-color",
    "complementary colors": "colors that go together",
    "analogous": "similar",
    "décolletage": "neckline area",
    "sartorial": "style",
    "culottes": "wide cropped pants",
    "palazzo": "super wide leg",
  };

  let result = text;
  for (const [complex, simple] of Object.entries(simplifications)) {
    result = result.replace(new RegExp(complex, "gi"), simple);
  }

  return result;
}

