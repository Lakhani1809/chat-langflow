/**
 * Gemini API client for LLM calls
 * Handles authentication, retries, and timeouts
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT = 8000; // 8 seconds
const MAX_RETRIES = 1;

interface GeminiRequest {
  model: string;
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini API with retry logic and timeout
 */
export async function callGemini(
  prompt: string,
  options: {
    apiKey: string;
    model?: string;
    timeout?: number;
    temperature?: number;
    maxRetries?: number;
  }
): Promise<string> {
  const {
    apiKey,
    model = "gemini-1.5-flash",
    timeout = DEFAULT_TIMEOUT,
    temperature = 0.7,
    maxRetries = MAX_RETRIES,
  } = options;

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: GeminiRequest = {
    model,
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
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
        
        // Don't retry on 4xx errors
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`
          );
        }

        // Retry on 5xx errors
        if (response.status >= 500 && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `Gemini API 5xx error, retrying after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
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

      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (!text) {
        throw new Error("Empty response from Gemini API");
      }

      return text;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Gemini API call timed out after ${timeout}ms`);
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Retry on network errors or 5xx
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `Gemini API call failed, retrying after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await sleep(backoffMs);
        continue;
      }
    }
  }

  throw lastError || new Error("Gemini API call failed after all retries");
}


