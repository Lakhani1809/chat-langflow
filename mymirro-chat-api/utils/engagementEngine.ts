/**
 * Engagement Engine
 * 
 * Keeps users engaged and promotes product features:
 * 1. Detects wardrobe gaps → suggests uploading items
 * 2. Promotes features → Style Check, wardrobe analysis, etc.
 * 3. Generates compelling next steps → never let conversation die
 * 4. Contextual engagement hooks → based on conversation flow
 */

import type { 
  IntentType, 
  WardrobeContext,
  WardrobeCoverageProfile,
  ConversationMemory,
} from "../types";

// ============================================
// TYPES
// ============================================

export interface EngagementResult {
  /** Wardrobe gap message (if items missing) */
  wardrobeGapMessage?: string;
  /** Specific items to suggest uploading */
  suggestedUploads?: string[];
  /** Feature to promote in this context */
  featurePromotion?: {
    feature: FeatureType;
    message: string;
    ctaText: string;
  };
  /** Engaging next step suggestion */
  nextStepSuggestion: string;
  /** Enhanced suggestion pills with engagement hooks */
  engagementPills: string[];
  /** Conversation continuation hook */
  continuationHook?: string;
}

export type FeatureType = 
  | "style_check" 
  | "wardrobe_upload" 
  | "trend_explorer" 
  | "color_analysis" 
  | "body_type_styling"
  | "shopping_assistant"
  | "travel_packing";

// ============================================
// WARDROBE GAP DETECTION
// ============================================

/**
 * Essential wardrobe categories
 */
const ESSENTIAL_CATEGORIES = {
  basics: ["white tee", "black tee", "neutral top", "basic shirt"],
  bottoms: ["jeans", "trousers", "shorts", "skirt"],
  footwear: ["sneakers", "formal shoes", "sandals", "boots"],
  outerwear: ["jacket", "blazer", "cardigan", "hoodie"],
  accessories: ["belt", "watch", "bag", "sunglasses"],
};

/**
 * Detect what's missing from wardrobe
 */
export function detectWardrobeGaps(
  wardrobeContext: WardrobeContext,
  coverage?: WardrobeCoverageProfile
): {
  missingCategories: string[];
  suggestedItems: string[];
  gapMessage: string | null;
} {
  const items = wardrobeContext.wardrobe_items;
  const itemNames = items.map(i => 
    `${i.name || ''} ${i.category || ''} ${i.color || ''}`.toLowerCase()
  ).join(' ');

  const missingCategories: string[] = [];
  const suggestedItems: string[] = [];

  // Check basics
  const hasBasicTop = itemNames.includes('tee') || itemNames.includes('t-shirt') || 
    itemNames.includes('basic') || itemNames.includes('shirt');
  if (!hasBasicTop) {
    missingCategories.push('basic tops');
    suggestedItems.push('a classic white or black tee');
  }

  // Check bottoms
  const hasBottoms = itemNames.includes('jeans') || itemNames.includes('pant') || 
    itemNames.includes('trouser') || itemNames.includes('bottom');
  if (!hasBottoms) {
    missingCategories.push('bottoms');
    suggestedItems.push('a pair of well-fitting jeans');
  }

  // Check footwear
  const hasFootwear = itemNames.includes('shoe') || itemNames.includes('sneaker') || 
    itemNames.includes('boot') || itemNames.includes('sandal') || itemNames.includes('footwear');
  if (!hasFootwear) {
    missingCategories.push('footwear');
    suggestedItems.push('your go-to sneakers or shoes');
  }

  // Check outerwear
  const hasOuterwear = itemNames.includes('jacket') || itemNames.includes('blazer') || 
    itemNames.includes('cardigan') || itemNames.includes('hoodie') || itemNames.includes('coat');
  if (!hasOuterwear) {
    missingCategories.push('layering pieces');
    suggestedItems.push('a versatile jacket or hoodie');
  }

  // Check total item count
  const totalItems = items.length;
  
  // Generate message
  let gapMessage: string | null = null;
  
  if (totalItems === 0) {
    gapMessage = "📸 I don't see any items in your wardrobe yet! Upload some pieces and I can create amazing outfits for you.";
  } else if (totalItems < 5) {
    gapMessage = `📸 You have ${totalItems} item${totalItems > 1 ? 's' : ''} - upload more to unlock better outfit combos!`;
  } else if (missingCategories.length >= 2) {
    gapMessage = `💡 Pro tip: Adding ${missingCategories.slice(0, 2).join(' and ')} would give you way more outfit options!`;
  } else if (suggestedItems.length > 0) {
    gapMessage = `✨ Quick win: Upload ${suggestedItems[0]} to complete more looks!`;
  }

  return {
    missingCategories,
    suggestedItems,
    gapMessage,
  };
}

// ============================================
// FEATURE PROMOTION
// ============================================

/**
 * Get contextual feature promotion
 */
export function getFeaturePromotion(
  intent: IntentType,
  conversationTurn: number,
  memory?: ConversationMemory
): { feature: FeatureType; message: string; ctaText: string } | null {
  // Don't promote too early - let user get value first
  if (conversationTurn < 2) {
    return null;
  }

  // Promote based on intent context
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
      // Promote Style Check after outfit suggestions
      return {
        feature: "style_check",
        message: "📱 Want a quick style check before you head out?",
        ctaText: "Try Style Check",
      };

    case "trend_analysis":
      // Promote shopping after trends
      return {
        feature: "shopping_assistant",
        message: "🛍️ Found something you like? I can help you shop the look!",
        ctaText: "Shop this trend",
      };

    case "color_analysis":
      // Promote full styling after color analysis
      return {
        feature: "body_type_styling",
        message: "Want to take it further? Let's talk about silhouettes that work for you too!",
        ctaText: "Explore body styling",
      };

    case "shopping_help":
      // Promote wardrobe gap analysis
      return {
        feature: "wardrobe_upload",
        message: "🧥 Upload what you buy to keep your wardrobe updated!",
        ctaText: "Update wardrobe",
      };

    case "travel_packing":
      // Promote outfit creation for trip
      return {
        feature: "style_check",
        message: "Try on your travel looks before packing - I'll give you feedback! 📸",
        ctaText: "Quick style check",
      };

    default:
      return null;
  }
}

// ============================================
// NEXT STEP SUGGESTIONS
// ============================================

/**
 * Generate compelling next step based on context
 */
export function generateNextStep(
  intent: IntentType,
  hasOutfits: boolean,
  wardrobeSize: number,
  conversationTurn: number
): string {
  // Early conversation - encourage exploration
  if (conversationTurn <= 1) {
    if (hasOutfits) {
      return "Want me to tweak these looks or explore a different vibe? 🎨";
    }
    return "Tell me more about your style and I'll get even better at this! ✨";
  }

  // Based on intent, suggest logical next step
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
      const outfitNextSteps = [
        "Want to see these with different shoes? Or add some accessories? 👟",
        "I can make these looks more casual or dress them up - what's your vibe?",
        "Curious what colors would pop even more on you? Let's explore! 🎨",
        "Ready to level up? Do a quick style check before you head out! 📱",
      ];
      return outfitNextSteps[conversationTurn % outfitNextSteps.length];

    case "trend_analysis":
      return "Want to see how you can rock these trends with what you already own? 👀";

    case "shopping_help":
      return "Once you get something new, upload it and I'll style it for you! 🛍️";

    case "color_analysis":
      return "Now let's put this into action - what outfit are you planning? 💫";

    case "body_type_advice":
      return "Ready to see some outfits that'll look 🔥 on you?";

    case "travel_packing":
      return "Pro tip: Try each outfit combo on before packing - I can give you a quick review! 📸";

    default:
      if (wardrobeSize < 10) {
        return "Upload more pieces and watch the magic happen - more options, more fire fits! 🔥";
      }
      return "What else can I help you with? I'm here for all your style questions! ✨";
  }
}

// ============================================
// ENGAGEMENT PILLS
// ============================================

/**
 * Generate engaging suggestion pills
 */
export function generateEngagementPills(
  intent: IntentType,
  hasOutfits: boolean,
  wardrobeSize: number,
  lastAction?: string
): string[] {
  const pills: string[] = [];

  // Always include a "more" option if we gave outfits
  if (hasOutfits) {
    pills.push("Show me more options");
  }

  // Intent-specific engagement pills
  switch (intent) {
    case "outfit_generation":
    case "event_styling":
      pills.push("Make it more casual");
      pills.push("Dress it up");
      pills.push("Different colors");
      pills.push("Add accessories");
      break;

    case "trend_analysis":
      pills.push("Style this trend for me");
      pills.push("Shop the look");
      pills.push("What's next trending?");
      break;

    case "shopping_help":
      pills.push("Show me budget options");
      pills.push("Premium picks");
      pills.push("Indian brands");
      pills.push("Online stores");
      break;

    case "travel_packing":
      pills.push("More outfit combos");
      pills.push("Versatile pieces");
      pills.push("What if it rains?");
      break;

    case "color_analysis":
      pills.push("Show me outfits");
      pills.push("Contrast colors");
      pills.push("Seasonal palettes");
      break;

    default:
      pills.push("Outfit for today");
      pills.push("What's trending?");
      pills.push("Style check");
      pills.push("Shopping help");
  }

  // Add feature discovery pill occasionally
  if (wardrobeSize < 10) {
    pills.push("📸 Upload items");
  }

  // Limit to 5-6 pills
  return pills.slice(0, 6);
}

// ============================================
// CONTINUATION HOOKS
// ============================================

/**
 * Generate conversation continuation hook
 * These are short, engaging lines to keep the convo going
 */
export function generateContinuationHook(
  intent: IntentType,
  responseHadOutfits: boolean,
  conversationTurn: number
): string {
  // Variety of continuation hooks
  const hooks = {
    outfit: [
      "btw, want to explore more vibes? I'm ready when you are 💅",
      "got more outfit inspo brewing if you want it 👀",
      "lmk if you want to switch it up!",
      "I can tweak these or go totally different - your call!",
    ],
    general: [
      "anything else on your mind, style-wise? 💭",
      "I'm here whenever you need a style check!",
      "your wardrobe + my brain = endless possibilities 🧠✨",
      "come back anytime - I don't ghost 😉",
    ],
    encouraging: [
      "you're gonna look 🔥",
      "confidence is the best accessory fr fr",
      "trust the fit, you got this!",
      "main character energy incoming ✨",
    ],
  };

  // Select based on context
  if (responseHadOutfits) {
    const outfitHooks = [...hooks.outfit, ...hooks.encouraging];
    return outfitHooks[conversationTurn % outfitHooks.length];
  }

  return hooks.general[conversationTurn % hooks.general.length];
}

// ============================================
// MAIN ENGINE
// ============================================

/**
 * Generate full engagement package for response
 */
export function generateEngagement(
  intent: IntentType,
  wardrobeContext: WardrobeContext,
  hasOutfits: boolean,
  conversationTurn: number,
  memory?: ConversationMemory,
  coverage?: WardrobeCoverageProfile
): EngagementResult {
  // Detect wardrobe gaps
  const gaps = detectWardrobeGaps(wardrobeContext, coverage);

  // Get feature promotion
  const featurePromo = getFeaturePromotion(intent, conversationTurn, memory);

  // Generate next step
  const nextStep = generateNextStep(
    intent,
    hasOutfits,
    wardrobeContext.wardrobe_items.length,
    conversationTurn
  );

  // Generate engagement pills
  const engagementPills = generateEngagementPills(
    intent,
    hasOutfits,
    wardrobeContext.wardrobe_items.length
  );

  // Generate continuation hook
  const continuationHook = generateContinuationHook(
    intent,
    hasOutfits,
    conversationTurn
  );

  return {
    wardrobeGapMessage: gaps.gapMessage || undefined,
    suggestedUploads: gaps.suggestedItems.length > 0 ? gaps.suggestedItems : undefined,
    featurePromotion: featurePromo || undefined,
    nextStepSuggestion: nextStep,
    engagementPills,
    continuationHook,
  };
}

/**
 * Format engagement for response message
 * Appends engagement content to the main message
 */
export function formatEngagementForMessage(
  engagement: EngagementResult,
  includeGapMessage: boolean = true,
  includeNextStep: boolean = true
): string {
  const parts: string[] = [];

  // Add wardrobe gap message (occasionally, not every time)
  if (includeGapMessage && engagement.wardrobeGapMessage) {
    parts.push(engagement.wardrobeGapMessage);
  }

  // Add next step suggestion
  if (includeNextStep && engagement.nextStepSuggestion) {
    parts.push(engagement.nextStepSuggestion);
  }

  // Add continuation hook
  if (engagement.continuationHook) {
    parts.push(engagement.continuationHook);
  }

  return parts.join('\n\n');
}

/**
 * Should we show wardrobe gap message this turn?
 * (Don't want to spam user)
 */
export function shouldShowGapMessage(
  conversationTurn: number,
  wardrobeSize: number
): boolean {
  // Always show if wardrobe is empty
  if (wardrobeSize === 0) return true;
  
  // Show on turns 1, 4, 7, etc. (every 3rd turn)
  if (wardrobeSize < 5 && conversationTurn % 3 === 1) return true;
  
  // For larger wardrobes, show less frequently
  if (wardrobeSize < 10 && conversationTurn % 5 === 1) return true;
  
  return false;
}

