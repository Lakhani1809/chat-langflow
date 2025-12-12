/**
 * Analysis Module Exports
 * Now supports partial analysis pipeline for latency optimization
 */

export { extractFashionIntelligence, buildSharedContext, formatSharedContextForLLM, deriveDefaultGenderContext, getGenderContextStylingHints } from "./intelligence";
export { analyzeColors, getColorHarmony, colorsComplementEachOther, suggestColorsForOccasion } from "./color";
export { analyzeSilhouette, getSilhouetteRulesForBodyType, suggestStructureForOccasion } from "./silhouette";
export { analyzeBodyType, getBodyTypeStylingTips, getBodyPositiveAffirmation } from "./body";
export { generateStylingRules, formatRulesForModule, createQuickRules, validateOutfitAgainstRules, createQuickRulesFromAnalyses } from "./rules";

import type {
  SharedContext,
  FashionIntelligence,
  ColorAnalysis,
  SilhouetteAnalysis,
  BodyTypeAnalysis,
  RulesEngineOutput,
  Gender,
  GenderContext,
} from "../types";

import { extractFashionIntelligence, buildSharedContext, deriveDefaultGenderContext } from "./intelligence";
import { analyzeColors } from "./color";
import { analyzeSilhouette } from "./silhouette";
import { analyzeBodyType } from "./body";
import { generateStylingRules, createQuickRulesFromAnalyses } from "./rules";

/**
 * Execution options for partial pipeline
 */
export interface AnalysisPipelineOptions {
  runFIE?: boolean;
  runAnalysis?: boolean;
  runRules?: boolean;
  cachedFIE?: FashionIntelligence;
  cachedColorAnalysis?: ColorAnalysis;
  cachedSilhouetteAnalysis?: SilhouetteAnalysis;
  cachedBodyTypeAnalysis?: BodyTypeAnalysis;
  cachedRules?: RulesEngineOutput;
  cachedGenderContext?: GenderContext;
}

/**
 * Analysis pipeline result type
 */
export interface AnalysisPipelineResult {
  fashionIntelligence: FashionIntelligence;
  colorAnalysis: ColorAnalysis;
  silhouetteAnalysis: SilhouetteAnalysis;
  bodyTypeAnalysis: BodyTypeAnalysis;
  rulesEngine: RulesEngineOutput;
  sharedContext: SharedContext;
  genderContext: GenderContext;
  fromCache: {
    fie: boolean;
    color: boolean;
    silhouette: boolean;
    bodyType: boolean;
    rules: boolean;
  };
}

/**
 * Default fallback values
 */
const DEFAULT_COLOR_ANALYSIS: ColorAnalysis = {
  color_direction: "neutral palette",
  primary_palette: ["black", "white", "grey"],
  accent_colors: ["navy"],
  combos: ["black and white"],
  avoid_colors: [],
  reason: "Using safe defaults.",
};

const DEFAULT_SILHOUETTE_ANALYSIS: SilhouetteAnalysis = {
  silhouette_verdict: "balanced proportions",
  recommended_structures: ["fitted top + relaxed bottom"],
  proportion_tips: ["Balance fitted with relaxed"],
  layering_suggestions: ["Add a jacket for polish"],
  notes: "Using safe defaults.",
};

const DEFAULT_BODY_TYPE_ANALYSIS: BodyTypeAnalysis = {
  body_type: "balanced",
  flattering_styles: ["Balanced proportions"],
  rules: ["Highlight your favorite features"],
  highlight_areas: ["waist"],
  balance_tips: ["Mix fitted and relaxed"],
  application: "Using universal styling.",
};

const DEFAULT_RULES: RulesEngineOutput = {
  valid_pairs: ["versatile top + comfortable bottom"],
  avoid_pairs: [],
  strong_outfit_bases: ["jeans + tee"],
  core_directions: ["Keep it comfortable"],
  color_rules: ["Neutral base"],
  silhouette_rules: ["Balanced proportions"],
  body_type_rules: ["Flattering fit"],
  gender_style_notes: ["Style flexibly"],
};

/**
 * Run complete analysis pipeline
 * Now supports partial execution with caching for latency optimization
 */
export async function runAnalysisPipeline(
  userMessage: string,
  wardrobeSummary: string,
  bodyType?: string,
  styleKeywords?: string[],
  gender?: Gender,
  options?: AnalysisPipelineOptions
): Promise<AnalysisPipelineResult> {
  const {
    runFIE = true,
    runAnalysis = true,
    runRules = true,
    cachedFIE,
    cachedColorAnalysis,
    cachedSilhouetteAnalysis,
    cachedBodyTypeAnalysis,
    cachedRules,
    cachedGenderContext,
  } = options || {};

  const fromCache = {
    fie: false,
    color: false,
    silhouette: false,
    bodyType: false,
    rules: false,
  };

  // Step 1: Fashion Intelligence Engine (FIE)
  let fashionIntelligence: FashionIntelligence;
  
  if (!runFIE && cachedFIE) {
    fashionIntelligence = cachedFIE;
    fromCache.fie = true;
    console.log(`   ⚡ FIE: Using cached`);
  } else if (runFIE) {
    fashionIntelligence = await extractFashionIntelligence(
      userMessage,
      wardrobeSummary,
      gender
    );
    console.log(`   🔄 FIE: Fresh analysis`);
  } else {
    // Fallback if no FIE needed and no cache
    fashionIntelligence = {
      vibe: "versatile",
      aesthetic: "modern casual",
      fit_preference: "comfortable",
      color_direction: "neutral",
      occasion: "everyday",
      mood: "confident",
      gender_context: cachedGenderContext || deriveDefaultGenderContext(gender),
    };
    fromCache.fie = true;
    console.log(`   ⏭️ FIE: Skipped (using defaults)`);
  }

  const genderContext = fashionIntelligence.gender_context;

  // Step 2: Build shared context
  const sharedContext = buildSharedContext(
    userMessage,
    wardrobeSummary,
    fashionIntelligence,
    bodyType,
    styleKeywords
  );

  // Step 3: Analysis modules (parallel)
  let colorAnalysis: ColorAnalysis;
  let silhouetteAnalysis: SilhouetteAnalysis;
  let bodyTypeAnalysis: BodyTypeAnalysis;

  if (!runAnalysis) {
    // Use cached or defaults
    colorAnalysis = cachedColorAnalysis || DEFAULT_COLOR_ANALYSIS;
    silhouetteAnalysis = cachedSilhouetteAnalysis || DEFAULT_SILHOUETTE_ANALYSIS;
    bodyTypeAnalysis = cachedBodyTypeAnalysis || DEFAULT_BODY_TYPE_ANALYSIS;
    fromCache.color = !!cachedColorAnalysis;
    fromCache.silhouette = !!cachedSilhouetteAnalysis;
    fromCache.bodyType = !!cachedBodyTypeAnalysis;
    console.log(`   ⏭️ Analysis: Skipped (${cachedColorAnalysis ? "cached" : "defaults"})`);
  } else {
    // Run parallel analysis
    const [colorResult, silhouetteResult, bodyTypeResult] = await Promise.allSettled([
      analyzeColors(sharedContext),
      analyzeSilhouette(sharedContext),
      analyzeBodyType(sharedContext),
    ]);

    colorAnalysis = colorResult.status === "fulfilled" 
      ? colorResult.value 
      : DEFAULT_COLOR_ANALYSIS;
    silhouetteAnalysis = silhouetteResult.status === "fulfilled" 
      ? silhouetteResult.value 
      : DEFAULT_SILHOUETTE_ANALYSIS;
    bodyTypeAnalysis = bodyTypeResult.status === "fulfilled" 
      ? bodyTypeResult.value 
      : DEFAULT_BODY_TYPE_ANALYSIS;

    console.log(`   🔄 Analysis: Fresh (color: ${colorResult.status}, silhouette: ${silhouetteResult.status}, body: ${bodyTypeResult.status})`);
  }

  // Step 4: Rules Engine
  let rulesEngine: RulesEngineOutput;

  if (!runRules) {
    // Use cached or create quick rules without LLM
    if (cachedRules) {
      rulesEngine = cachedRules;
      fromCache.rules = true;
      console.log(`   ⚡ Rules: Using cached`);
    } else {
      // Create quick rules from analyses WITHOUT LLM call
      rulesEngine = createQuickRulesFromAnalyses(
        fashionIntelligence,
        colorAnalysis,
        silhouetteAnalysis,
        bodyTypeAnalysis
      );
      console.log(`   ⏭️ Rules: Quick rules (no LLM)`);
    }
  } else {
    // Full LLM-based rules generation
    rulesEngine = await generateStylingRules(
      fashionIntelligence,
      colorAnalysis,
      silhouetteAnalysis,
      bodyTypeAnalysis
    );
    console.log(`   🔄 Rules: Fresh analysis`);
  }

  return {
    fashionIntelligence,
    colorAnalysis,
    silhouetteAnalysis,
    bodyTypeAnalysis,
    rulesEngine,
    sharedContext,
    genderContext,
    fromCache,
  };
}

/**
 * Run FIE-only analysis (for lighter intents)
 */
export async function runFIEOnly(
  userMessage: string,
  wardrobeSummary: string,
  gender?: Gender
): Promise<{ fashionIntelligence: FashionIntelligence; genderContext: GenderContext }> {
  const fashionIntelligence = await extractFashionIntelligence(
    userMessage,
    wardrobeSummary,
    gender
  );

  return {
    fashionIntelligence,
    genderContext: fashionIntelligence.gender_context,
  };
}
