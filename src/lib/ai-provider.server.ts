/**
 * Single source of truth for the AI account that reads attendance sheets.
 *
 * Attendance sheet reading is the ONLY AI document feature. It goes directly to
 * Google Gemini using the company's own GEMINI_API_KEY — nothing is routed
 * through the Lovable AI gateway, so usage is billed only to the company's
 * Google account. Aadhaar / PAN identity checks use SurePass, not AI.
 */

import type { LanguageModel } from "ai";

/**
 * Attendance data feeds invoicing, so accuracy outranks latency here. The
 * lite-tier vision model transcribes acceptably but is unreliable at copying
 * identifiers and following an exact output shape, which silently drops rows.
 * Use the full Flash model, and only fall back when Google itself is
 * overloaded (503) — never as a silent quality downgrade on a good response.
 */
const ATTENDANCE_VISION_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"] as const;

export type AiKeySource = "gemini";

function personalGeminiKey(): string {
  return process.env["GEMINI_API_KEY"]?.trim() || "";
}

/** True when the company Gemini account is configured. */
export function aiKeyConfigured(): boolean {
  return Boolean(personalGeminiKey());
}

/** Which account would be used right now. */
export function activeAiKeySource(): AiKeySource | null {
  return personalGeminiKey() ? "gemini" : null;
}

function isOverloaded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /503|overload|unavailable|high demand|429|rate limit/i.test(message);
}

/**
 * Run one attendance-sheet read against the company Gemini account, direct to
 * Google. Only retry when Google reports the model as overloaded/rate limited —
 * a genuine failure surfaces instead of being masked by a weaker model.
 */
export async function runVision<T>(
  run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  const geminiKey = personalGeminiKey();

  if (!geminiKey) {
    throw new Error(
      "Document reading is not available: the Google Gemini key is not configured.",
    );
  }

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const provider = createOpenAICompatible({
    name: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: geminiKey,
  });

  let lastError: unknown = null;
  for (const modelId of ATTENDANCE_VISION_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await run(provider(modelId));
      } catch (error) {
        lastError = error;
        if (!isOverloaded(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Sheet reading failed: the reader is busy, please retry.");
}
