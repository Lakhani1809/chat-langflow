/**
 * MyMirro Chat API - Main Route Handler V2
 * POST /api/chat
 * 
 * Orchestrates the complete multi-module AI stylist workflow
 * 
 * V2 FEATURES:
 * - Canonical memory with conflict resolution
 * - Confidence scoring with decisive/hedging behavior
 * - Deterministic hard rules + LLM soft rules
 * - Multi-intent handling
 * - Response mode enforcement (visual_outfit, advisory_text, shopping_comparison)
 * - Outfit completeness contract
 * 
 * OPTIMIZED FOR LATENCY:
 * - Intent-based execution map (skip unnecessary modules)
 * - Session caching (reuse analysis across conversation)
 * - Parallelized non-dependent work
 * - Merged rules + tone rewriting (saves 2 LLM calls)
 * - Model stratification (lite for analysis, flash for responses)
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  ChatRequest,
  ChatResponse,
  IntentType,
  DebugInfo,
  VisualOutfit,
  WardrobeContext,
  ConversationMemory,
  CanonicalMemory,
  ConfidenceSummary,
  ConfidenceScore,
  ResponseMode,
  WardrobeCoverageProfile,
  MultiIntentResult,
} from "../../../types";

// Utils
import { classifyIntent, getIntentFromKeywords } from "../../../utils/intentClassifier";
import { fetchWardrobeAndProfile } from "../../../utils/supabaseClient";
import { buildConversationMemory } from "../../../utils/memory";
import { formatWardrobeForLLM } from "../../../utils/wardrobeFormatter";
import { applySafetyFilter } from "../../../utils/safetyFilter";
import { resolveAllOutfitImages, filterOutfitsWithImages } from "../../../utils/outfitImageResolver";
import {
  composeFinalResponse,
  composeGeneralChatResponse,
  composeColorAnalysisResponse,
  composeBodyTypeResponse,
  formatFinalOutput,
  generateSuggestionPills,
  composeFinalResponseV2,
  composeShoppingComparisonV2,
  composeClarifyingQuestionResponse,
} from "../../../utils/finalComposer";
import {
  createLogEntry,
  recordStage,
  recordError,
  setIntent,
  setResponseSize,
  finalizeLog,
  startStage,
} from "../../../utils/logger";

// V2: Canonical memory and confidence
import { arbitrateMemory, DEFAULT_CANONICAL_MEMORY, formatCanonicalMemoryForPrompt } from "../../../utils/memoryArbiter";

// V3: Smart clarification
import { needsClarification, isAnsweringClarification, getComprehensivePromptInstruction } from "../../../utils/clarificationDetector";
import { createConfidenceScore, combineConfidences, createDefaultConfidenceSummary } from "../../../utils/confidence";
import { computeWardrobeCoverage, canCreateCompleteOutfits } from "../../../utils/wardrobeCoverage";
import { detectWardrobeRequest } from "../../../utils/wardrobeRequestDetector";

// Session caching & execution optimization
import {
  generateSessionKey,
  generateConversationId,
  getSessionCache,
  setSessionCache,
  updateSessionCache,
  hasCompleteAnalysisCache,
} from "../../../utils/sessionCache";
import {
  getExecutionConfig,
  logExecutionPlan,
  isContinuation,
} from "../../../utils/executionMap";

// Analysis modules
import { runAnalysisPipeline, type AnalysisPipelineResult } from "../../../analysis";

// Specialized modules
import { routeToModule, extractOutfitsFromOutput } from "../../../modules";

// V2: Outfit generation with multi-candidate + rules
import { generateOutfitsV2, canGenerateOutfits, convertDraftsToOutfits } from "../../../modules/outfit";

export async function POST(request: NextRequest) {
  const totalStart = startStage("total");
  let logEntry = createLogEntry("unknown", "");

  try {
    // ========================================
    // STEP 0: Parse and Validate Input
    // ========================================
    const body = (await request.json()) as ChatRequest;

    if (!body.userId || !body.message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 }
      );
    }

    const userId = body.userId.trim();
    const message = body.message.trim();
    // Generate conversationId if not provided (for caching)
    const conversationId = body.conversationId || generateConversationId();
    const history = body.history || [];

    if (!message) {
      return NextResponse.json(
        { error: "message cannot be empty" },
        { status: 400 }
      );
    }

    // Initialize logging
    logEntry = createLogEntry(userId, message, conversationId);

    // Generate session key for caching
    const sessionKey = generateSessionKey(userId, conversationId);
    const cachedSession = getSessionCache(sessionKey);
    const hasCachedAnalysis = hasCompleteAnalysisCache(sessionKey);

    console.log(`\n🎯 New chat request from user ${userId}`);
    console.log(`📝 Message: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`);
    console.log(`📦 Session: ${sessionKey} (cached: ${hasCachedAnalysis ? "YES" : "NO"})`);

    // ========================================
    // STEP 1: PARALLEL - Intent + Memory + Wardrobe
    // (Run non-dependent work in parallel for speed)
    // ========================================
    const parallelStart = startStage("parallel_init");
    
    // Quick keyword-based intent (instant, no API call)
    const quickIntent = getIntentFromKeywords(message);
    
    // V2: Check for explicit wardrobe request
    const explicitWardrobeRequest = detectWardrobeRequest(message);
    
    // Run memory + wardrobe fetch in parallel with LLM intent (if needed)
    const memory = buildConversationMemory(history);
    
    // V2: Multi-intent classification now returns MultiIntentResult
    const intentPromise = quickIntent 
      ? Promise.resolve(quickIntent)
      : classifyIntent(message, memory);
    
    const wardrobePromise = fetchWardrobeAndProfile(userId);
    
    // Wait for both in parallel
    const [intentResult, wardrobeResult] = await Promise.allSettled([
      intentPromise,
      wardrobePromise,
    ]);
    
    recordStage(logEntry, "parallelInit", parallelStart, true);

    // ========================================
    // STEP 2: Extract Intent (V2: Multi-intent + Confidence)
    // ========================================
    let intent: IntentType;
    let secondaryIntents: IntentType[] = [];
    let intentConfidence = createConfidenceScore(0.7, ["inferred"]);
    
    if (intentResult.status === "fulfilled") {
      const result = intentResult.value;
      // Handle both quick intent (IntentType) and LLM result (MultiIntentResult)
      if (typeof result === "string") {
        // Quick intent returns just IntentType
        intent = result as IntentType;
        intentConfidence = createConfidenceScore(0.8, ["keyword_match"]);
      } else if (result && typeof result === "object" && "primary_intent" in result) {
        // LLM classification returns MultiIntentResult
        const multiResult = result as unknown as MultiIntentResult;
        intent = multiResult.primary_intent;
        secondaryIntents = multiResult.secondary_intents || [];
        intentConfidence = multiResult.intent_confidence;
        console.log(`${quickIntent ? "⚡" : "🤖"} Intent: ${intent} (confidence: ${intentConfidence.score.toFixed(2)})`);
        if (secondaryIntents.length > 0) {
          console.log(`   Secondary: ${secondaryIntents.join(", ")}`);
        }
      } else if (result && typeof result === "object" && "intent" in result) {
        // Legacy IntentResult
        intent = (result as { intent: IntentType }).intent;
      } else {
        intent = "general_chat";
      }
    } else {
      intent = "general_chat";
      intentConfidence = createConfidenceScore(0.3, ["default_fallback"], "Intent classification failed");
      recordError(logEntry, `Intent classification failed: ${intentResult.reason}`);
      console.log(`⚠️ Intent fallback: general_chat`);
    }
    
    if (!quickIntent) {
      console.log(`🤖 Intent: ${intent}`);
    } else {
      console.log(`⚡ Intent: ${intent} (keyword match)`);
    }
    
    setIntent(logEntry, intent);

    // ========================================
    // STEP 3: Extract Wardrobe Context
    // ========================================
    let wardrobeContext: WardrobeContext;
    let userProfile;
    
    if (wardrobeResult.status === "fulfilled") {
      wardrobeContext = wardrobeResult.value;
      userProfile = wardrobeResult.value.profile;
      console.log(`👔 Wardrobe: ${wardrobeContext.wardrobe_items.length} items`);
    } else {
      wardrobeContext = { userId, wardrobe_items: [] };
      recordError(logEntry, `Wardrobe fetch failed: ${wardrobeResult.reason}`);
      console.log(`⚠️ Wardrobe fallback: empty`);
    }

    // ========================================
    // V2 STEP 3.5: Compute Wardrobe Coverage Profile
    // ========================================
    const wardrobeCoverage = computeWardrobeCoverage(wardrobeContext.wardrobe_items);
    const { canGenerate: canGenerateCompleteOutfits, missingSlots: missingMandatorySlots } = 
      canGenerateOutfits(wardrobeCoverage);
    
    console.log(`📊 Wardrobe coverage: ${wardrobeCoverage.totalItems} items, ${wardrobeCoverage.totalWithImages} with images`);
    if (!canGenerateCompleteOutfits) {
      console.log(`   Missing mandatory: ${missingMandatorySlots.join(", ")}`);
    }

    // ========================================
    // STEP 4: Get Execution Config (CRITICAL OPTIMIZATION)
    // ========================================
    const execConfig = getExecutionConfig(intent);
    logExecutionPlan(intent, hasCachedAnalysis);
    
    // V2: Determine response mode based on intent
    const responseMode: ResponseMode = 
      intent === "shopping_help" ? "shopping_comparison" : 
      ["outfit_generation", "event_styling", "travel_packing"].includes(intent) ? "visual_outfit" : 
      "advisory_text";

    // ========================================
    // STEP 5: Handle General Chat Shortcut (No analysis needed)
    // ========================================
    if (intent === "general_chat") {
      console.log(`💬 General chat - skipping all analysis`);
      
      const generalStart = startStage("generalChat");
      try {
        // OPTIMIZED: Gen-Z tone is now built into the composer
        const generalResponse = await composeGeneralChatResponse(message, memory);

        const response: ChatResponse = {
          intent: "general_chat",
          message: generalResponse.message,
          suggestion_pills: generalResponse.suggestion_pills,
        };

        recordStage(logEntry, "finalComposer", generalStart, true);
        setResponseSize(logEntry, response);
        finalizeLog(logEntry);

        return NextResponse.json(response);
      } catch (error) {
        recordStage(logEntry, "finalComposer", generalStart, false);
        recordError(logEntry, `General chat failed: ${error}`);
        
        return NextResponse.json({
          intent: "general_chat",
          message: "Hey! I'm here to help with your style questions. What would you like to know? ✨",
          suggestion_pills: ["Outfit for today", "What's trending?", "My wardrobe", "Shopping help"],
        });
      }
    }

    // ========================================
    // STEP 5.5: V3 Smart Clarification Check
    // Ask ONE clarifying question if context is missing
    // ========================================
    const hasAlreadyAskedClarification = cachedSession?.hasAskedClarification || false;
    
    // Check if user is responding to our previous clarification
    const isAnsweringPrevious = isAnsweringClarification(
      message, 
      cachedSession?.lastClarificationQuestion
    );
    
    // If user is answering, extract their context and proceed
    if (isAnsweringPrevious && cachedSession?.lastClarificationQuestion) {
      console.log("✅ User answered clarification - proceeding with response");
      // Update cache to mark clarification as handled
      updateSessionCache(sessionKey, { 
        hasAskedClarification: true,
        lastClarificationQuestion: undefined,
      });
    }
    
    // Check if we need clarification (only for outfit-related intents)
    const clarificationResult = needsClarification(
      intent,
      message,
      memory,
      cachedSession?.fashionIntelligence,
      hasAlreadyAskedClarification
    );
    
    // If we need clarification AND haven't asked before, ask now
    if (clarificationResult.needsClarification && !hasAlreadyAskedClarification) {
      console.log(`❓ Asking clarification: "${clarificationResult.clarificationQuestion}"`);
      
      // Store that we've asked
      updateSessionCache(sessionKey, {
        hasAskedClarification: true,
        lastClarificationQuestion: clarificationResult.clarificationQuestion,
      });
      
      const response: ChatResponse = {
        intent,
        message: clarificationResult.clarificationQuestion || "What's the occasion?",
        suggestion_pills: clarificationResult.suggestionPills || [
          "Casual day out", "Work/Office", "Date night", "Party vibes", "Just everyday"
        ],
      };
      
      setResponseSize(logEntry, response);
      finalizeLog(logEntry);
      
      return NextResponse.json(response);
    }

    // ========================================
    // STEP 6: Run Analysis Pipeline (OPTIMIZED with caching)
    // ========================================
    const analysisStart = startStage("analysis");
    let analysisResults: AnalysisPipelineResult;

    // Check if we can use cached analysis (huge win for follow-ups)
    const useCachedFIE = !execConfig.runFIE && cachedSession?.fashionIntelligence;
    const useCachedAnalysis = !execConfig.runAnalysis && cachedSession;
    const useCachedRules = !execConfig.runRules && cachedSession?.rules;

    // For continuation queries, reuse everything from cache
    const isContinuationIntent = isContinuation(intent);
    
    try {
      if (isContinuationIntent && hasCachedAnalysis && cachedSession) {
        // HUGE WIN: Reuse all cached analysis for follow-ups
        console.log(`⚡ CONTINUATION: Reusing all cached analysis`);
        
        analysisResults = {
          fashionIntelligence: cachedSession.fashionIntelligence!,
          colorAnalysis: cachedSession.colorAnalysis!,
          silhouetteAnalysis: cachedSession.silhouetteAnalysis!,
          bodyTypeAnalysis: cachedSession.bodyTypeAnalysis!,
          rulesEngine: cachedSession.rules!,
          sharedContext: {
            userMessage: message,
            wardrobeSummary: formatWardrobeForLLM(wardrobeContext),
            fashionIntelligence: cachedSession.fashionIntelligence!,
          },
          genderContext: cachedSession.genderContext || "androgynous",
          fromCache: { fie: true, color: true, silhouette: true, bodyType: true, rules: true },
        };
        
        recordStage(logEntry, "analysis", analysisStart, true, { cached: true });
      } else {
        // Run analysis pipeline with execution config options
        analysisResults = await runAnalysisPipeline(
          message,
          formatWardrobeForLLM(wardrobeContext),
          wardrobeContext.body_type || userProfile?.body_type,
          wardrobeContext.style_keywords || userProfile?.style_keywords,
          wardrobeContext.gender || userProfile?.gender,
          {
            runFIE: execConfig.runFIE,
            runAnalysis: execConfig.runAnalysis,
            runRules: execConfig.runRules,
            cachedFIE: useCachedFIE ? cachedSession?.fashionIntelligence : undefined,
            cachedColorAnalysis: useCachedAnalysis ? cachedSession?.colorAnalysis : undefined,
            cachedSilhouetteAnalysis: useCachedAnalysis ? cachedSession?.silhouetteAnalysis : undefined,
            cachedBodyTypeAnalysis: useCachedAnalysis ? cachedSession?.bodyTypeAnalysis : undefined,
            cachedRules: useCachedRules ? cachedSession?.rules : undefined,
            cachedGenderContext: cachedSession?.genderContext,
          }
        );

        console.log(`🔬 Analysis pipeline complete`);
        console.log(`   - Vibe: ${analysisResults.fashionIntelligence.vibe}`);
        console.log(`   - Aesthetic: ${analysisResults.fashionIntelligence.aesthetic}`);
        console.log(`   - Occasion: ${analysisResults.fashionIntelligence.occasion}`);
        console.log(`   - Gender Context: ${analysisResults.genderContext}`);
        console.log(`   - From cache: FIE=${analysisResults.fromCache.fie}, Analysis=${analysisResults.fromCache.color}, Rules=${analysisResults.fromCache.rules}`);

        recordStage(logEntry, "analysis", analysisStart, true, { 
          fromCache: analysisResults.fromCache,
          skipped: { fie: !execConfig.runFIE, analysis: !execConfig.runAnalysis, rules: !execConfig.runRules }
        });
      }

      // Update session cache with new analysis results
      updateSessionCache(sessionKey, {
        fashionIntelligence: analysisResults.fashionIntelligence,
        colorAnalysis: analysisResults.colorAnalysis,
        silhouetteAnalysis: analysisResults.silhouetteAnalysis,
        bodyTypeAnalysis: analysisResults.bodyTypeAnalysis,
        rules: analysisResults.rulesEngine,
        genderContext: analysisResults.genderContext,
      });
      
    } catch (error) {
      recordStage(logEntry, "analysis", analysisStart, false, { fallback: true });
      recordError(logEntry, `Analysis pipeline failed: ${error}`);
      
      // Use fallback analysis
      analysisResults = {
        fashionIntelligence: {
          vibe: "versatile",
          aesthetic: "modern casual",
          fit_preference: "comfortable",
          color_direction: "neutral",
          occasion: "everyday",
          mood: "confident",
          gender_context: "androgynous" as const,
        },
        colorAnalysis: {
          color_direction: "neutral",
          primary_palette: ["black", "white", "grey"],
          accent_colors: ["navy"],
          combos: ["black and white"],
          avoid_colors: [],
          reason: "Using safe defaults",
        },
        silhouetteAnalysis: {
          silhouette_verdict: "balanced",
          recommended_structures: ["fitted top + relaxed bottom"],
          proportion_tips: ["Balance fitted with relaxed"],
          layering_suggestions: [],
          notes: "Using defaults",
        },
        bodyTypeAnalysis: {
          body_type: "balanced",
          flattering_styles: ["Balanced proportions"],
          rules: ["Choose items that fit well"],
          highlight_areas: ["waist"],
          balance_tips: ["Mix fitted and relaxed"],
          application: "Using defaults",
        },
        rulesEngine: {
          valid_pairs: ["versatile top + comfortable bottom"],
          avoid_pairs: [],
          strong_outfit_bases: ["jeans + tee"],
          core_directions: ["Keep it comfortable"],
          color_rules: ["Neutral base"],
          silhouette_rules: ["Balanced proportions"],
          body_type_rules: ["Flattering fit"],
        },
        sharedContext: {
          userMessage: message,
          wardrobeSummary: "Limited wardrobe data",
          fashionIntelligence: {
            vibe: "versatile",
            aesthetic: "casual",
            fit_preference: "comfortable",
            color_direction: "neutral",
            occasion: "everyday",
            mood: "confident",
            gender_context: "androgynous" as const,
          },
        },
        genderContext: "androgynous" as const,
        fromCache: { fie: false, color: false, silhouette: false, bodyType: false, rules: false },
      };
      console.log(`⚠️ Using fallback analysis results`);
    }

    // ========================================
    // V2 STEP 6.5: Arbitrate Memory → Canonical Preferences
    // ========================================
    const canonicalMemory: CanonicalMemory = arbitrateMemory(
      memory,
      message,
      analysisResults.fashionIntelligence,
      cachedSession?.canonicalMemory
    );
    
    // Update cache with canonical memory
    updateSessionCache(sessionKey, { canonicalMemory });
    
    console.log(`🧠 Canonical memory: confidence=${canonicalMemory.memory_confidence.score.toFixed(2)}, needs_clarification=${canonicalMemory.needs_clarification}`);
    
    // V2: Build confidence summary
    const wardrobeConfidence = createConfidenceScore(
      wardrobeCoverage.totalItems > 10 ? 0.9 : wardrobeCoverage.totalItems > 3 ? 0.7 : 0.4,
      wardrobeCoverage.totalItems > 0 ? ["wardrobe_backed"] : ["low_wardrobe_coverage"],
      wardrobeCoverage.totalItems === 0 ? "No wardrobe items" : undefined
    );
    
    const analysisConfidence = createConfidenceScore(
      analysisResults.fromCache.fie ? 0.8 : 0.7,
      analysisResults.fromCache.fie ? ["cached"] : ["llm_generated"]
    );
    
    const rulesConfidence = createConfidenceScore(
      analysisResults.fromCache.rules ? 0.85 : 0.75,
      analysisResults.fromCache.rules ? ["cached"] : ["llm_generated"]
    );
    
    // combineConfidences returns a ConfidenceSummary with all fields
    const confidenceSummary = combineConfidences(
      intentConfidence, 
      canonicalMemory.memory_confidence, 
      wardrobeConfidence,
      analysisConfidence,
      rulesConfidence
    );

    // ========================================
    // STEP 7: Handle Special Intents (Color/Body Type)
    // OPTIMIZED: Tone rewriting merged into composer
    // ========================================
    if (intent === "color_analysis") {
      console.log(`🎨 Handling color analysis intent`);
      
      // OPTIMIZED: Gen-Z tone built into composer (saves 1 LLM call)
      const colorResponse = await composeColorAnalysisResponse(
        message,
        analysisResults.colorAnalysis,
        wardrobeContext,
        memory // Pass memory for tone
      );

      const response: ChatResponse = {
        intent,
        message: colorResponse.message, // Already Gen-Z friendly
        extra_tips: colorResponse.extra_tips,
        suggestion_pills: colorResponse.suggestion_pills,
        debug: process.env.NODE_ENV === "development" ? {
          colorAnalysis: analysisResults.colorAnalysis,
          genderContext: analysisResults.genderContext,
        } : undefined,
      };

      setResponseSize(logEntry, response);
      finalizeLog(logEntry);

      return NextResponse.json(response);
    }

    if (intent === "body_type_advice") {
      console.log(`💪 Handling body type advice intent`);
      
      // OPTIMIZED: Gen-Z tone built into composer (saves 1 LLM call)
      const bodyResponse = await composeBodyTypeResponse(
        message,
        analysisResults.bodyTypeAnalysis,
        wardrobeContext,
        memory // Pass memory for tone
      );

      const response: ChatResponse = {
        intent,
        message: bodyResponse.message, // Already Gen-Z friendly
        extra_tips: bodyResponse.extra_tips,
        suggestion_pills: bodyResponse.suggestion_pills,
        debug: process.env.NODE_ENV === "development" ? {
          bodyTypeAnalysis: analysisResults.bodyTypeAnalysis,
          genderContext: analysisResults.genderContext,
        } : undefined,
      };

      setResponseSize(logEntry, response);
      finalizeLog(logEntry);

      return NextResponse.json(response);
    }

    // ========================================
    // STEP 8: Route to Specialized Module
    // ========================================
    const moduleStart = startStage("module");
    let moduleResult;

    try {
      // For continuation queries, add variation instruction
      const moduleMessage = isContinuationIntent 
        ? `${message} (Give different/new options from before)`
        : message;

      moduleResult = await routeToModule(
        intent,
        moduleMessage,
        wardrobeContext,
        analysisResults.rulesEngine,
        analysisResults.fashionIntelligence,
        memory
      );

      console.log(`📦 Module "${moduleResult.moduleName}" completed`);
      recordStage(logEntry, "specializedModule", moduleStart, true, {
        moduleName: moduleResult.moduleName,
      });
    } catch (error) {
      recordStage(logEntry, "specializedModule", moduleStart, false, { fallback: true });
      recordError(logEntry, `Module routing failed: ${error}`);
      moduleResult = {
        moduleName: "fallback",
        output: {
          message: "Let me help you with your style!",
          outfits: [],
          extra_tips: ["Focus on pieces that make you feel confident!"],
        },
      };
      console.log(`⚠️ Using fallback module output`);
    }

    // ========================================
    // STEP 9: Compose Final Response
    // OPTIMIZED: Rules + Tone merged into single call
    // ========================================
    const composerStart = startStage("composer");
    let composedResponse;

    try {
      // OPTIMIZED: Pass fashion intelligence for better context
      composedResponse = await composeFinalResponse(
        intent,
        message,
        moduleResult.output,
        moduleResult.moduleName,
        wardrobeContext,
        analysisResults.rulesEngine,
        {
          color: analysisResults.colorAnalysis,
          silhouette: analysisResults.silhouetteAnalysis,
          bodyType: analysisResults.bodyTypeAnalysis,
          fashionIntelligence: analysisResults.fashionIntelligence, // Added for merged rules
        },
        memory
      );

      console.log(`✍️ Final response composed (with Gen-Z tone)`);
      recordStage(logEntry, "finalComposer", composerStart, true);
    } catch (error) {
      recordStage(logEntry, "finalComposer", composerStart, false, { fallback: true });
      recordError(logEntry, `Final composer failed: ${error}`);
      composedResponse = {
        message: "I'd love to help you with your style! Here are some ideas based on your wardrobe. ✨",
        outfits: extractOutfitsFromOutput(moduleResult.moduleName, moduleResult.output),
        extra_tips: ["Focus on pieces that make you feel confident!"],
        suggestion_pills: generateSuggestionPills(intent, false, false, false, false),
      };
    }

    // ========================================
    // STEP 10: Apply Safety Filter
    // ========================================
    const safetyStart = startStage("safety");
    
    try {
      const filtered = applySafetyFilter(
        {
          outfits: composedResponse.outfits,
          items: (moduleResult.output as Record<string, unknown>)?.items as string[],
          packing_list: (moduleResult.output as Record<string, unknown>)?.packing_list as string[],
        },
        wardrobeContext.wardrobe_items,
        intent
      );

      composedResponse.outfits = filtered.outfits;
      
      console.log(`🛡️ Safety filter applied`);
      recordStage(logEntry, "safetyFilter", safetyStart, true);
    } catch (error) {
      recordStage(logEntry, "safetyFilter", safetyStart, false);
      recordError(logEntry, `Safety filter failed: ${error}`);
    }

    // ========================================
    // STEP 11: Resolve Outfit Images
    // ========================================
    const imageStart = startStage("images");
    let visualOutfits: VisualOutfit[] = [];

    try {
      if (composedResponse.outfits && composedResponse.outfits.length > 0) {
        visualOutfits = resolveAllOutfitImages(
          composedResponse.outfits,
          wardrobeContext.wardrobe_items
        );
        
        // Filter to only outfits with resolved images
        visualOutfits = filterOutfitsWithImages(visualOutfits);
        
        console.log(`🖼️ Resolved ${visualOutfits.length} outfits with images`);

        // Cache last outfits for continuation queries
        updateSessionCache(sessionKey, {
          lastOutfits: composedResponse.outfits.map(o => ({ title: o.title, items: o.items })),
        });
      }
      recordStage(logEntry, "imageResolver", imageStart, true);
    } catch (error) {
      recordStage(logEntry, "imageResolver", imageStart, false);
      recordError(logEntry, `Image resolution failed: ${error}`);
    }

    // ========================================
    // STEP 12: Build Final Response
    // OPTIMIZED: Tone rewriting already merged into composer
    // ========================================
    const finalMessage = composedResponse.message; // Already Gen-Z friendly from composer
    const formattedOutput = formatFinalOutput(intent, composedResponse, moduleResult.output);

    // Build debug info for development (includes optimization metrics)
    const debugInfo: DebugInfo | undefined =
      process.env.NODE_ENV === "development"
        ? {
            fashionIntelligence: analysisResults.fashionIntelligence,
            colorAnalysis: analysisResults.colorAnalysis,
            silhouetteAnalysis: analysisResults.silhouetteAnalysis,
            bodyTypeAnalysis: analysisResults.bodyTypeAnalysis,
            rulesEngine: analysisResults.rulesEngine,
            moduleOutput: moduleResult.output,
            memory: {
              userTone: memory.userTone,
              userPreferences: memory.userPreferences,
              frequentAesthetics: memory.frequentAesthetics,
            },
            timings: logEntry.stages,
            genderContext: analysisResults.genderContext,
            // Optimization metrics
            optimization: {
              sessionKey,
              hadCachedAnalysis: hasCachedAnalysis,
              fromCache: analysisResults.fromCache,
              executionConfig: execConfig,
              isContinuation: isContinuationIntent,
            },
          }
        : undefined;

    // Use visual outfits if we have them, otherwise undefined (ChatResponse expects VisualOutfit[])
    const response: ChatResponse = {
      intent,
      message: finalMessage,
      outfits: visualOutfits.length > 0 ? visualOutfits : undefined,
      items: formattedOutput.items,
      brands: formattedOutput.brands,
      packing_list: formattedOutput.packing_list,
      trend_summary: formattedOutput.trend_summary,
      extra_tips: formattedOutput.extra_tips,
      suggestion_pills: composedResponse.suggestion_pills,
      debug: debugInfo,
    };

    // ========================================
    // STEP 13: Log and Return
    // ========================================
    setResponseSize(logEntry, response);
    finalizeLog(logEntry);

    const totalTime = Date.now() - totalStart;
    console.log(`\n✅ Request completed in ${totalTime}ms`);
    console.log(`   Intent: ${intent}${isContinuationIntent ? " (continuation)" : ""}`);
    console.log(`   Cache hit: ${hasCachedAnalysis ? "YES ⚡" : "NO"}`);
    console.log(`   Outfits: ${response.outfits?.length || 0} (${visualOutfits.length} visual)`);
    console.log(`   Suggestion pills: ${response.suggestion_pills?.length || 0}`);
    console.log(`   Response size: ${logEntry.finalResponseSize} bytes\n`);

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Chat API Error:", error);
    recordError(logEntry, `Unhandled error: ${error}`);
    finalizeLog(logEntry);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
