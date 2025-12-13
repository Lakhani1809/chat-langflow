/**
 * Complete Type Definitions for MyMirro AI Stylist Backend
 */

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export type ChatRequest = {
  userId: string;
  message: string;
  conversationId?: string;
  history?: ConversationMessage[];
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  intent: IntentType;
  message: string;
  outfits?: VisualOutfit[];
  items?: string[];
  brands?: string[];
  packing_list?: string[];
  trend_summary?: string;
  extra_tips?: string[];
  suggestion_pills?: string[];
  debug?: DebugInfo;
};

// ============================================
// INTENT TYPES
// ============================================

export type IntentType =
  | "outfit_generation"
  | "item_recommendation"
  | "category_recommendation"
  | "shopping_help"
  | "trend_analysis"
  | "travel_packing"
  | "color_analysis"
  | "body_type_advice"
  | "event_styling"
  | "wardrobe_query"
  | "continuation_query"
  | "general_chat";

export type IntentResult = {
  intent: IntentType;
};

// ============================================
// GENDER CONTEXT TYPES
// ============================================

export type Gender = "male" | "female" | "other";

export type GenderContext = "masculine" | "feminine" | "androgynous" | "fluid";

// ============================================
// WARDROBE TYPES
// ============================================

export type WardrobeItem = {
  id: string | number;
  name?: string;
  category: string;
  color?: string;
  image_url?: string;
  processed_image_url?: string;
  texture?: string;
  primary_color?: string;
  fabric?: string;
  pattern_type?: string;
  fit?: string;
  length?: string;
  style_aesthetic?: string[];
  formality?: string;
  style_notes?: string;
  occasions?: string[];
  seasons?: string[];
  weather_suitability?: string;
  item_type?: string;
  [key: string]: unknown;
};

export type WardrobeContext = {
  userId: string;
  body_type?: string;
  gender?: Gender;
  style_keywords?: string[];
  wardrobe_items: WardrobeItem[];
};

export type UserProfile = {
  body_type?: string;
  gender?: Gender;
  style_keywords?: string[];
  preferred_colors?: string[];
  avoided_colors?: string[];
  size_info?: Record<string, string>;
};

// ============================================
// MEMORY TYPES
// ============================================

export type ConversationMemory = {
  recentUserMessages: string[];
  recentAssistantMessages: string[];
  lastOutfitSuggestions: Outfit[];
  userTone: string;
  userPreferences: string[];
  frequentAesthetics: string[];
  lastIntent?: IntentType;
  lastModuleOutput?: unknown;
};

// ============================================
// FASHION INTELLIGENCE TYPES
// ============================================

export type FashionIntelligence = {
  vibe: string;
  aesthetic: string;
  fit_preference: string;
  color_direction: string;
  occasion: string;
  mood: string;
  gender_context: GenderContext;
};

// ============================================
// ANALYSIS MODULE TYPES
// ============================================

export type ColorAnalysis = {
  color_direction: string;
  primary_palette: string[];
  accent_colors: string[];
  combos: string[];
  avoid_colors: string[];
  reason: string;
};

export type SilhouetteAnalysis = {
  silhouette_verdict: string;
  recommended_structures: string[];
  proportion_tips: string[];
  layering_suggestions: string[];
  notes: string;
};

export type BodyTypeAnalysis = {
  body_type: string;
  flattering_styles: string[];
  rules: string[];
  highlight_areas: string[];
  balance_tips: string[];
  application: string;
};

// ============================================
// RULES ENGINE TYPES
// ============================================

export type RulesEngineOutput = {
  valid_pairs: string[];
  avoid_pairs: string[];
  strong_outfit_bases: string[];
  core_directions: string[];
  color_rules: string[];
  silhouette_rules: string[];
  body_type_rules: string[];
  gender_style_notes?: string[];
};

// ============================================
// SPECIALIZED MODULE OUTPUT TYPES
// ============================================

export type OutfitItemLayer = "top" | "bottom" | "outer" | "shoes" | "accessory" | "dress" | "one-piece";

export type OutfitItemHint = {
  role: OutfitItemLayer;
  hint: string;
};

export type Outfit = {
  title: string;
  items: string[];
  why_it_works: string;
  occasion?: string;
  vibe?: string;
  item_hints?: OutfitItemHint[];
};

export type VisualOutfitItem = {
  id: string;
  name: string;
  image_url: string;
  layer: OutfitItemLayer;
};

export type OutfitLayout = "2x1" | "3x1" | "2x2" | "1x1";

export type VisualOutfit = {
  title: string;
  layout: OutfitLayout;
  items: VisualOutfitItem[];
  why_it_works: string;
  occasion?: string;
  vibe?: string;
};

export type OutfitGenerationOutput = {
  outfits: Outfit[];
  styling_notes: string;
};

export type ItemRecommendationOutput = {
  items: string[];
  reasoning: string;
  alternatives?: string[];
};

export type CategoryRecommendationOutput = {
  category: string;
  recommended_items: string[];
  styling_tips: string[];
};

export type ShoppingHelpOutput = {
  brands: string[];
  aesthetics: string[];
  price_ranges: string[];
  shopping_tips: string[];
  specific_items?: string[];
};

export type TrendAnalysisOutput = {
  trend_summary: string;
  how_user_can_wear_it: string;
  items_to_use: string[];
  trend_longevity: string;
};

export type TravelPackingOutput = {
  packing_list: string[];
  outfits: Outfit[];
  shopping_gaps: string[];
  packing_tips: string[];
};

export type ContinuationOutput = {
  more_options: Outfit[] | string[];
  context_continuation: string;
};

// ============================================
// FINAL COMPOSER TYPES
// ============================================

export type FinalStylistOutput = {
  message: string;
  outfits?: Outfit[];
  items?: string[];
  brands?: string[];
  packing_list?: string[];
  trend_summary?: string;
  extra_tips?: string[];
  suggestion_pills?: string[];
};

// ============================================
// SHARED CONTEXT TYPES
// ============================================

export type SharedContext = {
  userMessage: string;
  wardrobeSummary: string;
  fashionIntelligence: FashionIntelligence;
  bodyType?: string;
  styleKeywords?: string[];
  genderContext?: GenderContext;
};

// ============================================
// LOGGING TYPES
// ============================================

export type LogEntry = {
  userId: string;
  conversationId?: string;
  timestamp: string;
  inputMessage: string;
  intent?: IntentType;
  stages: StageTimings;
  finalResponseSize?: number;
  errors: string[];
  fallbacksUsed: string[];
  success: boolean;
};

export type StageTimings = {
  intentClassification?: StageTiming;
  wardrobeFetch?: StageTiming;
  parallelInit?: StageTiming;
  fashionIntelligence?: StageTiming;
  colorAnalysis?: StageTiming;
  silhouetteAnalysis?: StageTiming;
  bodyTypeAnalysis?: StageTiming;
  rulesEngine?: StageTiming;
  specializedModule?: StageTiming;
  finalComposer?: StageTiming;
  safetyFilter?: StageTiming;
  toneRewriter?: StageTiming;
  imageResolver?: StageTiming;
  generalChat?: StageTiming;
  analysis?: StageTiming;
  total?: StageTiming;
};

export type StageTiming = {
  start: number;
  end: number;
  duration: number;
  success: boolean;
  fallback?: boolean;
  moduleName?: string;
};

// ============================================
// DEBUG TYPES
// ============================================

export type DebugInfo = {
  fashionIntelligence?: FashionIntelligence;
  colorAnalysis?: ColorAnalysis;
  silhouetteAnalysis?: SilhouetteAnalysis;
  bodyTypeAnalysis?: BodyTypeAnalysis;
  rulesEngine?: RulesEngineOutput;
  moduleOutput?: unknown;
  memory?: Partial<ConversationMemory>;
  timings?: StageTimings;
  genderContext?: GenderContext;
  optimization?: {
    sessionKey?: string;
    hadCachedAnalysis?: boolean;
    fromCache?: Record<string, boolean>;
    executionConfig?: {
      runFIE?: boolean;
      runAnalysis?: boolean;
      runRules?: boolean;
      canUseCache?: boolean;
      requiresWardrobe?: boolean;
      moduleModel?: string;
    };
    isContinuation?: boolean;
  };
};
