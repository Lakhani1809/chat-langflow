/**
 * Next.js API route: POST /api/chat
 * Main handler for the chat workflow
 */

import { NextRequest, NextResponse } from "next/server";
import type { ChatRequest, ChatResponse } from "../../../types";
import { classifyIntent, handleGeneralChat } from "../../../lib/llm-helpers";
import {
  analyzeColor,
  analyzeSilhouette,
  analyzeBodyType,
  composeReasoning,
  generateFinalResponse,
} from "../../../lib/llm-helpers";
import { fetchWardrobeAndProfile } from "../../../lib/wardrobe-client";
import { filterValidOutfits } from "../../../lib/safety-checks";
import {
  createLogEntry,
  recordStageTiming,
  recordError,
  logChatRequest,
} from "../../../lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 0: Receive & normalize input
    const body = (await request.json()) as ChatRequest;

    // Validation
    if (!body.userId || !body.message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 }
      );
    }

    const userId = body.userId.trim();
    const message = body.message.trim();

    if (!message) {
      return NextResponse.json(
        { error: "message cannot be empty" },
        { status: 400 }
      );
    }

    // Initialize logging
    const logEntry = createLogEntry(userId, message);

    // Step 1: Intent Classification
    const intentStart = Date.now();
    let intentResult;
    try {
      intentResult = await classifyIntent(message);
      recordStageTiming(logEntry, "intent", intentStart, true);
      logEntry.intent = intentResult.intent;
    } catch (error) {
      recordStageTiming(logEntry, "intent", intentStart, false);
      recordError(logEntry, `Intent classification failed: ${error}`);
      // Default to general_chat on error
      intentResult = { intent: "general_chat" };
    }

    // Shortcut path for general_chat
    if (intentResult.intent === "general_chat") {
      const generalChatStart = Date.now();
      try {
        const response = await handleGeneralChat(message, body.history);
        recordStageTiming(logEntry, "finalResponse", generalChatStart, true);

        const chatResponse: ChatResponse = {
          intent: "general_chat",
          message: response,
        };

        logEntry.finalResponse = chatResponse;
        await logChatRequest(logEntry);

        return NextResponse.json(chatResponse);
      } catch (error) {
        recordStageTiming(logEntry, "finalResponse", generalChatStart, false);
        recordError(logEntry, `General chat failed: ${error}`);

        const chatResponse: ChatResponse = {
          intent: "general_chat",
          message: "I'm here to help with your styling questions! What would you like to know?",
        };

        logEntry.finalResponse = chatResponse;
        await logChatRequest(logEntry);

        return NextResponse.json(chatResponse);
      }
    }

    // Step 2: Wardrobe & Profile Retrieval
    const wardrobeStart = Date.now();
    let wardrobeContext;
    try {
      wardrobeContext = await fetchWardrobeAndProfile(userId);
      recordStageTiming(logEntry, "wardrobe", wardrobeStart, true);
    } catch (error) {
      recordStageTiming(logEntry, "wardrobe", wardrobeStart, false);
      recordError(logEntry, `Wardrobe fetch failed: ${error}`);
      // Continue with empty wardrobe
      wardrobeContext = {
        userId,
        wardrobe_items: [],
      };
    }

    // Step 3: Build Shared Context
    const sharedContext = `
User message:
${message}

Wardrobe and profile context:
${JSON.stringify(wardrobeContext, null, 2)}
`;

    // Step 4: Parallel Style Analysis Modules
    const parallelStart = Date.now();
    const [colorAnalysis, silhouetteAnalysis, bodyTypeAnalysis] = await Promise.allSettled([
      analyzeColor(sharedContext),
      analyzeSilhouette(sharedContext),
      analyzeBodyType(sharedContext),
    ]);

    // Process results with fallbacks
    const colorResult =
      colorAnalysis.status === "fulfilled"
        ? colorAnalysis.value
        : {
            color_direction: "neutral-based outfits",
            combos: [],
            reason: "Color analysis failed. Using safe neutrals.",
          };

    const silhouetteResult =
      silhouetteAnalysis.status === "fulfilled"
        ? silhouetteAnalysis.value
        : {
            silhouette_verdict: "balanced proportions",
            structures: [],
            notes: "Silhouette analysis failed. Using balanced proportions.",
          };

    const bodyTypeResult =
      bodyTypeAnalysis.status === "fulfilled"
        ? bodyTypeAnalysis.value
        : {
            body_type: "balanced",
            rules: ["Focus on balanced proportions", "Choose items that fit well"],
            application: "Body type analysis failed. Using general styling principles.",
          };

    // Record timing for parallel calls
    recordStageTiming(
      logEntry,
      "colorAnalysis",
      parallelStart,
      colorAnalysis.status === "fulfilled",
      colorAnalysis.status === "rejected"
    );
    recordStageTiming(
      logEntry,
      "silhouetteAnalysis",
      parallelStart,
      silhouetteAnalysis.status === "fulfilled",
      silhouetteAnalysis.status === "rejected"
    );
    recordStageTiming(
      logEntry,
      "bodyTypeAnalysis",
      parallelStart,
      bodyTypeAnalysis.status === "fulfilled",
      bodyTypeAnalysis.status === "rejected"
    );

    if (colorAnalysis.status === "rejected") {
      recordError(logEntry, `Color analysis failed: ${colorAnalysis.reason}`);
    }
    if (silhouetteAnalysis.status === "rejected") {
      recordError(logEntry, `Silhouette analysis failed: ${silhouetteAnalysis.reason}`);
    }
    if (bodyTypeAnalysis.status === "rejected") {
      recordError(logEntry, `Body type analysis failed: ${bodyTypeAnalysis.reason}`);
    }

    // Step 5: Reasoning Composer
    const reasoningStart = Date.now();
    let reasoningSummary;
    try {
      reasoningSummary = await composeReasoning(
        colorResult,
        silhouetteResult,
        bodyTypeResult
      );
      recordStageTiming(logEntry, "reasoning", reasoningStart, true);
    } catch (error) {
      recordStageTiming(logEntry, "reasoning", reasoningStart, false);
      recordError(logEntry, `Reasoning composition failed: ${error}`);
      // Use fallback reasoning
      reasoningSummary = {
        summary: "Combined styling analysis",
        core_outfit_direction: "balanced and flattering",
        key_color_approach: "neutral-based",
        key_silhouette_rules: ["balanced proportions"],
        key_body_type_adaptations: ["general styling principles"],
      };
    }

    // Step 6: Final Stylist Response
    const finalStart = Date.now();
    let finalResponse;
    try {
      finalResponse = await generateFinalResponse(
        message,
        JSON.stringify(wardrobeContext, null, 2),
        JSON.stringify(reasoningSummary, null, 2)
      );
      recordStageTiming(logEntry, "finalResponse", finalStart, true);
    } catch (error) {
      recordStageTiming(logEntry, "finalResponse", finalStart, false);
      recordError(logEntry, `Final response generation failed: ${error}`);
      // Use fallback response
      finalResponse = {
        message: "I'd love to help you with styling! Let me analyze your wardrobe and preferences.",
        outfits: [],
        extra_tips: [],
      };
    }

    // Safety check: Filter outfits to only include items from wardrobe
    if (finalResponse.outfits && wardrobeContext.wardrobe_items.length > 0) {
      finalResponse.outfits = filterValidOutfits(
        finalResponse.outfits,
        wardrobeContext.wardrobe_items
      );
    }

    // Build response
    const chatResponse: ChatResponse = {
      intent: intentResult.intent,
      message: finalResponse.message,
      outfits: finalResponse.outfits,
      extra_tips: finalResponse.extra_tips,
      // Include debug info in development
      ...(process.env.NODE_ENV === "development" && {
        debug: {
          colorAnalysis: colorResult,
          silhouetteAnalysis: silhouetteResult,
          bodyTypeAnalysis: bodyTypeResult,
          reasoning: reasoningSummary,
        },
      }),
    };

    logEntry.finalResponse = chatResponse;
    await logChatRequest(logEntry);

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

