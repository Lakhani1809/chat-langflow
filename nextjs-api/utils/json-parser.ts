/**
 * Robust JSON parser that handles common LLM response formats
 * Strips markdown code fences and handles parse errors gracefully
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    // Remove markdown code fences if present
    let cleaned = raw.trim();
    
    // Remove ```json and ``` markers
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    cleaned = cleaned.trim();
    
    // Try to parse
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn("JSON parse failed, using fallback:", error);
    return fallback;
  }
}

/**
 * Extract JSON from a response that might contain text before/after JSON
 */
export function extractJson<T>(text: string, fallback: T): T {
  try {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return safeJsonParse(jsonMatch[0], fallback);
    }
    return safeJsonParse(text, fallback);
  } catch {
    return fallback;
  }
}


