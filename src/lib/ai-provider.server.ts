/**
 * Single source of truth for the AI account that reads attendance sheets.
 *
 * Attendance sheet reading is the ONLY AI document feature. It goes directly to
 * Google Gemini using the company's own GEMINI_API_KEY — nothing is routed
 * through the Lovable AI gateway, so usage is billed only to the company's
 * Google account. Aadhaar / PAN identity checks use SurePass, not AI.
 */

import type { LanguageModel } from "ai";

/** Models tried, in order, when calling Google directly with the company key. */
const DIRECT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"];

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

/**
 * Run one attendance-sheet read against the company Gemini account, direct to
 * Google. Google occasionally throttles a single model, so each candidate model
 * gets its own attempt before the error is surfaced.
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

  let lastError: unknown;
  for (const name of options.identity ? IDENTITY_MODELS : DIRECT_MODELS) {
    try {
      return await run(provider(name));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
