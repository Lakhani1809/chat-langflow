# MyMirro Chat API - Complete Workflow Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Request Flow](#request-flow)
4. [Detailed Step-by-Step Workflow](#detailed-step-by-step-workflow)
5. [V5/V6 Features](#v5v6-features)
6. [Key Components](#key-components)
7. [Data Flow](#data-flow)
8. [Optimization Strategies](#optimization-strategies)
9. [Response Modes](#response-modes)
10. [Error Handling](#error-handling)
11. [Migration Guide](#migration-guide)

---

## Overview

The MyMirro Chat API is an AI-powered fashion stylist backend that provides personalized outfit recommendations, styling advice, and wardrobe management. The system uses Google's Gemini AI models to analyze user preferences, wardrobe items, and generate contextual fashion recommendations.

### Key Capabilities
- **Outfit Generation**: Create complete outfit suggestions from user's wardrobe
- **Style Analysis**: Color, silhouette, and body type analysis
- **Shopping Assistance**: Item recommendations and brand suggestions
- **Trend Analysis**: Current fashion trends and styling tips
- **Travel Packing**: Curated packing lists for trips
- **Wardrobe Queries**: Explore and understand user's wardrobe
- **Multi-Intent Support**: Handle complex queries with multiple intents
- **Confidence-Aware Responses**: Adapt behavior based on system confidence

---

## Architecture

### High-Level Architecture (V6)

```
┌─────────────┐
│   Frontend  │ (React/Next.js UI)
│  (page.tsx) │
└──────┬──────┘
       │ POST /api/chat
       ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route Handler V6                            │
│            (app/api/chat/route.ts)                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 1: LLM Intent Classification (Always)            │ │
│  │  - NO keyword shortcuts (V5 change)                    │ │
│  │  - Multi-intent with primary/secondary                 │ │
│  │  - Confidence scoring                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 2: Conditional Wardrobe Fetch (V5)               │ │
│  │  - Check requiresWardrobe from execution config        │ │
│  │  - Skip fetch for advisory intents                     │ │
│  │  - Explicit wardrobe request detection                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 3: Smart Clarification (V4)                      │ │
│  │  - ONE question only, NEVER repeat                     │ │
│  │  - Only for required context (occasion/climate)        │ │
│  │  - Suggestion pills for quick answers                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 4: Analysis Pipeline (Cached)                    │ │
│  │  - Fashion Intelligence Engine (FIE)                   │ │
│  │  - Color/Silhouette/Body Analysis (parallel)           │ │
│  │  - Rules Engine                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 5: Canonical Memory + Confidence                 │ │
│  │  - Memory arbitration (resolve conflicts)              │ │
│  │  - Combined confidence scoring                         │ │
│  │  - Wardrobe coverage profile                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 6: Stylist Decision Layer (V6) ← NEW             │ │
│  │  - MUST pick one option (no hedging)                   │ │
│  │  - Deterministic decision rules                        │ │
│  │  - stylistMode: "stylist" | "advisor"                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 7: Specialized Module Routing                    │ │
│  │  - Outfit / Shopping / Travel / Trends                 │ │
│  │  - Intent-aware response mode enforcement              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 8: Final Composition (V6)                        │ │
│  │  - Canonical decision examples injected                │ │
│  │  - Compressed inputs (1-line constraints)              │ │
│  │  - Hedging removal + explanation limits                │ │
│  │  - Engagement engine integration                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  STEP 9: Post-Processing                               │ │
│  │  - Safety filter                                       │ │
│  │  - Image resolution                                    │ │
│  │  - Response formatting                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Response  │ (JSON with outfits, message, pills)
└─────────────┘
```

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **AI Models**: 
  - `gemini-2.5-flash-lite` (fast, lightweight tasks)
  - `gemini-2.0-flash` (complex reasoning, final responses)
- **Database**: Supabase (wardrobe items, user profiles)
- **Caching**: In-memory session cache (no Redis)
- **Testing**: Vitest

---

## Request Flow

### 1. Frontend Request

The frontend (`app/page.tsx`) sends a POST request to `/api/chat` with:

```typescript
{
  userId: string;
  message: string;
  conversationId?: string;  // Optional, auto-generated if missing
  history?: ConversationMessage[];  // Chat history
}
```

### 2. API Route Entry Point

The request enters `app/api/chat/route.ts` → `POST()` function, which orchestrates the entire workflow.

### 3. Response Format

The API returns a `ChatResponse`:

```typescript
{
  intent: IntentType;
  message: string;  // Gen-Z friendly stylist message
  outfits?: VisualOutfit[];  // Complete outfits with images
  items?: string[];  // Item recommendations
  brands?: string[];  // Brand suggestions
  packing_list?: string[];  // Travel packing items
  trend_summary?: string;  // Trend analysis
  extra_tips?: string[];  // Additional styling tips
  suggestion_pills?: string[];  // Contextual follow-up prompts
  debug?: DebugInfo;  // Development-only debug info
}
```

---

## Detailed Step-by-Step Workflow

### STEP 0: Parse and Validate Input

**Location**: `app/api/chat/route.ts` (lines 106-126)

1. Parse request body as `ChatRequest`
2. Validate `userId` and `message` are present
3. Generate `conversationId` if not provided
4. Extract `history` array (defaults to empty)
5. Initialize logging entry

**Output**: Validated input data, session key for caching

---

### STEP 1: LLM Intent Classification (V5: Always LLM)

**Location**: `app/api/chat/route.ts` (lines 152-199)

**Purpose**: Accurately classify user intent using LLM (no keyword shortcuts).

**V5 Change**: Removed keyword-based intent detection. LLM is ALWAYS used for accurate understanding.

#### Why LLM-Only?
- **Problem**: Keyword matching caused false positives (e.g., "trending" in "what's trending?" incorrectly triggered outfit generation)
- **Solution**: LLM understands context and nuance
- **Trade-off**: Slightly higher latency (~200-300ms) but much better accuracy

#### 1.1 Memory Building (Synchronous)
- **Function**: `buildConversationMemory()` from `utils/memory.ts`
- **Purpose**: Extract conversation context before intent classification
- **Extracts**:
  - Recent user/assistant messages
  - User tone (casual, professional, etc.)
  - User preferences
  - Frequent aesthetics
  - Last outfit suggestions

#### 1.2 LLM Intent Classification
- **Function**: `classifyIntent()` from `utils/intentClassifier.ts`
- **Model**: `gemini-2.5-flash-lite`
- **Returns**: `MultiIntentResult` with:
  - `primary_intent`: Main intent
  - `secondary_intents`: Additional relevant intents (e.g., shopping + outfit)
  - `intent_confidence`: Confidence score (0-1)
  - `rationale`: Why this intent was chosen

**Example Classifications**:
```
"what should I wear today?" → outfit_generation (0.95)
"hoodie or jacket for a date?" → shopping_help + event_styling (0.88)
"what's trending in streetwear?" → trend_analysis (0.92)
```

---

### STEP 2: Conditional Wardrobe Fetch (V5)

**Location**: `app/api/chat/route.ts` (lines 201-239)

**Purpose**: Only fetch wardrobe when the intent actually needs it.

**V5 Change**: Wardrobe fetch is now CONDITIONAL based on `requiresWardrobe` from execution config.

#### Why Conditional?
- **Problem**: Fetching wardrobe for every request is wasteful for advisory intents
- **Solution**: Check intent first, then decide if wardrobe is needed
- **Savings**: ~100-300ms for intents like `trend_analysis`, `general_chat`

#### Decision Logic
```typescript
const execConfig = getExecutionConfig(intent);
const explicitWardrobeRequest = detectWardrobeRequest(message);
const needsWardrobe = execConfig.requiresWardrobe || explicitWardrobeRequest;
```

#### Intents That NEED Wardrobe
- `outfit_generation` ✅
- `event_styling` ✅
- `travel_packing` ✅
- `wardrobe_query` ✅
- `item_recommendation` ✅

#### Intents That SKIP Wardrobe
- `trend_analysis` ⏭️
- `shopping_help` ⏭️ (unless comparing with owned items)
- `color_analysis` ⏭️
- `body_type_advice` ⏭️
- `general_chat` ⏭️

#### Explicit Wardrobe Request Detection
- **Function**: `detectWardrobeRequest()` from `utils/wardrobeRequestDetector.ts`
- **Purpose**: Detect if user explicitly mentions "my wardrobe", "what I have", etc.
- **Override**: If detected, fetch wardrobe even for advisory intents

---

### STEP 2: Extract Intent and Wardrobe Context

**Location**: `app/api/chat/route.ts` (lines 170-229)

1. **Extract Intent**:
   - Handle both quick intent (string) and LLM result (MultiIntentResult)
   - Set `intent`, `secondaryIntents`, `intentConfidence`
   - Fallback to `general_chat` if classification fails

2. **Extract Wardrobe Context**:
   - Use fulfilled wardrobe result or fallback to empty wardrobe
   - Log wardrobe item count

3. **V2: Compute Wardrobe Coverage Profile**:
   - **Function**: `computeWardrobeCoverage()` from `utils/wardrobeCoverage.ts`
   - **Purpose**: Analyze wardrobe completeness and image availability
   - **Returns**: `WardrobeCoverageProfile` with:
     - Item counts per category (tops, bottoms, footwear, etc.)
     - Image availability per category
     - Missing mandatory slots
     - Coverage level (none, low, medium, high)

---

### STEP 3: Get Execution Configuration

**Location**: `app/api/chat/route.ts` (lines 244-253)

**Function**: `getExecutionConfig()` or `getExecutionConfigV2()` from `utils/executionMap.ts`

**Purpose**: Determine which modules to run based on intent.

#### Execution Map Structure

```typescript
{
  runFIE: boolean;           // Run Fashion Intelligence Engine?
  runAnalysis: boolean;     // Run color/silhouette/body analysis?
  runRules: boolean;         // Run rules engine?
  canUseCache: boolean;      // Can reuse cached analysis?
  requiresWardrobe: boolean; // Need wardrobe data?
  moduleModel: "gemini-2.5-flash-lite" | "gemini-2.0-flash";
  responseMode: ResponseMode;        // V2: visual_outfit, advisory_text, shopping_comparison
  outputContract: OutputContract;   // V2: outfits_required, outfits_optional, no_outfits
  generateCandidates: boolean;       // V2: Generate multiple outfit candidates?
}
```

#### Example Configurations

**Heavy Intent** (`outfit_generation`):
```typescript
{
  runFIE: true,
  runAnalysis: true,
  runRules: true,
  canUseCache: true,
  requiresWardrobe: true,
  moduleModel: "gemini-2.0-flash",
  responseMode: "visual_outfit",
  outputContract: "outfits_required",
  generateCandidates: true,
  candidateCount: 8
}
```

**Light Intent** (`general_chat`):
```typescript
{
  runFIE: false,
  runAnalysis: false,
  runRules: false,
  canUseCache: false,
  requiresWardrobe: false,
  moduleModel: "gemini-2.5-flash-lite",
  responseMode: "advisory_text",
  outputContract: "no_outfits",
  generateCandidates: false
}
```

**Continuation Query** (`continuation_query`):
```typescript
{
  runFIE: false,      // Reuse cached
  runAnalysis: false, // Reuse cached
  runRules: false,    // Reuse cached
  canUseCache: true,  // CRITICAL: reuse everything
  requiresWardrobe: true,
  moduleModel: "gemini-2.0-flash",
  responseMode: "visual_outfit",
  outputContract: "outfits_required",
  generateCandidates: true,
  candidateCount: 6
}
```

---

### STEP 4: Handle General Chat Shortcut

**Location**: `app/api/chat/route.ts` (lines 258-287)

**Purpose**: Fast path for general conversation (no analysis needed).

**Flow**:
1. If `intent === "general_chat"`:
   - Skip all analysis modules
   - Call `composeGeneralChatResponse()` directly
   - Return response immediately

**Optimization**: Saves ~3-5 seconds for casual conversation.

---

### STEP 5: Run Analysis Pipeline

**Location**: `app/api/chat/route.ts` (lines 290-432)

**Function**: `runAnalysisPipeline()` from `analysis/index.ts`

**Purpose**: Generate fashion intelligence, color/silhouette/body analysis, and styling rules.

#### 5.1 Cache Check

**Session Cache Key**: `userId:conversationId`

**Cache Check Logic**:
- If `isContinuationIntent` and `hasCachedAnalysis`:
  - Reuse ALL cached analysis (FIE, color, silhouette, body, rules)
  - Skip all LLM calls
  - **HUGE WIN**: Follow-ups complete in ~1-2 seconds

#### 5.2 Fashion Intelligence Engine (FIE)

**Function**: `extractFashionIntelligence()` from `analysis/intelligence.ts`

**Purpose**: Understand user's style preferences and context.

**Model**: `gemini-2.5-flash-lite`

**Output**: `FashionIntelligence`:
```typescript
{
  vibe: string;              // e.g., "casual", "edgy", "minimalist"
  aesthetic: string;          // e.g., "streetwear", "classic", "bohemian"
  fit_preference: string;     // e.g., "comfortable", "fitted", "relaxed"
  color_direction: string;    // e.g., "neutral", "bold", "pastel"
  occasion: string;           // e.g., "everyday", "date night", "work"
  mood: string;              // e.g., "confident", "playful", "sophisticated"
  gender_context: GenderContext;  // "masculine", "feminine", "androgynous", "fluid"
}
```

**Input**: User message, wardrobe summary, gender context

#### 5.3 Parallel Analysis Modules

**Purpose**: Analyze color, silhouette, and body type in parallel.

**Model**: `gemini-2.5-flash-lite` (all three run simultaneously)

##### 5.3.1 Color Analysis

**Function**: `analyzeColors()` from `analysis/color.ts`

**Output**: `ColorAnalysis`:
```typescript
{
  color_direction: string;      // Overall color strategy
  primary_palette: string[];    // Main colors to use
  accent_colors: string[];      // Pop colors
  combos: string[];            // Good color combinations
  avoid_colors: string[];      // Colors to avoid
  reason: string;              // Explanation
}
```

##### 5.3.2 Silhouette Analysis

**Function**: `analyzeSilhouette()` from `analysis/silhouette.ts`

**Output**: `SilhouetteAnalysis`:
```typescript
{
  silhouette_verdict: string;           // Overall silhouette strategy
  recommended_structures: string[];     // e.g., "fitted top + relaxed bottom"
  proportion_tips: string[];            // Proportion advice
  layering_suggestions: string[];       // Layering ideas
  notes: string;                        // Additional notes
}
```

##### 5.3.3 Body Type Analysis

**Function**: `analyzeBodyType()` from `analysis/body.ts`

**Output**: `BodyTypeAnalysis`:
```typescript
{
  body_type: string;            // e.g., "balanced", "pear", "apple"
  flattering_styles: string[]; // Styles that work well
  rules: string[];             // Body-specific rules
  highlight_areas: string[];   // Areas to emphasize
  balance_tips: string[];      // Proportion balance tips
  application: string;         // How to apply
}
```

#### 5.4 Rules Engine

**Function**: `generateStylingRules()` or `createQuickRulesFromAnalyses()` from `analysis/rules.ts`

**Purpose**: Generate styling rules from analysis outputs.

**Model**: `gemini-2.5-flash-lite` (if not cached)

**Output**: `RulesEngineOutput`:
```typescript
{
  valid_pairs: string[];           // Good item combinations
  avoid_pairs: string[];           // Bad combinations
  strong_outfit_bases: string[];   // Reliable base combinations
  core_directions: string[];       // Core styling principles
  color_rules: string[];           // Color-specific rules
  silhouette_rules: string[];      // Silhouette rules
  body_type_rules: string[];      // Body type rules
  gender_style_notes: string[];    // Gender context notes
}
```

**Optimization**: If cached, use `createQuickRulesFromAnalyses()` (no LLM call).

#### 5.5 Update Session Cache

**Function**: `updateSessionCache()` from `utils/sessionCache.ts`

**Purpose**: Store analysis results for future requests in the same session.

**Cached Data**:
- `fashionIntelligence`
- `colorAnalysis`
- `silhouetteAnalysis`
- `bodyTypeAnalysis`
- `rules`
- `genderContext`
- `canonicalMemory` (V2)

---

### STEP 6: V2 Features - Canonical Memory & Confidence

**Location**: `app/api/chat/route.ts` (lines 434-473)

#### 6.1 Canonical Memory Arbitration

**Function**: `arbitrateMemory()` from `utils/memoryArbiter.ts`

**Purpose**: Resolve conflicts in user preferences to create a single source of truth.

**Process**:
1. Extract preferences from conversation history:
   - Fit preference (slim, regular, relaxed, oversized)
   - Vibes/aesthetics
   - Color likes/avoids
   - Formality preference
   - Climate context
   - Comfort vs. style balance
   - Negative preferences (do not suggest)

2. Detect contradictions:
   - Compare new preferences with previous canonical memory
   - Flag conflicts (e.g., "I like fitted" vs. "I prefer loose")

3. Resolve conflicts:
   - Prioritize explicit statements over inferred
   - Use recency (latest preference wins)
   - Mark contradictions for clarification

4. Build canonical memory:
```typescript
{
  fit_preference: ResolvedPreference;
  vibes: string[];
  color_likes: string[];
  color_avoids: string[];
  formality_preference: ResolvedPreference;
  climate_context?: string;
  comfort_vs_style?: "comfort" | "style" | "balanced";
  do_not_suggest: string[];
  contradictions: PreferenceContradiction[];
  needs_clarification: boolean;
  memory_confidence: ConfidenceScore;
}
```

#### 6.2 Confidence Scoring

**Function**: `combineConfidences()` from `utils/confidence.ts`

**Purpose**: Calculate overall system confidence to adapt behavior.

**Confidence Sources**:
1. **Intent Confidence**: How certain we are about the intent
2. **Memory Confidence**: How reliable the canonical memory is
3. **Wardrobe Confidence**: Based on wardrobe coverage
4. **Analysis Confidence**: Based on cache hits vs. fresh analysis
5. **Rules Confidence**: Based on cache hits vs. fresh rules

**Combined Confidence**:
```typescript
{
  intent: ConfidenceScore;
  memory: ConfidenceScore;
  wardrobe: ConfidenceScore;
  analysis: ConfidenceScore;
  rules: ConfidenceScore;
  final: ConfidenceScore;  // Weighted combination
}
```

**Confidence-Driven Behavior**:
- **Low Confidence (< 0.5)**: Ask clarifying questions
- **Medium Confidence (0.5-0.7)**: Use hedging phrases ("might work", "could try")
- **High Confidence (> 0.7)**: Be decisive ("this will work", "definitely try")

#### 6.3 Clarification Check

**Function**: `shouldAskClarification()` from `utils/confidence.ts`

**Purpose**: Determine if we should ask a clarifying question instead of generating outfits.

**Logic**:
- If `confidenceSummary.final.score < 0.5` AND `canonicalMemory.needs_clarification`:
  - Generate clarifying question using `getClarifyingQuestion()`
  - Return early with question instead of outfits

---

### STEP 7: Handle Special Intents (Color/Body Type)

**Location**: `app/api/chat/route.ts` (lines 476-533)

**Purpose**: Fast path for color analysis and body type advice.

**Flow**:
1. If `intent === "color_analysis"`:
   - Call `composeColorAnalysisResponse()`
   - Return color-specific advice
   - Skip outfit generation

2. If `intent === "body_type_advice"`:
   - Call `composeBodyTypeResponse()`
   - Return body type styling tips
   - Skip outfit generation

---

### STEP 8: Route to Specialized Module

**Location**: `app/api/chat/route.ts` (lines 536-572)

**Function**: `routeToModule()` from `modules/index.ts`

**Purpose**: Route to intent-specific module for specialized processing.

#### Module Routing Map

| Intent | Module | Purpose |
|--------|--------|---------|
| `outfit_generation` | `modules/outfit.ts` | Generate complete outfits |
| `event_styling` | `modules/outfit.ts` | Event-specific outfits |
| `travel_packing` | `modules/travel.ts` | Packing lists |
| `shopping_help` | `modules/shopping.ts` | Shopping recommendations |
| `item_recommendation` | `modules/items.ts` | Specific item suggestions |
| `category_recommendation` | `modules/category.ts` | Category-based recommendations |
| `trend_analysis` | `modules/trends.ts` | Fashion trends |

#### Outfit Generation Module (V2)

**Function**: `generateOutfitsV2()` from `modules/outfit.ts`

**Purpose**: Generate multiple outfit candidates with rule evaluation.

**Process**:
1. **Generate Candidates**:
   - Use `gemini-2.0-flash` to generate 6-8 outfit drafts
   - Each draft is structured as `OutfitDraft`:
   ```typescript
   {
     upper: OutfitSlotItem;      // Required
     lower: OutfitSlotItem;       // Required
     footwear: OutfitSlotItem;    // Required
     outer?: OutfitSlotItem;      // Optional
     accessories?: OutfitSlotItem[];  // Optional
   }
   ```

2. **Rule Evaluation**:
   - **Hard Rules** (deterministic, from `rules/hardRules.ts`):
     - Mandatory slots check (upper, lower, footwear)
     - Formality coherence
     - Silhouette compatibility
     - Ethnic coherence
     - Climate sanity
     - No duplicate slots
   - **Soft Rules** (LLM-suggested, from `rules/softRules.ts`):
     - Color harmony
     - Style consistency
     - Occasion appropriateness

3. **Filter and Rank**:
   - Block outfits that violate hard rules
   - Score outfits based on soft rules
   - Select top 3-4 outfits

4. **Convert to Outfits**:
   - Transform `OutfitDraft[]` to `Outfit[]`
   - Add titles, explanations, styling notes

**Input Context**:
- User message
- Wardrobe context
- Fashion intelligence
- Canonical memory (V2)
- Wardrobe coverage profile (V2)
- Rules engine output
- Analysis results

---

### STEP 9: Compose Final Response

**Location**: `app/api/chat/route.ts` (lines 575-610)

**Function**: `composeFinalResponse()` or `composeFinalResponseV2()` from `utils/finalComposer.ts`

**Purpose**: Create the final stylist message with Gen-Z tone and merge rules reasoning.

**Model**: `gemini-2.0-flash`

**Optimizations**:
1. **Merged Rules Reasoning**: Rules are explained within the final composer prompt (saves 1 LLM call)
2. **Merged Tone Rewriting**: Gen-Z tone is built into the composer (saves 1 LLM call)

**Process**:
1. Build comprehensive prompt with:
   - User message
   - Module output (outfits, items, etc.)
   - Fashion intelligence
   - Analysis results (color, silhouette, body)
   - Canonical memory (V2)
   - Confidence summary (V2)
   - Rules engine output
   - Wardrobe context

2. Instruct LLM to:
   - Write in Gen-Z tone (casual, fun, supportive)
   - Explain why outfits work
   - Provide styling tips
   - Be confident or hedging based on confidence score

3. Generate response:
```typescript
{
  message: string;           // Main stylist message
  outfits: Outfit[];         // Outfit suggestions
  extra_tips: string[];      // Additional styling tips
  suggestion_pills: string[]; // Contextual follow-up prompts
}
```

#### V2: Shopping Comparison Mode

**Function**: `composeShoppingComparisonV2()` from `utils/finalComposer.ts`

**Purpose**: Generate decisive shopping advice when user is comparing items.

**Behavior**:
- **High Confidence**: Direct recommendation ("Go with X")
- **Medium Confidence**: Comparison with pros/cons
- **Low Confidence**: Ask clarifying questions

**Output**: `ShoppingComparisonOutput` with:
- Recommended item
- Comparison table
- Rationale
- Alternative options

---

### STEP 10: Apply Safety Filter

**Location**: `app/api/chat/route.ts` (lines 613-635)

**Function**: `applySafetyFilter()` from `utils/safetyFilter.ts`

**Purpose**: Ensure all suggestions are safe and appropriate.

**Checks**:
1. **Outfit Safety**:
   - Verify all items exist in wardrobe
   - Check for inappropriate combinations
   - Validate occasion appropriateness

2. **Item Safety**:
   - Filter out unavailable items
   - Check item availability

3. **Packing List Safety**:
   - Validate travel items
   - Check for duplicates

**Output**: Filtered outfits, items, packing lists

---

### STEP 11: Resolve Outfit Images

**Location**: `app/api/chat/route.ts` (lines 638-664)

**Function**: `resolveAllOutfitImages()` from `utils/outfitImageResolver.ts`

**Purpose**: Match LLM-suggested items to actual wardrobe items with images.

**Process**:
1. For each outfit:
   - Extract item hints from `Outfit.items` (string array)
   - Match hints to actual `WardrobeItem` objects
   - Use fuzzy matching on name, category, color
   - Attach `image_url` to matched items

2. Build `VisualOutfit`:
```typescript
{
  title: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    image_url?: string;
    // ... other item properties
  }>;
  why_it_works: string;
  layout: "grid";  // For frontend rendering
}
```

3. Filter to only outfits with at least one image

**Image Matching Logic**:
- Match by exact name
- Match by category + color
- Match by item type + style
- Fallback to placeholder if no match

---

### STEP 12: Build Final Response

**Location**: `app/api/chat/route.ts` (lines 667-713)

**Purpose**: Assemble the final `ChatResponse` object.

**Process**:
1. Format module output using `formatFinalOutput()`
2. Build debug info (development only):
   - Analysis results
   - Module output
   - Memory context
   - Timings
   - Optimization metrics (cache hits, execution config)

3. Assemble response:
```typescript
{
  intent: IntentType;
  message: string;              // Gen-Z friendly message
  outfits?: VisualOutfit[];    // Visual outfits with images
  items?: string[];            // Item recommendations
  brands?: string[];          // Brand suggestions
  packing_list?: string[];    // Travel items
  trend_summary?: string;     // Trend analysis
  extra_tips?: string[];      // Styling tips
  suggestion_pills?: string[]; // Follow-up prompts
  debug?: DebugInfo;          // Development only
}
```

4. Log response size and metrics

---

### STEP 13: Return Response

**Location**: `app/api/chat/route.ts` (lines 715-729)

**Process**:
1. Finalize logging entry
2. Calculate total request time
3. Log completion metrics:
   - Intent
   - Cache hit status
   - Outfit count
   - Response size
4. Return `NextResponse.json(response)`

---

## V5/V6 Features

### 1. LLM-Only Intent Classification (V5)

**Purpose**: Accurate intent understanding without keyword false positives.

**Key Changes**:
- Removed `getIntentFromKeywords()` shortcut
- Always use LLM for intent classification
- Better handling of ambiguous queries

**Benefits**:
- "What's trending?" → `trend_analysis` (not `outfit_generation`)
- "Hoodie or jacket?" → `shopping_help` (comparison detected)
- Multi-intent support with confidence scores

---

### 2. Conditional Wardrobe Fetching (V5)

**Purpose**: Only fetch wardrobe data when needed.

**Key Changes**:
- Intent classification happens FIRST
- Check `requiresWardrobe` from execution config
- Skip fetch for advisory intents

**Performance**:
- Saves ~100-300ms for advisory intents
- Reduces database load
- More efficient resource usage

---

### 3. Stylist Decision Layer (V6) ← NEW

**Purpose**: Force decisive, non-hedging responses.

**Location**: `utils/stylistDecision.ts`

**Philosophy**: The AI is a STYLIST making decisions, not an advisor presenting options.

#### Decision Types
```typescript
type StylistDecisionType = "choose_one" | "outfit_set" | "no_outfit";
```

#### Decision Rules
| Intent | Decision | Behavior |
|--------|----------|----------|
| `shopping_help` | `choose_one` | MUST pick one option |
| `outfit_generation` | `outfit_set` | MUST return curated outfits |
| `trend_analysis` | `no_outfit` | Advisory only |

#### Key Functions
- `makeStylistDecision()`: Main decision function
- `extractComparisonOptions()`: Parse "X or Y" patterns
- `pickBestOption()`: Deterministic option selection
- `getDecisivePhrase()`: Get decisive language

#### Example Transformation
```
Before (hedging):
"Both the hoodie and jacket could work! The hoodie is more casual 
while the jacket is more polished. It really depends on your vibe..."

After (decisive):
"Jacket. It sharpens your silhouette and elevates the look. 
Skip the hoodie for this occasion."
```

---

### 4. Smart Clarification System (V4)

**Purpose**: Ask ONE clarifying question when context is truly missing.

**Location**: `utils/clarificationDetector.ts`

**V4 Rules (Reduced Aggressiveness)**:
1. Only ask ONE question per session
2. If user has provided context, don't ask
3. If already asked, proceed with comprehensive response
4. ONLY ask for required context (occasion, climate)
5. NEVER ask taste/preference questions (fit, color, aesthetic)
6. Low confidence alone is NOT a trigger

#### When to Ask
| Intent | Ask About | Example Question |
|--------|-----------|------------------|
| `outfit_generation` | Occasion (if missing) | "What's the occasion? 📍" |
| `travel_packing` | Climate (if missing) | "What's the weather like?" |

#### When NOT to Ask
- Fit preference ("fitted or relaxed?") ❌
- Color preference ("what colors?") ❌
- Aesthetic preference ("minimalist or bold?") ❌
- User already mentioned any context ❌

---

### 5. Engagement Engine (V4)

**Purpose**: Keep conversations alive, promote features, drive wardrobe completeness.

**Location**: `utils/engagementEngine.ts`

#### Capabilities

**1. Wardrobe Gap Detection**
```typescript
detectWardrobeGaps() → {
  missingCategories: ["footwear", "basic tops"],
  suggestedItems: ["your go-to sneakers"],
  gapMessage: "I can build stronger outfits once you add some footwear..."
}
```

**V4 Rule**: ONE honest line about gaps, not promotional fluff.

**2. Feature Promotion**
```typescript
getFeaturePromotion(intent, conversationTurn) → {
  feature: "style_check",
  message: "📱 Want a quick style check before you head out?",
  ctaText: "Try Style Check"
}
```

**3. Next-Step Suggestions**
```typescript
generateNextStep() → "Want to see these with different shoes? 👟"
```

**4. Engagement Pills**
```typescript
generateEngagementPills() → [
  "Show me more options",
  "Make it more casual",
  "Different colors",
  "Add accessories"
]
```

**5. Continuation Hooks**
```typescript
generateContinuationHook() → "btw, want to explore more vibes? 💅"
```

---

### 6. Canonical Decision Examples (V6)

**Purpose**: Teach LLM decisive behavior through examples.

**Location**: `utils/finalComposer.ts`

**Injected Examples**:
```
User: "Should I wear a hoodie or a jacket?"
A: "Jacket. It sharpens your silhouette and elevates the look. 
    Skip the hoodie for this occasion."

User: "Is this outfit okay or should I change?"
A: "Change it. The fit is too relaxed for the setting."

User: "Can I wear sneakers to this dinner?"
A: "No. Go with clean loafers or boots — sneakers will underdress."
```

These examples are ALWAYS included in the prompt (never dynamic).

---

### 7. Non-Overridable Decisions (V6)

**Purpose**: Prevent LLM from re-evaluating upstream decisions.

**Decision Authority Instruction**:
```
A stylist decision has already been made upstream.
You must NOT reconsider it.
You must NOT present alternatives.
You must NOT hedge.
Your role is to confidently explain and justify the chosen direction.
```

---

### 8. Compressed Inputs (V6)

**Purpose**: Reduce prompt noise, increase decision clarity.

**Before**:
```
STYLING GUIDANCE:
Color direction: neutral
Primary palette: black, white, grey
Good combos: black and white, navy and cream
Silhouette verdict: balanced proportions...
[500+ tokens]
```

**After**:
```
CONSTRAINTS: Color: neutral | Silhouette: balanced | Vibe: casual | Occasion: everyday
WARDROBE: 15 items available
[50 tokens]
```

---

### 9. Hedging Removal (V6)

**Purpose**: Strip wishy-washy language from final responses.

**Hedging Phrases Removed**:
- "You could try..."
- "It might work..."
- "Both options are..."
- "Depending on your preference..."
- "I would suggest..."

**Replaced With**:
- "Go with this."
- "This works."
- "This is the call."
- "Here's the pick."

---

### 10. Explanation Limits (V6)

**Purpose**: Prevent over-explanation with body-type theory.

**Limits**:
- `MAX_EXPLANATION_LINES = 3`
- `MAX_REASON_LINES = 2`
- No multi-paragraph rationales

---

### Legacy Features (V2/V3)

#### Canonical Memory
- Arbitrates user preferences from conversation
- Resolves conflicts (e.g., "I like fitted" vs "prefer loose")
- Single source of truth for styling decisions

#### Confidence Scoring
- Intent confidence (0-1)
- Memory confidence
- Wardrobe confidence
- Combined for behavior adaptation

#### Response Modes
- `visual_outfit`: Complete outfits with images
- `advisory_text`: Text-only styling advice
- `shopping_comparison`: Item comparisons

#### Output Contract
- `outfits_required`: Must return outfits
- `outfits_optional`: May include outfits
- `no_outfits`: Must NOT return outfits

#### Hard Rules (Deterministic)
- Mandatory slots validation
- Formality coherence
- Silhouette compatibility
- Climate sanity

#### Soft Rules (LLM)
- Color harmony
- Style consistency
- Occasion appropriateness

---

## Key Components

### 1. Intent Classifier (`utils/intentClassifier.ts`)

**Functions**:
- `getIntentFromKeywords()`: Fast keyword matching
- `classifyIntent()`: LLM-based classification (legacy)
- `classifyIntentV2()`: Multi-intent classification with confidence

**Models**: `gemini-2.5-flash-lite`

### 2. Execution Map (`utils/executionMap.ts`)

**Purpose**: Define which modules to run for each intent.

**Functions**:
- `getExecutionConfig()`: Get execution config for intent
- `getExecutionConfigV2()`: V2 config with response mode
- `logExecutionPlan()`: Log execution plan for debugging

### 3. Session Cache (`utils/sessionCache.ts`)

**Purpose**: In-memory cache for session-specific data.

**Key**: `userId:conversationId`

**Cached Data**:
- Fashion intelligence
- Color/silhouette/body analysis
- Rules engine output
- Canonical memory (V2)
- Last outfits

**Lifetime**: Session-only (no Redis, no persistence)

### 4. Memory Arbiter (`utils/memoryArbiter.ts`)

**Purpose**: Resolve conflicts in user preferences.

**Functions**:
- `arbitrateMemory()`: Main arbitration function
- `extractFitPreference()`: Extract fit preferences
- `resolveFitConflicts()`: Resolve conflicts
- `getClarifyingQuestion()`: Generate clarifying questions

### 5. Confidence Utilities (`utils/confidence.ts`)

**Purpose**: Confidence scoring and behavior adaptation.

**Functions**:
- `createConfidenceScore()`: Create confidence object
- `combineConfidences()`: Weighted combination
- `shouldAskClarification()`: Check if clarification needed
- `getConfidenceBehavior()`: Get behavior based on confidence

### 6. Wardrobe Coverage (`utils/wardrobeCoverage.ts`)

**Purpose**: Analyze wardrobe completeness.

**Functions**:
- `computeWardrobeCoverage()`: Calculate coverage profile
- `canCreateCompleteOutfits()`: Check completeness
- `formatCoverageForPrompt()`: Format for LLM prompts

### 7. Final Composer (`utils/finalComposer.ts`)

**Purpose**: Compose final stylist response.

**Functions**:
- `composeFinalResponse()`: Main composer (legacy)
- `composeFinalResponseV2()`: V2 composer with confidence
- `composeShoppingComparisonV2()`: Shopping comparison mode
- `generateSuggestionPills()`: Generate follow-up prompts
- **Engagement integration**: Uses `generateEngagement` to add next steps, wardrobe gap nudges (when appropriate), feature promotions, and replaces pills with engagement pills. Gap messages respect frequency rules to avoid spam.

**Model**: `gemini-2.0-flash`

### 8. Outfit Image Resolver (`utils/outfitImageResolver.ts`)

**Purpose**: Match LLM item hints to actual wardrobe items.

**Functions**:
- `resolveAllOutfitImages()`: Resolve images for all outfits
- `filterOutfitsWithImages()`: Filter to outfits with images

### 9. Safety Filter (`utils/safetyFilter.ts`)

**Purpose**: Ensure all suggestions are safe and appropriate.

**Function**: `applySafetyFilter()`

**Checks**:
- Item existence
- Inappropriate combinations
- Occasion appropriateness

### 10. Rules Engine (`rules/`)

**Components**:
- `hardRules.ts`: Deterministic hard rules
- `softRules.ts`: LLM soft rules
- `ruleEvaluator.ts`: Combined evaluation
- `types.ts`: Rule-related types

**Functions**:
- `evaluateOutfitHardRules()`: Evaluate hard rules
- `mergeSoftRules()`: Normalize LLM soft rules
- `evaluateOutfitCandidates()`: Combined evaluation

### 11. Engagement Engine (`utils/engagementEngine.ts`)

- **Purpose**: Drive user engagement, wardrobe completeness, and feature discovery.
- **Functions**:
  - `detectWardrobeGaps()`: Find missing essentials and suggest uploads.
  - `getFeaturePromotion()`: Contextual feature CTA (Style Check, Shopping, Upload, Travel prep).
  - `generateNextStep()`: Add compelling next-step lines to every reply.
  - `generateEngagementPills()`: Engagement-focused pills (show more options, tweak vibe, upload items).
  - `generateContinuationHook()`: Keep the conversation from dying out.

### 12. Stylist Decision Layer (`utils/stylistDecision.ts`) ← V6

- **Purpose**: Force decisive, non-hedging responses.
- **Functions**:
  - `makeStylistDecision()`: Main decision function - NEVER returns neutral.
  - `extractComparisonOptions()`: Parse "X or Y" patterns from messages.
  - `pickBestOption()`: Deterministic option selection based on preferences.
  - `getDecisivePhrase()`: Generate confident language.
  - `getRejectionPhrase()`: Phrase for rejected option.
- **Decision Types**:
  - `choose_one`: For shopping/comparison queries
  - `outfit_set`: For outfit generation
  - `no_outfit`: For advisory intents

### 13. Smart Clarification Detector (`utils/clarificationDetector.ts`) ← V4

- **Purpose**: Determine if clarification is truly needed.
- **Functions**:
  - `needsClarification()`: Main check - returns question and pills if needed.
  - `detectContextSignals()`: Find occasion, vibe, formality signals in message.
  - `hasContextInHistory()`: Check conversation history for context.
  - `hasFIEContext()`: Check if Fashion Intelligence has enough context.
  - `isAnsweringClarification()`: Detect if user is responding to our question.
  - `getComprehensivePromptInstruction()`: Instruction for comprehensive responses.
- **V4 Rules**:
  - Only ONE question per session
  - Only for required context (occasion, climate)
  - NEVER taste/preference questions

### 14. Wardrobe Request Detector (`utils/wardrobeRequestDetector.ts`) ← V5

- **Purpose**: Detect explicit wardrobe mentions to override conditional fetch.
- **Function**: `detectWardrobeRequest(message)`
- **Patterns**: "my wardrobe", "what I have", "from my closet", etc.

---

## Data Flow

### Request Flow (V6)

```
Frontend Request
    ↓
POST /api/chat
    ↓
Parse & Validate
    ↓
Build Conversation Memory
    ↓
LLM Intent Classification (ALWAYS)  ← V5
    ↓
Check requiresWardrobe
    ↓
┌──────────────────────────────────┐
│ Conditional Wardrobe Fetch (V5)  │
│ - Skip for advisory intents      │
│ - Fetch for outfit intents       │
└──────────────────────────────────┘
    ↓
Smart Clarification Check (V4)
    ↓
[If needs clarification] → Return question + pills
    ↓
Analysis Pipeline (cached when possible)
    ↓
Canonical Memory + Confidence
    ↓
┌──────────────────────────────────┐
│ Stylist Decision Layer (V6)      │  ← NEW
│ - Extract comparison options     │
│ - Make decisive call             │
│ - Set stylistMode                │
└──────────────────────────────────┘
    ↓
Specialized Module Routing
    ↓
┌──────────────────────────────────┐
│ Final Composer (V6)              │
│ - Inject canonical examples      │
│ - Compress inputs                │
│ - Remove hedging                 │
│ - Limit explanations             │
│ - Add engagement content         │
└──────────────────────────────────┘
    ↓
Safety Filter
    ↓
Image Resolution
    ↓
Response Assembly
    ↓
Return JSON Response
```

### Analysis Pipeline Flow

```
User Message + Wardrobe
    ↓
Fashion Intelligence Engine (FIE)
    ↓
Shared Context
    ↓
┌─────────────┬─────────────┬─────────────┐
│   Color     │ Silhouette  │  Body Type  │
│  Analysis   │  Analysis   │   Analysis   │
└─────────────┴─────────────┴─────────────┘
    ↓ (parallel)
Rules Engine
    ↓
Analysis Results
```

### Outfit Generation Flow (V2)

```
User Message + Context
    ↓
Generate 6-8 Outfit Drafts (LLM)
    ↓
Hard Rules Evaluation (Deterministic)
    ↓
Filter Blocking Violations
    ↓
Soft Rules Evaluation (LLM)
    ↓
Score & Rank Outfits
    ↓
Select Top 3-4 Outfits
    ↓
Convert to Outfit Format
    ↓
Image Resolution
    ↓
Visual Outfits
```

---

## Optimization Strategies

### 1. Intent-Based Execution Map

**Benefit**: Skip unnecessary modules based on intent.

**Example**: `general_chat` skips all analysis → saves ~3-5 seconds.

### 2. Session Caching

**Benefit**: Reuse analysis across conversation.

**Example**: Follow-up queries reuse cached analysis → saves ~2-4 seconds.

### 3. Parallel Processing

**Benefit**: Run non-dependent tasks simultaneously.

**Examples**:
- Intent + Memory + Wardrobe fetch (parallel)
- Color + Silhouette + Body analysis (parallel)

### 4. Merged LLM Calls

**Benefit**: Reduce total LLM calls.

**Merges**:
- Rules reasoning → Final composer (saves 1 call)
- Tone rewriting → Final composer (saves 1 call)

**Total Savings**: ~1.5-2.5 seconds per request.

### 5. Model Stratification

**Benefit**: Use faster model for lightweight tasks.

**Strategy**:
- `gemini-2.5-flash-lite`: Intent, FIE, analysis (fast, cheap)
- `gemini-2.0-flash`: Final responses, outfit generation (quality)

### 6. Keyword-Based Intent Classification

**Benefit**: Instant intent detection for common queries.

**Example**: "outfit" → instant `outfit_generation` (no LLM call).

### 7. Continuation Query Optimization

**Benefit**: Follow-ups complete in ~1-2 seconds.

**Process**:
- Reuse ALL cached analysis
- Only re-run outfit generation with variation instructions

---

## Response Modes

### Visual Outfit Mode

**When**: Outfit generation, event styling, travel packing

**Output**:
- Complete outfits with images
- Styling explanations
- Suggestion pills

**Example**:
```json
{
  "intent": "outfit_generation",
  "message": "Here are some fire looks for your date! 🔥",
  "outfits": [
    {
      "title": "Casual Date Night",
      "items": [
        { "name": "Black Tee", "image_url": "..." },
        { "name": "Jeans", "image_url": "..." },
        { "name": "Sneakers", "image_url": "..." }
      ],
      "why_it_works": "A relaxed yet put-together look..."
    }
  ]
}
```

### Advisory Text Mode

**When**: Color analysis, body type advice, trend analysis

**Output**:
- Text-only styling advice
- Tips and recommendations
- No outfits

**Example**:
```json
{
  "intent": "color_analysis",
  "message": "Your color palette is giving neutral vibes! Here's what works...",
  "extra_tips": [
    "Neutrals are your best friend",
    "Add pops of color with accessories"
  ]
}
```

### Shopping Comparison Mode

**When**: Shopping help, item recommendations

**Output**:
- Shopping recommendations
- Item comparisons
- Brand suggestions
- NO outfits (unless explicitly requested)

**Example**:
```json
{
  "intent": "shopping_help",
  "message": "Go with the hoodie! Here's why...",
  "items": ["Hoodie", "Jacket"],
  "brands": ["Nike", "Adidas"]
}
```

---

## Error Handling

### 1. Intent Classification Failure

**Fallback**: `general_chat`

**Process**:
- Log error
- Continue with general chat response
- Return helpful message

### 2. Wardrobe Fetch Failure

**Fallback**: Empty wardrobe

**Process**:
- Log error
- Continue with empty wardrobe context
- System adapts to limited wardrobe

### 3. Analysis Pipeline Failure

**Fallback**: Default analysis values

**Process**:
- Log error
- Use safe defaults (neutral colors, balanced silhouette)
- Continue with generation

### 4. Module Routing Failure

**Fallback**: Generic module output

**Process**:
- Log error
- Return generic helpful message
- Provide suggestion pills

### 5. Final Composer Failure

**Fallback**: Generic response

**Process**:
- Log error
- Return friendly message
- Include module output if available

### 6. Image Resolution Failure

**Fallback**: Outfits without images

**Process**:
- Log error
- Continue with text-only outfits
- Frontend handles missing images gracefully

---

## Performance Metrics

### Typical Latencies

| Intent | First Request | Follow-up (Cached) |
|--------|--------------|-------------------|
| `general_chat` | < 1s | < 1s |
| `outfit_generation` | 4-6s | 1-2s |
| `shopping_help` | 2-3s | 1-2s |
| `color_analysis` | 2-3s | 1-2s |
| `continuation_query` | 1-2s | 1-2s |

### LLM Call Counts

| Intent | Without Cache | With Cache |
|--------|--------------|------------|
| `general_chat` | 1 | 1 |
| `outfit_generation` | 5-6 | 2-3 |
| `shopping_help` | 3-4 | 1-2 |
| `continuation_query` | 1 | 1 |

### Cache Hit Rates

- **First Request**: 0% (no cache)
- **Follow-up Requests**: 80-90% (high cache hit rate)
- **Continuation Queries**: 100% (always cached)

---

## Testing

### Unit Tests

**Location**: `tests/`

**Test Files**:
- `hardRules.test.ts`: Test deterministic hard rules
- `responseMode.test.ts`: Test response mode detection

**Run Tests**:
```bash
npm test
npm run test:watch
```

### Test Coverage

- Hard rules evaluation
- Response mode inference
- Output contract enforcement
- Confidence scoring
- Memory arbitration

---

## Deployment

### Vercel Deployment

1. **Environment Variables**:
   - `GEMINI_API_KEY`: Google Gemini API key
   - `SUPABASE_URL`: Supabase project URL
   - `SUPABASE_ANON_KEY`: Supabase anonymous key

2. **Build Configuration**:
   - Next.js 14 (automatic)
   - TypeScript compilation
   - ESLint disabled during builds

3. **Deployment Steps**:
   - Push to GitHub
   - Connect Vercel to repository
   - Set environment variables
   - Deploy

### Local Development

```bash
cd mymirro-chat-api
npm install
npm run dev
```

Server runs on `http://localhost:3000`

---

## Future Enhancements

### Potential Improvements

1. **Real Streaming**: Implement SSE for streaming responses
2. **Persistent Cache**: Add Redis for cross-session caching
3. **Image Generation**: Generate outfit images using AI
4. **Multi-User Sessions**: Support multiple users in one session
5. **Advanced Analytics**: Track user preferences over time
6. **A/B Testing**: Test different response strategies
7. **Personalization Engine**: Learn from user feedback

---

---

## Migration Guide

This section provides guidance for migrating the MyMirro Chat API to AI orchestration frameworks like **Mastra**, **LangChain**, **Vercel AI SDK**, or similar agent-based architectures.

### Current Architecture vs Agent Architecture

| Current (Monolithic Route) | Agent Framework |
|---------------------------|-----------------|
| Single `route.ts` file | Multiple Agents/Tools |
| Imperative orchestration | Declarative workflows |
| Manual caching | Built-in memory systems |
| Inline LLM calls | Tool abstractions |
| Sequential steps | Graph-based execution |

---

### Component Mapping

#### 1. Intent Classifier → **Router Agent**

**Current**: `classifyIntent()` in `utils/intentClassifier.ts`

**Agent Framework**:
```typescript
// Mastra/LangChain Router Pattern
const intentRouter = createRouter({
  routes: [
    { name: "outfit", condition: (input) => isOutfitIntent(input) },
    { name: "shopping", condition: (input) => isShoppingIntent(input) },
    { name: "trends", condition: (input) => isTrendIntent(input) },
    // ...
  ],
  defaultRoute: "general_chat",
});
```

**Migration Notes**:
- Intent classification becomes a routing decision
- Can use LLM-based router or rule-based router
- Multi-intent → parallel agent execution

---

#### 2. Analysis Pipeline → **Analysis Agent**

**Current**: `runAnalysisPipeline()` in `analysis/index.ts`

**Agent Framework**:
```typescript
const analysisAgent = createAgent({
  name: "FashionAnalyzer",
  tools: [
    fashionIntelligenceTool,
    colorAnalysisTool,
    silhouetteAnalysisTool,
    bodyTypeAnalysisTool,
    rulesEngineTool,
  ],
  memory: sessionMemory, // Built-in caching
});
```

**Sub-Tools**:
| Current Function | Tool Name | Purpose |
|-----------------|-----------|---------|
| `extractFashionIntelligence()` | `fashion_intelligence` | Understand user style |
| `analyzeColors()` | `color_analysis` | Color recommendations |
| `analyzeSilhouette()` | `silhouette_analysis` | Proportion advice |
| `analyzeBodyType()` | `body_type_analysis` | Body-specific styling |
| `generateStylingRules()` | `rules_engine` | Styling rules |

---

#### 3. Specialized Modules → **Domain Agents**

**Current**: `modules/outfit.ts`, `modules/shopping.ts`, etc.

**Agent Framework**:
```typescript
// Outfit Agent
const outfitAgent = createAgent({
  name: "OutfitStylist",
  description: "Creates complete outfit suggestions",
  tools: [wardrobeTool, outfitGeneratorTool, rulesValidatorTool],
  instructions: `
    You are a decisive fashion stylist.
    Never hedge. Always pick one option.
    Explain briefly why it works.
  `,
});

// Shopping Agent
const shoppingAgent = createAgent({
  name: "ShoppingAdvisor",
  description: "Provides shopping recommendations",
  tools: [brandDatabaseTool, priceComparisonTool],
  instructions: `
    When comparing items, ALWAYS recommend one.
    Explain the trade-offs, then make the call.
  `,
});

// Trend Agent
const trendAgent = createAgent({
  name: "TrendExpert",
  description: "Analyzes fashion trends",
  tools: [trendDatabaseTool, seasonalAnalysisTool],
  instructions: `
    Advisory mode - no outfits.
    Focus on trend insights and how to style them.
  `,
});
```

---

#### 4. Stylist Decision Layer → **Decision Agent**

**Current**: `makeStylistDecision()` in `utils/stylistDecision.ts`

**Agent Framework**:
```typescript
const decisionAgent = createAgent({
  name: "StylistDecisionMaker",
  description: "Makes final decisive calls",
  tools: [
    comparisonExtractorTool,
    preferenceMatcherTool,
    decisionFormatterTool,
  ],
  instructions: `
    RULES:
    - If user asks "X or Y", you MUST pick one
    - Never say "both work" or "depends on preference"
    - Explain your choice in 1-2 sentences
    - Mention the rejected option as justification, not alternative
  `,
});
```

---

#### 5. Final Composer → **Output Agent**

**Current**: `composeFinalResponse()` in `utils/finalComposer.ts`

**Agent Framework**:
```typescript
const composerAgent = createAgent({
  name: "ResponseComposer",
  description: "Creates Gen-Z friendly responses",
  tools: [
    toneRewriterTool,
    hedgingRemoverTool,
    engagementGeneratorTool,
  ],
  instructions: `
    TONE: Gen-Z friendly, fun, supportive
    LENGTH: 2-3 sentences max
    STYLE: Use emojis sparingly (1-3)
    FORBIDDEN: "I recommend", "I suggest", hedging language
  `,
});
```

---

### Workflow Definition

**Current**: Imperative steps in `route.ts`

**Agent Framework** (Graph-based):
```typescript
const chatWorkflow = createWorkflow({
  name: "MyMirroChat",
  
  nodes: {
    classify: intentRouter,
    fetchWardrobe: wardrobeFetchTool,
    clarify: clarificationAgent,
    analyze: analysisAgent,
    decide: decisionAgent,
    route: {
      outfit: outfitAgent,
      shopping: shoppingAgent,
      trends: trendAgent,
      travel: travelAgent,
      general: generalChatAgent,
    },
    compose: composerAgent,
    postProcess: postProcessorAgent,
  },
  
  edges: [
    { from: "START", to: "classify" },
    { from: "classify", to: "fetchWardrobe", condition: "requiresWardrobe" },
    { from: "classify", to: "clarify", condition: "needsClarification" },
    { from: "clarify", to: "analyze" },
    { from: "fetchWardrobe", to: "analyze" },
    { from: "analyze", to: "decide" },
    { from: "decide", to: "route" },
    { from: "route.*", to: "compose" },
    { from: "compose", to: "postProcess" },
    { from: "postProcess", to: "END" },
  ],
});
```

---

### Memory & State Management

**Current**: `sessionCache` with manual key management

**Agent Framework**:
```typescript
// Memory configuration
const memory = createMemory({
  type: "session", // or "persistent" for cross-session
  
  // What to remember
  schema: {
    fashionIntelligence: FashionIntelligenceSchema,
    colorAnalysis: ColorAnalysisSchema,
    canonicalMemory: CanonicalMemorySchema,
    lastOutfits: OutfitArraySchema,
    hasAskedClarification: z.boolean(),
  },
  
  // TTL and eviction
  ttl: "1h",
  maxEntries: 1000,
});

// Attach to agents
analysisAgent.useMemory(memory);
composerAgent.useMemory(memory);
```

---

### Tool Definitions

Convert utility functions to tool format:

```typescript
// Example: Wardrobe Fetch Tool
const wardrobeTool = createTool({
  name: "fetch_wardrobe",
  description: "Fetches user's wardrobe items from database",
  parameters: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    const result = await fetchWardrobeAndProfile(userId);
    return {
      items: result.wardrobe_items,
      profile: result.profile,
      coverage: computeWardrobeCoverage(result.wardrobe_items),
    };
  },
});

// Example: Outfit Generator Tool
const outfitGeneratorTool = createTool({
  name: "generate_outfits",
  description: "Creates outfit suggestions from wardrobe",
  parameters: z.object({
    wardrobeItems: z.array(WardrobeItemSchema),
    context: FashionIntelligenceSchema,
    rules: RulesEngineOutputSchema,
    count: z.number().default(4),
  }),
  execute: async ({ wardrobeItems, context, rules, count }) => {
    return generateOutfitsV2(wardrobeItems, context, rules, count);
  },
});

// Example: Decision Tool
const decisionTool = createTool({
  name: "make_decision",
  description: "Makes decisive stylist choice between options",
  parameters: z.object({
    options: z.array(z.string()),
    canonicalMemory: CanonicalMemorySchema.optional(),
    userMessage: z.string(),
  }),
  execute: async ({ options, canonicalMemory, userMessage }) => {
    return makeStylistDecision({
      intent: "shopping_help",
      options,
      canonicalMemory,
      userMessage,
    });
  },
});
```

---

### Migration Steps

#### Phase 1: Extract Tools (Week 1-2)
1. Convert each utility function to standalone tool
2. Add proper TypeScript schemas for inputs/outputs
3. Write unit tests for each tool
4. Ensure tools are framework-agnostic

#### Phase 2: Define Agents (Week 2-3)
1. Create agent configurations for each domain
2. Write agent instructions (system prompts)
3. Assign tools to appropriate agents
4. Test agents in isolation

#### Phase 3: Build Workflow (Week 3-4)
1. Define workflow graph
2. Implement routing logic
3. Connect agents with edges
4. Add conditional paths

#### Phase 4: Memory Integration (Week 4-5)
1. Migrate session cache to framework memory
2. Define memory schemas
3. Test memory persistence
4. Implement memory retrieval in agents

#### Phase 5: Testing & Rollout (Week 5-6)
1. Integration testing with full workflow
2. A/B testing against current implementation
3. Performance benchmarking
4. Gradual rollout

---

### Framework-Specific Notes

#### Mastra
- Uses TypeScript-first approach
- Built-in memory and tool abstractions
- Graph-based workflow definition
- Good for complex multi-agent scenarios

#### LangChain/LangGraph
- Mature ecosystem with many integrations
- LangGraph for stateful workflows
- Large community and documentation
- Python-first but TypeScript support exists

#### Vercel AI SDK
- Native Next.js integration
- Streaming-first design
- Simple tool calling
- Best for simpler use cases

#### CrewAI
- Multi-agent collaboration focus
- Role-based agent definitions
- Task delegation patterns
- Python-only currently

---

### Key Considerations

1. **Latency**: Agent frameworks add overhead. Optimize tool execution and caching.

2. **Debugging**: Graph-based workflows are harder to debug. Use observability tools.

3. **Testing**: Test agents and tools independently before integration.

4. **Prompts**: Agent instructions are critical. Migrate and tune system prompts carefully.

5. **Memory**: Ensure memory schemas match current data structures.

6. **Rollback**: Keep current implementation running for fallback during migration.

---

## Conclusion

The MyMirro Chat API is a sophisticated AI fashion stylist that combines multiple analysis modules, intelligent caching, and confidence-aware behavior to provide personalized styling recommendations. 

**V6 Architecture Highlights**:
- LLM-only intent classification for accuracy
- Conditional wardrobe fetching for efficiency
- Stylist Decision Layer for decisive responses
- Smart clarification (never repeat questions)
- Engagement engine for user retention
- Canonical decision examples for consistent tone
- Compressed inputs for clarity
- Hedging removal for authority

The system is optimized for latency through intent-based execution, session caching, parallel processing, and merged LLM calls, resulting in fast response times while maintaining high-quality, personalized recommendations.

The migration guide provides a roadmap for transitioning to modern AI orchestration frameworks while preserving the core functionality and optimizations.

