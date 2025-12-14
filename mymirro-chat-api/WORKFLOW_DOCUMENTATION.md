# MyMirro Chat API - Complete Workflow Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Request Flow](#request-flow)
4. [Detailed Step-by-Step Workflow](#detailed-step-by-step-workflow)
5. [V2 Features](#v2-features)
6. [Key Components](#key-components)
7. [Data Flow](#data-flow)
8. [Optimization Strategies](#optimization-strategies)
9. [Response Modes](#response-modes)
10. [Error Handling](#error-handling)

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

### High-Level Architecture

```
┌─────────────┐
│   Frontend  │ (React/Next.js UI)
│  (page.tsx) │
└──────┬──────┘
       │ POST /api/chat
       ▼
┌─────────────────────────────────────────────────────────┐
│              API Route Handler                           │
│            (app/api/chat/route.ts)                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 1: Parallel Init                           │  │
│  │  - Intent Classification                         │  │
│  │  - Memory Building                               │  │
│  │  - Wardrobe Fetch                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 2: Execution Map                           │  │
│  │  - Determine which modules to run                │  │
│  │  - Check cache availability                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 3: Analysis Pipeline                      │  │
│  │  - Fashion Intelligence Engine (FIE)             │  │
│  │  - Color Analysis                                │  │
│  │  - Silhouette Analysis                           │  │
│  │  - Body Type Analysis                            │  │
│  │  - Rules Engine                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 4: V2 Features                              │  │
│  │  - Canonical Memory Arbitration                  │  │
│  │  - Confidence Scoring                            │  │
│  │  - Wardrobe Coverage Profile                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 5: Specialized Module Routing              │  │
│  │  - Outfit Generation                             │  │
│  │  - Shopping Help                                 │  │
│  │  - Travel Packing                                │  │
│  │  - Trend Analysis                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 6: Final Composition                       │  │
│  │  - Merge rules + tone rewriting                  │  │
│  │  - Gen-Z friendly response                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  STEP 7: Post-Processing                        │  │
│  │  - Safety Filtering                              │  │
│  │  - Image Resolution                              │  │
│  │  - Response Formatting                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
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

### STEP 1: Parallel Initialization

**Location**: `app/api/chat/route.ts` (lines 140-168)

**Purpose**: Run non-dependent tasks in parallel to minimize latency.

#### 1.1 Quick Intent Classification
- **Function**: `getIntentFromKeywords()` from `utils/intentClassifier.ts`
- **Purpose**: Fast keyword-based intent detection (no LLM call)
- **Returns**: `IntentType | null`
- **Examples**: 
  - "outfit" → `outfit_generation`
  - "buy" or "shop" → `shopping_help`
  - "pack" or "travel" → `travel_packing`

#### 1.2 Memory Building
- **Function**: `buildConversationMemory()` from `utils/memory.ts`
- **Purpose**: Extract conversation context from history
- **Extracts**:
  - Recent user/assistant messages
  - User tone (casual, professional, etc.)
  - User preferences
  - Frequent aesthetics
  - Last outfit suggestions

#### 1.3 Wardrobe Fetch
- **Function**: `fetchWardrobeAndProfile()` from `utils/supabaseClient.ts`
- **Purpose**: Fetch user's wardrobe items and profile from Supabase
- **Returns**: `WardrobeContext` with:
  - `wardrobe_items`: Array of `WardrobeItem`
  - `body_type`, `gender`, `style_keywords` from profile

#### 1.4 LLM Intent Classification (if needed)
- **Function**: `classifyIntent()` or `classifyIntentV2()` from `utils/intentClassifier.ts`
- **Purpose**: Use LLM if keyword matching fails
- **Model**: `gemini-2.5-flash-lite`
- **V2**: Returns `MultiIntentResult` with:
  - `primary_intent`: Main intent
  - `secondary_intents`: Additional relevant intents
  - `intent_confidence`: Confidence score

**Parallel Execution**: All three tasks run simultaneously using `Promise.allSettled()`.

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

## V2 Features

### 1. Canonical Memory

**Purpose**: Single source of truth for user preferences.

**Key Functions**:
- `arbitrateMemory()`: Resolves conflicts
- `extractFitPreference()`: Extracts fit preferences
- `extractVibes()`: Extracts style vibes
- `resolveFitConflicts()`: Resolves conflicting preferences

**Benefits**:
- Consistent recommendations across conversation
- Conflict detection and clarification
- Confidence scoring for memory reliability

### 2. Confidence Scoring

**Purpose**: Quantify system certainty at each stage.

**Key Functions**:
- `createConfidenceScore()`: Create confidence object
- `calculateIntentConfidence()`: Intent classification confidence
- `calculateWardrobeConfidence()`: Wardrobe coverage confidence
- `combineConfidences()`: Weighted combination

**Confidence Levels**:
- **Low (< 0.5)**: Ask clarifying questions
- **Medium (0.5-0.7)**: Use hedging phrases
- **High (> 0.7)**: Be decisive

### 3. Response Modes

**Purpose**: Control output type based on intent.

**Modes**:
- `visual_outfit`: Show complete outfits with images
- `advisory_text`: Text-only styling advice
- `shopping_comparison`: Shopping recommendations with comparisons
- `mixed`: Combination of outfits and text

**Enforcement**:
- Shopping queries default to `shopping_comparison` (no outfits unless explicitly requested)
- Outfit generation defaults to `visual_outfit`
- Trend/color analysis defaults to `advisory_text`

### 4. Output Contract

**Purpose**: Define whether outfits are required, optional, or forbidden.

**Contracts**:
- `outfits_required`: Must return outfits (outfit generation, event styling)
- `outfits_optional`: Outfits allowed but not required
- `no_outfits`: Must NOT return outfits (shopping help, trend analysis)

### 5. Deterministic Hard Rules

**Purpose**: Code-owned, strict outfit validation.

**Location**: `rules/hardRules.ts`

**Rules**:
- Mandatory slots (upper, lower, footwear)
- Formality coherence
- Silhouette compatibility
- Ethnic coherence
- Climate sanity
- No duplicate slots

**Evaluation**: `evaluateOutfitHardRules()` returns blocking violations and warnings.

### 6. LLM Soft Rules

**Purpose**: Flexible, context-aware styling guidelines.

**Location**: `rules/softRules.ts`

**Rules**:
- Color harmony
- Style consistency
- Occasion appropriateness
- Personal preference alignment

**Evaluation**: `evaluateOutfitCandidates()` scores outfits based on soft rules.

### 7. Wardrobe Coverage Profile

**Purpose**: Assess wardrobe completeness and image availability.

**Key Functions**:
- `computeWardrobeCoverage()`: Calculate coverage per category
- `canCreateCompleteOutfits()`: Check if mandatory slots are available
- `getWardrobeConfidenceScore()`: Calculate confidence based on coverage

**Output**: `WardrobeCoverageProfile` with:
- Item counts per category
- Image availability
- Missing mandatory slots
- Coverage level (none, low, medium, high)

### 8. Multi-Intent Handling

**Purpose**: Support queries with multiple intents.

**Example**: "Should I buy a jacket or hoodie for my date outfit?"
- Primary: `shopping_help`
- Secondary: `outfit_generation`

**Function**: `classifyIntentV2()` returns `MultiIntentResult` with primary and secondary intents.

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

---

## Data Flow

### Request Flow

```
Frontend Request
    ↓
POST /api/chat
    ↓
Parse & Validate
    ↓
Parallel Init (Intent, Memory, Wardrobe)
    ↓
Execution Map
    ↓
Analysis Pipeline (FIE, Color, Silhouette, Body, Rules)
    ↓
V2: Canonical Memory + Confidence
    ↓
Specialized Module (Outfit, Shopping, Travel, etc.)
    ↓
Final Composer (with merged rules + tone)
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

## Conclusion

The MyMirro Chat API is a sophisticated AI fashion stylist that combines multiple analysis modules, intelligent caching, and confidence-aware behavior to provide personalized styling recommendations. The V2 architecture adds canonical memory, confidence scoring, and deterministic rules to ensure consistent, reliable, and context-aware responses.

The system is optimized for latency through intent-based execution, session caching, parallel processing, and merged LLM calls, resulting in fast response times while maintaining high-quality, personalized recommendations.

