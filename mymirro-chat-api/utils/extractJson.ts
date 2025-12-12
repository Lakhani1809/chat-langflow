/**
 * Strict JSON extraction utility for LLM responses
 * Handles common LLM response patterns like markdown code blocks
 */

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    let cleaned = raw.trim();

    // Remove markdown code fences if present
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    cleaned = cleaned.trim();

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn("JSON parse failed, using fallback:", error);
    return fallback;
  }
}

/**
 * Extract JSON object from text that might contain extra content
 */
export function extractJson<T>(text: string, fallback: T): T {
  try {
    // First, clean markdown fences
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    // Try to find JSON object
    const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      try {
        return JSON.parse(jsonObjectMatch[0]) as T;
      } catch {
        // Continue to try array
      }
    }

    // Try to find JSON array
    const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      try {
        return JSON.parse(jsonArrayMatch[0]) as T;
      } catch {
        // Continue to fallback
      }
    }

    // Try parsing the whole thing
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn("extractJson failed, using fallback");
    return fallback;
  }
}

/**
 * Extract and validate JSON with schema validation
 */
export function extractAndValidateJson<T>(
  text: string,
  fallback: T,
  requiredFields: string[]
): T {
  const parsed = extractJson<T>(text, fallback);

  // Check if required fields exist
  const hasAllFields = requiredFields.every(
    (field) =>
      parsed !== null &&
      typeof parsed === "object" &&
      field in (parsed as Record<string, unknown>)
  );

  if (!hasAllFields) {
    console.warn("Extracted JSON missing required fields, using fallback");
    return fallback;
  }

  return parsed;
}

/**
 * Parse JSON array stored as string (common in Supabase)
 */
export function parseJsonArray(str?: string | null): string[] {
  if (!str) return [];
  
  // If it's already an array, return it
  if (Array.isArray(str)) return str;
  
  try {
    // Handle single quotes (common in some DB exports)
    const normalized = str.replace(/'/g, '"');
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try splitting by comma as last resort
    if (str.includes(",")) {
      return str.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return str ? [str] : [];
  }
}

/**
 * Ensure response is strictly JSON and nothing else
 */
export function enforceStrictJson<T>(
  llmResponse: string,
  fallback: T,
  validator?: (obj: unknown) => boolean
): T {
  const extracted = extractJson<T>(llmResponse, fallback);

  if (validator && !validator(extracted)) {
    console.warn("JSON validation failed, using fallback");
    return fallback;
  }

  return extracted;
}

