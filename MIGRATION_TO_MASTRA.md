# Complete Chat Langflow Functionality & Mastra Migration Guide

## 📋 Table of Contents
1. [Complete System Architecture](#complete-system-architecture)
2. [Detailed Flow Explanation](#detailed-flow-explanation)
3. [Mastra Migration Strategy](#mastra-migration-strategy)
4. [Step-by-Step Migration Plan](#step-by-step-migration-plan)

---

## 🏗️ Complete System Architecture

### Current Stack
- **Framework**: Next.js 14 (App Router)
- **LLM Provider**: Google Gemini (2.5 Flash Lite & 2.0 Flash)
- **Database**: Supabase (wardrobe items, user profiles)
- **Caching**: In-memory session cache (30min TTL)
- **API Route**: `/app/api/chat/route.ts` (POST handler)

### Core Components

#### 1. **Request Handler** (`app/api/chat/route.ts`)
- Main orchestrator for the entire workflow
- Handles request validation, logging, error handling
- Coordinates all modules in sequence

#### 2. **Intent Classification** (`utils/intentClassifier.ts`)
- **Purpose**: Determines user intent (12 possible intents)
- **Methods**:
  - `getIntentFromKeywords()`: Fast keyword-based classification (no API call)
  - `classifyIntent()`: LLM-based classification (Gemini Lite)
- **Intents**: outfit_generation, item_recommendation, category_recommendation, shopping_help, trend_analysis, travel_packing, color_analysis, body_type_advice, event_styling, wardrobe_query, continuation_query, general_chat

#### 3. **Analysis Pipeline** (`analysis/`)
- **Fashion Intelligence Engine (FIE)** (`intelligence.ts`):
  - Extracts: vibe, aesthetic, fit_preference, color_direction, occasion, mood, gender_context
  - Uses Gemini Lite
  - Input: user message, wardrobe summary, gender
  - Output: `FashionIntelligence` object
  
- **Color Analysis** (`color.ts`):
  - Analyzes color palette, combos, avoid colors
  - Runs in parallel with silhouette & body analysis
  - Uses Gemini Lite
  
- **Silhouette Analysis** (`silhouette.ts`):
  - Analyzes proportions, structures, layering
  - Runs in parallel with color & body analysis
  - Uses Gemini Lite
  
- **Body Type Analysis** (`body.ts`):
  - Analyzes body type, flattering styles, highlight areas
  - Runs in parallel with color & silhouette analysis
  - Uses Gemini Lite
  
- **Rules Engine** (`rules.ts`):
  - Merges all analyses into actionable styling rules
  - Generates: valid_pairs, avoid_pairs, strong_outfit_bases, core_directions
  - Uses Gemini Lite (now merged into final composer for optimization)

#### 4. **Specialized Modules** (`modules/`)
- **Outfit Generation** (`outfit.ts`): Creates complete outfit suggestions
- **Item Recommendation** (`items.ts`): Suggests specific items
- **Category Recommendation** (`category.ts`): Recommends by category
- **Shopping Help** (`shopping.ts`): Brand and shopping advice
- **Travel Packing** (`travel.ts`): Packing lists and travel outfits
- **Trend Analysis** (`trends.ts`): Current fashion trends

#### 5. **Utilities**
- **Session Cache** (`utils/sessionCache.ts`): In-memory cache (30min TTL, 1000 max entries)
- **Execution Map** (`utils/executionMap.ts`): Intent-based execution optimization
- **Memory Builder** (`utils/memory.ts`): Conversation context management
- **Safety Filter** (`utils/safetyFilter.ts`): Validates outfits against wardrobe
- **Image Resolver** (`utils/outfitImageResolver.ts`): Matches outfit hints to real wardrobe images
- **Final Composer** (`utils/finalComposer.ts`): Merges everything into final response with Gen-Z tone
- **Gemini Client** (`utils/geminiClient.ts`): LLM API wrapper with retries, timeouts, model stratification

---

## 🔄 Detailed Flow Explanation

### **Step 0: Request Parsing & Validation**
```typescript
Input: { userId, message, conversationId?, history? }
- Validates required fields
- Generates conversationId if missing
- Creates log entry for tracking
- Generates session key: userId:conversationId
```

### **Step 1: Parallel Initialization** ⚡
**Purpose**: Run non-dependent work in parallel for speed

**Parallel Operations**:
1. **Intent Classification**:
   - First tries keyword matching (instant, no API call)
   - Falls back to LLM classification if needed (Gemini Lite)
   - Checks for continuation queries from memory

2. **Wardrobe Fetch**:
   - Fetches wardrobe items from Supabase
   - Fetches user profile (body_type, gender, style_keywords)
   - Uses service role key to bypass RLS

3. **Memory Building**:
   - Extracts recent messages from history
   - Detects user tone (very_casual_genz, casual_friendly, etc.)
   - Identifies user preferences and frequent aesthetics
   - Checks for continuation query patterns

**Result**: `[intent, wardrobeContext, memory]` all available simultaneously

### **Step 2: Intent Extraction**
- Extracts intent from parallel result
- Falls back to `general_chat` if classification fails
- Logs intent for debugging

### **Step 3: Wardrobe Context Extraction**
- Extracts wardrobe items and user profile
- Falls back to empty wardrobe if fetch fails
- Formats wardrobe summary for LLM consumption

### **Step 4: Execution Config** 📋
**Purpose**: Determine which modules to run (latency optimization)

**Execution Map** (`utils/executionMap.ts`):
- Each intent has a config: `{ runFIE, runAnalysis, runRules, canUseCache, requiresWardrobe, moduleModel }`
- Examples:
  - `outfit_generation`: Full pipeline (FIE + Analysis + Rules)
  - `shopping_help`: FIE only (no analysis, no rules)
  - `trend_analysis`: No analysis needed
  - `continuation_query`: Reuse all cached analysis

**Result**: Know exactly what to run/skip

### **Step 5: General Chat Shortcut** 💬
**If intent === "general_chat"**:
- Skip all analysis
- Directly compose Gen-Z friendly response
- Return immediately (fastest path)

### **Step 6: Analysis Pipeline** 🔬
**Purpose**: Extract fashion intelligence from user input and wardrobe

**Conditional Execution** (based on execution config):

**A. Check Cache**:
- If `continuation_query` and cache exists → Reuse ALL cached analysis
- If cache exists and `canUseCache` → Reuse specific cached modules
- Otherwise → Run fresh analysis

**B. Fashion Intelligence Engine (FIE)**:
- **If `runFIE === true`**:
  - Extract: vibe, aesthetic, fit_preference, color_direction, occasion, mood
  - Derive `gender_context` from user gender + wardrobe
  - Uses Gemini Lite
  - **Output**: `FashionIntelligence` object
  
- **If `runFIE === false`**:
  - Use cached FIE or defaults

**C. Parallel Analysis** (Color, Silhouette, Body):
- **If `runAnalysis === true`**:
  - Run all 3 in parallel using `Promise.allSettled`
  - Each uses Gemini Lite
  - **Outputs**: `ColorAnalysis`, `SilhouetteAnalysis`, `BodyTypeAnalysis`
  
- **If `runAnalysis === false`**:
  - Use cached analyses or defaults

**D. Rules Engine**:
- **If `runRules === true`**:
  - Merge all analyses into actionable rules
  - Uses Gemini Lite
  - **Output**: `RulesEngineOutput`
  
- **If `runRules === false`**:
  - Use cached rules or create quick rules (no LLM call)

**E. Update Cache**:
- Store all analysis results in session cache
- Cache lives for 30 minutes
- Key: `userId:conversationId`

**Result**: Complete analysis context ready for specialized modules

### **Step 7: Special Intent Handlers** 🎨
**If intent === "color_analysis"**:
- Compose color-specific response
- Use cached color analysis
- Return immediately

**If intent === "body_type_advice"**:
- Compose body type-specific response
- Use cached body type analysis
- Return immediately

### **Step 8: Specialized Module Routing** 📦
**Purpose**: Generate intent-specific output (outfits, items, brands, etc.)

**Router** (`modules/index.ts`):
- Routes to appropriate module based on intent
- Each module receives:
  - User message
  - Wardrobe context
  - Rules engine output
  - Fashion intelligence
  - Memory (for continuation queries)

**Module Examples**:
- `outfit_generation` → `generateOutfits()` → Returns `Outfit[]`
- `shopping_help` → `provideShoppingHelp()` → Returns brands, aesthetics, tips
- `travel_packing` → `createTravelPacking()` → Returns packing list + outfits
- `continuation_query` → `generateMoreOutfits()` → Returns new outfit variations

**Model**: Uses `gemini-2.0-flash` for specialized modules (higher quality)

**Result**: Module-specific output (outfits, items, brands, etc.)

### **Step 9: Final Response Composition** ✍️
**Purpose**: Merge module output into user-facing response with Gen-Z tone

**Composer** (`utils/finalComposer.ts`):
- **OPTIMIZED**: Rules reasoning + tone rewriting merged into single LLM call
- Receives:
  - Module output
  - Rules engine output
  - All analyses (color, silhouette, body, FIE)
  - Memory (for tone matching)
  
- **Process**:
  1. Build comprehensive context from all inputs
  2. Single LLM call (Gemini Flash) to:
     - Generate internal reasoning
     - Compose final message
     - Apply Gen-Z tone (based on user's detected tone)
     - Generate suggestion pills
  3. Extract structured output: `FinalStylistOutput`

**Tone Matching**:
- Detects user tone from conversation history
- Matches response tone to user's style
- Gen-Z friendly by default (casual, warm, genuine)

**Result**: Polished, tone-matched response with outfits/items/brands

### **Step 10: Safety Filter** 🛡️
**Purpose**: Ensure all suggested items exist in wardrobe

**Filter** (`utils/safetyFilter.ts`):
- Validates outfits against actual wardrobe items
- Removes hallucinated items
- Ensures all suggestions are real wardrobe pieces
- Uses fuzzy matching for item names

**Result**: Only valid, wardrobe-backed suggestions

### **Step 11: Image Resolution** 🖼️
**Purpose**: Match outfit item hints to real wardrobe images

**Resolver** (`utils/outfitImageResolver.ts`):
- Takes outfit hints (text descriptions)
- Matches to actual wardrobe items using:
  - Name similarity
  - Category matching
  - Color matching
  - Item type matching
- Attaches `processed_image_url` or `image_url`
- Determines layout (1x1, 2x1, 3x1, 2x2) based on item count
- Assigns layers (top, bottom, outer, shoes, accessory)

**Result**: `VisualOutfit[]` with real images and layout

### **Step 12: Final Response Building** 📤
**Purpose**: Assemble complete response object

**Response Structure**:
```typescript
{
  intent: IntentType,
  message: string, // Gen-Z friendly, tone-matched
  outfits?: VisualOutfit[], // With images and layout
  items?: string[],
  brands?: string[],
  packing_list?: string[],
  trend_summary?: string,
  extra_tips?: string[],
  suggestion_pills?: string[], // Contextual follow-up prompts
  debug?: DebugInfo // Only in development
}
```

**Debug Info** (development only):
- All analysis outputs
- Module output
- Memory state
- Timing metrics
- Cache hit/miss info
- Optimization metrics

### **Step 13: Logging & Return** 📊
- Logs complete request lifecycle
- Records stage timings
- Tracks cache hits/misses
- Records errors and fallbacks
- Returns JSON response

---

## 🚀 Mastra Migration Strategy

### **Why Migrate to Mastra?**

**Current System Strengths**:
- ✅ Well-optimized (caching, parallelization, model stratification)
- ✅ Comprehensive analysis pipeline
- ✅ Good error handling and fallbacks
- ✅ Type-safe with TypeScript

**Mastra Benefits**:
- ✅ **Agents**: Natural fit for multi-step styling workflow
- ✅ **Workflows**: Graph-based orchestration (better than manual sequencing)
- ✅ **Context Management**: Built-in conversation memory and RAG
- ✅ **Model Routing**: Unified interface for multiple LLM providers
- ✅ **Observability**: Built-in evals and monitoring
- ✅ **Human-in-the-Loop**: Suspend/resume for user approval
- ✅ **MCP Integration**: Expose agents as MCP servers
- ✅ **Production-Ready**: Built-in scaling, error handling, retries

### **Migration Principles**

1. **Preserve All Functionality**: Every feature must work identically or better
2. **Maintain Performance**: Latency optimizations must be preserved
3. **Incremental Migration**: Migrate module by module, test at each step
4. **Backward Compatibility**: Keep API contract identical during transition
5. **Zero Downtime**: Deploy alongside existing system, switch gradually

---

## 📝 Step-by-Step Migration Plan

### **Phase 1: Setup & Foundation** (Week 1)

#### 1.1 Install Mastra
```bash
npm install @mastra/core @mastra/ai
```

#### 1.2 Create Mastra Instance
- Initialize Mastra with Gemini provider
- Configure model routing (Lite vs Flash)
- Set up observability/evals

#### 1.3 Create Type Adapters
- Map existing types to Mastra-compatible types
- Create adapters for `ChatRequest` → Mastra input
- Create adapters for Mastra output → `ChatResponse`

#### 1.4 Parallel System Setup
- Keep existing route handler
- Create new Mastra-based route handler (`/api/chat-mastra`)
- Test both routes side-by-side

**Deliverable**: Mastra instance running, types adapted, parallel routes

---

### **Phase 2: Intent Classification → Mastra Agent** (Week 1-2)

#### 2.1 Create Intent Agent
- Convert `classifyIntent()` to Mastra agent
- Use Mastra's model routing (Gemini Lite)
- Preserve keyword fallback logic
- Add Mastra observability

#### 2.2 Test Intent Agent
- Compare outputs with existing classifier
- Ensure 100% accuracy match
- Measure latency (should be same or better)

#### 2.3 Integrate Intent Agent
- Replace `classifyIntent()` call with Mastra agent
- Keep keyword fallback in route handler
- Deploy and monitor

**Deliverable**: Intent classification using Mastra agent

---

### **Phase 3: Analysis Pipeline → Mastra Workflow** (Week 2-3)

#### 3.1 Create Analysis Workflow
- Convert analysis pipeline to Mastra workflow
- Use `.parallel()` for Color/Silhouette/Body analysis
- Use `.then()` for sequential steps (FIE → Analysis → Rules)
- Preserve caching logic (check cache before each step)

#### 3.2 Create Analysis Agents
- **FIE Agent**: `extractFashionIntelligence()` → Mastra agent
- **Color Agent**: `analyzeColors()` → Mastra agent
- **Silhouette Agent**: `analyzeSilhouette()` → Mastra agent
- **Body Agent**: `analyzeBodyType()` → Mastra agent
- **Rules Agent**: `generateStylingRules()` → Mastra agent

#### 3.3 Workflow Structure
```typescript
analysisWorkflow
  .then(() => checkCache('fie'))
  .then((cached) => cached ? useCache() : runFIEAgent())
  .then(() => checkCache('analysis'))
  .parallel([
    () => checkCache('color') ? useCache() : runColorAgent(),
    () => checkCache('silhouette') ? useCache() : runSilhouetteAgent(),
    () => checkCache('body') ? useCache() : runBodyAgent(),
  ])
  .then(() => checkCache('rules') ? useCache() : runRulesAgent())
  .then(() => updateCache())
```

#### 3.4 Test Analysis Workflow
- Compare outputs with existing pipeline
- Verify cache behavior
- Measure latency (should match or improve)

**Deliverable**: Analysis pipeline as Mastra workflow

---

### **Phase 4: Specialized Modules → Mastra Agents** (Week 3-4)

#### 4.1 Convert Each Module
- **Outfit Agent**: `generateOutfits()` → Mastra agent
- **Item Agent**: `recommendItems()` → Mastra agent
- **Category Agent**: `recommendByCategory()` → Mastra agent
- **Shopping Agent**: `provideShoppingHelp()` → Mastra agent
- **Travel Agent**: `createTravelPacking()` → Mastra agent
- **Trend Agent**: `analyzeTrends()` → Mastra agent

#### 4.2 Module Routing
- Keep existing router logic
- Each module becomes a Mastra agent
- Use Mastra's model routing (Flash for specialized modules)

#### 4.3 Test Each Module
- Compare outputs with existing modules
- Ensure identical functionality
- Measure latency

**Deliverable**: All specialized modules as Mastra agents

---

### **Phase 5: Final Composer → Mastra Agent** (Week 4)

#### 5.1 Create Composer Agent
- Convert `composeFinalResponse()` to Mastra agent
- Preserve Gen-Z tone matching
- Preserve suggestion pills generation
- Use Mastra's context management for memory

#### 5.2 Test Composer
- Compare outputs with existing composer
- Verify tone matching
- Verify suggestion pills

**Deliverable**: Final composer as Mastra agent

---

### **Phase 6: Main Orchestration → Mastra Workflow** (Week 5)

#### 6.1 Create Main Workflow
- Convert entire route handler to Mastra workflow
- Use `.parallel()` for Step 1 (Intent + Wardrobe + Memory)
- Use `.branch()` for intent-based routing
- Use `.then()` for sequential steps

#### 6.2 Workflow Structure
```typescript
mainWorkflow
  .then(() => validateRequest())
  .parallel([
    () => classifyIntent(), // Mastra agent
    () => fetchWardrobe(), // Keep existing (Supabase)
    () => buildMemory(), // Keep existing
  ])
  .then(([intent, wardrobe, memory]) => {
    if (intent === 'general_chat') {
      return composeGeneralChat(); // Mastra agent
    }
    return getExecutionConfig(intent);
  })
  .then((config) => {
    if (config.runFIE || config.runAnalysis || config.runRules) {
      return analysisWorkflow.run(config); // Mastra workflow
    }
    return skipAnalysis();
  })
  .then((analysis) => {
    if (intent === 'color_analysis') {
      return composeColorResponse(); // Mastra agent
    }
    return routeToModule(intent); // Mastra agents
  })
  .then((moduleOutput) => {
    return composeFinalResponse(); // Mastra agent
  })
  .then((response) => {
    return applySafetyFilter(); // Keep existing
  })
  .then((filtered) => {
    return resolveImages(); // Keep existing
  })
  .then((final) => {
    return formatResponse(); // Keep existing
  })
```

#### 6.3 Integrate Non-LLM Steps
- Keep Supabase client (wardrobe fetch)
- Keep session cache (or migrate to Mastra storage)
- Keep safety filter (pure logic, no LLM)
- Keep image resolver (pure logic, no LLM)

#### 6.4 Test Complete Workflow
- End-to-end testing
- Compare with existing system
- Performance benchmarking
- Error handling verification

**Deliverable**: Complete Mastra-based workflow

---

### **Phase 7: Context Management & Memory** (Week 5-6)

#### 7.1 Migrate Memory to Mastra
- Use Mastra's conversation memory
- Preserve user tone detection
- Preserve preference tracking
- Use Mastra's RAG for wardrobe context

#### 7.2 Session Cache
- Option A: Keep existing in-memory cache
- Option B: Migrate to Mastra storage (if available)
- Option C: Use Mastra's built-in caching

**Deliverable**: Memory management using Mastra

---

### **Phase 8: Observability & Monitoring** (Week 6)

#### 8.1 Add Mastra Observability
- Replace custom logger with Mastra observability
- Add evals for each agent
- Set up monitoring dashboards
- Track cache hit rates, latency, errors

#### 8.2 Compare Metrics
- Compare Mastra metrics with existing logs
- Ensure no degradation in observability

**Deliverable**: Full observability with Mastra

---

### **Phase 9: Testing & Validation** (Week 7)

#### 9.1 Unit Tests
- Test each Mastra agent individually
- Test workflows in isolation
- Compare outputs with existing system

#### 9.2 Integration Tests
- Test complete workflow end-to-end
- Test all intent paths
- Test error scenarios

#### 9.3 Performance Tests
- Benchmark latency (should match or improve)
- Benchmark cache hit rates
- Benchmark error rates

#### 9.4 User Acceptance Tests
- Test with real user queries
- Compare responses side-by-side
- Ensure identical or better quality

**Deliverable**: Fully tested Mastra system

---

### **Phase 10: Gradual Rollout** (Week 8)

#### 10.1 Feature Flag
- Add feature flag: `USE_MASTRA`
- Route 10% of traffic to Mastra
- Monitor metrics closely

#### 10.2 Gradual Increase
- Increase to 25% → 50% → 75% → 100%
- Monitor at each step
- Rollback if issues detected

#### 10.3 Final Switch
- Once 100% on Mastra, remove old route handler
- Clean up old code
- Update documentation

**Deliverable**: Fully migrated to Mastra

---

## 🔧 Key Migration Considerations

### **1. Model Routing**
- **Current**: Manual model selection in `geminiClient.ts`
- **Mastra**: Use Mastra's model routing
- **Action**: Configure Mastra with model stratification (Lite vs Flash)

### **2. Caching**
- **Current**: In-memory session cache
- **Mastra**: Use Mastra storage or keep existing cache
- **Action**: Evaluate Mastra storage vs current cache

### **3. Error Handling**
- **Current**: Custom error handling with fallbacks
- **Mastra**: Use Mastra's error handling + custom fallbacks
- **Action**: Preserve all fallback logic

### **4. Type Safety**
- **Current**: Full TypeScript types
- **Mastra**: Ensure Mastra agents are fully typed
- **Action**: Create type adapters if needed

### **5. Performance**
- **Current**: Optimized with caching, parallelization, model stratification
- **Mastra**: Preserve all optimizations
- **Action**: Use Mastra's `.parallel()` and caching features

### **6. API Contract**
- **Current**: `ChatRequest` → `ChatResponse`
- **Mastra**: Keep exact same contract
- **Action**: Use adapters to maintain compatibility

---

## 📊 Success Metrics

### **Functionality**
- ✅ 100% feature parity with existing system
- ✅ All intents work identically
- ✅ All analysis outputs match
- ✅ All module outputs match

### **Performance**
- ✅ Latency: Same or better (< 3s for heavy intents)
- ✅ Cache hit rate: Same or better (> 60% for follow-ups)
- ✅ Error rate: Same or lower (< 1%)

### **Quality**
- ✅ Response quality: Same or better
- ✅ Tone matching: Same or better
- ✅ Suggestion pills: Same or better

### **Observability**
- ✅ Full visibility into all agents/workflows
- ✅ Eval metrics for each agent
- ✅ Performance dashboards

---

## 🚨 Risks & Mitigations

### **Risk 1: Latency Increase**
- **Mitigation**: Use Mastra's parallelization, preserve caching, benchmark at each step

### **Risk 2: Functionality Loss**
- **Mitigation**: Comprehensive testing, side-by-side comparison, gradual rollout

### **Risk 3: Type Safety Loss**
- **Mitigation**: Full TypeScript types, type adapters, compile-time checks

### **Risk 4: Breaking Changes**
- **Mitigation**: Keep API contract identical, use adapters, feature flags

---

## 📚 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Mastra Agents Guide](https://mastra.ai/docs/agents)
- [Mastra Workflows Guide](https://mastra.ai/docs/workflows)
- [Mastra Context Management](https://mastra.ai/docs/context)

---

## ✅ Next Steps

1. **Review this document** with your team
2. **Set up Mastra** in a development environment
3. **Start Phase 1** (Setup & Foundation)
4. **Create a test plan** for each phase
5. **Set up monitoring** for gradual rollout

---

**Note**: This migration should be done incrementally, testing at each step. The goal is to improve the system with Mastra's features while maintaining 100% functionality and performance.

