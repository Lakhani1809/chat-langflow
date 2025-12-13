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
  // V2 Debug fields
  v2?: {
    responseMode?: ResponseMode;
    multiIntent?: MultiIntentResult;
    canonicalMemory?: CanonicalMemory;
    wardrobeCoverage?: WardrobeCoverageProfile;
    confidences?: ConfidenceSummary;
    hardRuleViolations?: RuleViolation[];
    candidateCount?: number;
    passedCandidates?: number;
  };
};

// ============================================
// V2: RESPONSE MODE TYPES
// ============================================

/**
 * Response Mode determines what type of output is returned
 * - visual_outfit: Full wardrobe-backed outfits with images
 * - advisory_text: Purely textual advice, no outfits
 * - shopping_comparison: Shopping decision assistance, no wardrobe outfits by default
 * - mixed: Small wardrobe references optionally, not full VisualOutfit arrays
 */
export type ResponseMode = 
  | "visual_outfit"
  | "advisory_text"
  | "shopping_comparison"
  | "mixed";

/**
 * Output contract for response enforcement
 */
export type OutputContract = 
  | "outfits_required"
  | "outfits_optional"
  | "no_outfits";

// ============================================
// V2: CONFIDENCE TYPES
// ============================================

/**
 * Confidence score with basis and optional degradation reason
 */
export type ConfidenceScore = {
  score: number; // 0..1
  basis: string[]; // e.g., ["user_stated", "wardrobe_backed", "inferred"]
  degrade_reason?: string;
};

/**
 * Summary of all confidence scores for a request
 */
export type ConfidenceSummary = {
  intent: ConfidenceScore;
  memory: ConfidenceScore;
  wardrobe: ConfidenceScore;
  analysis: ConfidenceScore;
  rules: ConfidenceScore;
  final: ConfidenceScore;
};

/**
 * Confidence-driven behavior thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  LOW: 0.4,    // Ask clarifying question
  MEDIUM: 0.7, // Provide hedged recommendation
  HIGH: 1.0,   // Be decisive and specific
} as const;

// ============================================
// V2: MULTI-INTENT TYPES
// ============================================

/**
 * Multi-intent classification result
 */
export type MultiIntentResult = {
  primary_intent: IntentType;
  secondary_intents: IntentType[];
  intent_confidence: ConfidenceScore;
  rationale?: string; // Debug only
};

// ============================================
// V2: CANONICAL MEMORY TYPES
// ============================================

/**
 * Resolved preference with source and confidence
 */
export type ResolvedPreference = {
  value: string;
  source: "explicit" | "inferred" | "default";
  confidence: number;
  timestamp?: string;
};

/**
 * Preference contradiction for conflict tracking
 */
export type PreferenceContradiction = {
  field: string;
  value1: string;
  value2: string;
  source1: string;
  source2: string;
};

/**
 * Canonical memory - resolved, conflict-free preferences
 */
export type CanonicalMemory = {
  // Core preferences
  fit_preference: ResolvedPreference;
  vibes: string[]; // Resolved aesthetic vibes
  color_likes: string[];
  color_avoids: string[];
  formality_preference: ResolvedPreference;
  climate_context?: ResolvedPreference;
  comfort_vs_style?: ResolvedPreference; // "comfort", "style", "balanced"
  
  // Hard negatives
  do_not_suggest: string[];
  
  // Metadata
  last_confirmed_preferences?: string; // ISO timestamp
  contradictions: PreferenceContradiction[];
  needs_clarification: boolean;
  memory_confidence: ConfidenceScore;
  
  // Raw memory for fallback
  rawMemory?: ConversationMemory;
};

// ============================================
// V2: WARDROBE COVERAGE TYPES
// ============================================

/**
 * Coverage level for a category
 */
export type CoverageLevel = "none" | "low" | "medium" | "high";

/**
 * Category coverage detail
 */
export type CategoryCoverage = {
  count: number;
  withImages: number;
  level: CoverageLevel;
};

/**
 * Complete wardrobe coverage profile
 */
export type WardrobeCoverageProfile = {
  tops: CategoryCoverage;
  bottoms: CategoryCoverage;
  footwear: CategoryCoverage;
  outerwear: CategoryCoverage;
  accessories: CategoryCoverage;
  ethnic: CategoryCoverage;
  dresses: CategoryCoverage;
  
  // Summary
  totalItems: number;
  totalWithImages: number;
  availableSlots: OutfitSlot[];
  missingMandatorySlots: OutfitSlot[];
  canCreateCompleteOutfit: boolean;
};

// ============================================
// V2: OUTFIT SLOTS & COMPLETENESS TYPES
// ============================================

/**
 * Outfit slot types
 */
export type OutfitSlot = 
  | "upper_wear"
  | "lower_wear"
  | "footwear"
  | "layering"
  | "accessory";

/**
 * Mandatory slots for a complete outfit
 */
export const MANDATORY_SLOTS: OutfitSlot[] = ["upper_wear", "lower_wear", "footwear"];

/**
 * Optional slots
 */
export const OPTIONAL_SLOTS: OutfitSlot[] = ["layering", "accessory"];

/**
 * Outfit draft with structured slots (for rule evaluation)
 */
export type OutfitDraft = {
  id: string;
  title: string;
  slots: {
    upper_wear?: OutfitSlotItem;
    lower_wear?: OutfitSlotItem;
    footwear?: OutfitSlotItem;
    layering?: OutfitSlotItem;
    accessories?: OutfitSlotItem[]; // 0-2 max
  };
  why_it_works: string;
  occasion?: string;
  vibe?: string;
  source: "llm" | "fallback";
};

/**
 * Individual slot item
 */
export type OutfitSlotItem = {
  itemId?: string | number; // If mapped to wardrobe
  hint: string; // Text description
  category: string;
  subcategory?: string;
  silhouette?: "slim" | "regular" | "relaxed" | "oversized" | "longline";
  formality?: "casual" | "smart" | "formal";
  season?: "hot" | "mild" | "cold";
  aestheticTags?: string[];
  colorFamily?: string;
};

// ============================================
// V2: HARD RULES TYPES
// ============================================

/**
 * Rule violation severity
 */
export type RuleSeverity = "block" | "warn";

/**
 * Rule violation details
 */
export type RuleViolation = {
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  slotsInvolved: OutfitSlot[];
  evidence?: string;
};

/**
 * Hard rule evaluation result
 */
export type HardRuleResult = {
  allowed: boolean;
  violations: RuleViolation[];
  scorePenalty: number;
};

/**
 * Rule context for evaluation
 */
export type RuleContext = {
  occasion?: string;
  formality?: "casual" | "smart" | "formal";
  climate?: "hot" | "mild" | "cold";
  strictness?: "relaxed" | "normal" | "strict";
  responseMode: ResponseMode;
  hasWardrobeItems: boolean;
};

/**
 * Soft rule from LLM
 */
export type SoftRule = {
  id: string;
  type: "prefer" | "avoid";
  condition: string;
  explanation: string;
  weight: number; // 0-1
};

/**
 * Rule configuration for tuning
 */
export type RuleConfig = {
  enforceFormality: boolean;
  enforceSilhouette: boolean;
  enforceEthnicCoherence: boolean;
  enforceClimateSanity: boolean;
  strictnessLevel: "relaxed" | "normal" | "strict";
};

// ============================================
// V2: SHOPPING COMPARISON TYPES
// ============================================

/**
 * Shopping comparison output format
 */
export type ShoppingComparisonOutput = {
  verdict: string; // "Buy X"
  reasons: string[]; // 3 reasons tied to user context
  alternative_when: string; // When the other option makes sense
  wardrobe_styling_hint?: string; // Text only, no VisualOutfit
};

// ============================================
// V2: EXTENDED EXECUTION CONFIG
// ============================================

/**
 * V2 Execution configuration with response mode
 */
export type ExecutionConfigV2 = {
  runFIE: boolean;
  runAnalysis: boolean;
  runRules: boolean;
  canUseCache: boolean;
  requiresWardrobe: boolean;
  moduleModel: "gemini-2.5-flash-lite" | "gemini-2.0-flash";
  // V2 additions
  responseMode: ResponseMode;
  outputContract: OutputContract;
  generateCandidates: boolean;
  candidateCount?: number;
};
