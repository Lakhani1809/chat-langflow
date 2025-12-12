/**
 * Gemini API Client
 * Handles API calls with retries, timeouts, and error handling
 * 
 * Model Stratification:
 * - GEMINI_LITE: Intent, FIE, Color/Silhouette/Body analysis
 * - GEMINI_FLASH: Specialized modules, Final response
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 2;

/**
 * Model constants for stratification
 */
export const GEMINI_LITE = "gemini-2.5-flash-lite";
export const GEMINI_FLASH = "gemini-2.0-flash";

/**
 * Default model for different stages
 */
export const MODEL_FOR_STAGE = {
  intentClassification: GEMINI_LITE,
  fashionIntelligence: GEMINI_LITE,
  colorAnalysis: GEMINI_LITE,
  silhouetteAnalysis: GEMINI_LITE,
  bodyTypeAnalysis: GEMINI_LITE,
  rulesEngine: GEMINI_LITE,
  specializedModule: GEMINI_FLASH,
  finalComposer: GEMINI_FLASH,
  toneRewriter: GEMINI_LITE, // Deprecated - merged into finalComposer
} as const;

interface GeminiRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Get Gemini API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  return apiKey;
}

/**
 * Sleep helper for retry backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini API with retry logic
 */
export async function callGemini(
  prompt: string,
  options: {
    model?: string;
    timeout?: number;
    temperature?: number;
    maxTokens?: number;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const {
    model = "gemini-2.5-flash-lite",
    timeout = DEFAULT_TIMEOUT,
    temperature = 0.7,
    maxTokens = 2048,
    maxRetries = MAX_RETRIES,
  } = options;

  const apiKey = getApiKey();
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      topK: 40,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json()) as GeminiResponse;

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`
          );
        }

        // Retry on 5xx errors (server errors)
        if (response.status >= 500 && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `Gemini API 5xx error, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
          );
          await sleep(backoffMs);
          lastError = new Error(
            `Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`
          );
          continue;
        }

        throw new Error(
          `Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as GeminiResponse;

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!text) {
        throw new Error("Empty response from Gemini API");
      }

      return text;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`Gemini API call timed out after ${timeout}ms`);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `Gemini API call failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
        );
        await sleep(backoffMs);
        continue;
      }
    }
  }

  throw lastError || new Error("Gemini API call failed after all retries");
}

/**
 * Call Gemini with JSON-only response enforcement
 */
export async function callGeminiJson<T>(
  prompt: string,
  fallback: T,
  options: {
    model?: string;
    timeout?: number;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<T> {
  try {
    const response = await callGemini(prompt, options);

    // Extract JSON from response
    let cleaned = response.trim();

    // Remove markdown code fences
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    cleaned = cleaned.trim();

    // Try to find JSON in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn("callGeminiJson failed, using fallback:", error);
    return fallback;
  }
}

/**
 * Batch multiple Gemini calls with Promise.allSettled
 */
export async function callGeminiBatch<T>(
  prompts: Array<{
    prompt: string;
    fallback: T;
    options?: {
      model?: string;
      timeout?: number;
      temperature?: number;
    };
  }>
): Promise<T[]> {
  const results = await Promise.allSettled(
    prompts.map(({ prompt, fallback, options }) =>
      callGeminiJson<T>(prompt, fallback, options)
    )
  );

  return results.map((result, index) =>
    result.status === "fulfilled" ? result.value : prompts[index].fallback
  );
}

