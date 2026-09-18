/**
 * Single source of truth for which AI account reads a document.
 *
 * All document reading goes directly to Google Gemini using the company's own
 * GEMINI_API_KEY. Nothing is routed through the Lovable AI gateway, so usage is
 * billed only to the company's Google account.
 *
 * Every document-reading feature must go through runVision() so the model
 * ordering and retry behaviour stay in one place.
 */

import type { LanguageModel } from "ai";

/** Models tried, in order, when calling Google directly with the company key. */
const DIRECT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"];

/** Identity documents prefer the stronger model, then drop to the flash models. */
const IDENTITY_MODELS = ["gemini-3.1-pro-preview", ...DIRECT_MODELS];

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
 * Run one AI call against the company Gemini account, direct to Google.
 *
 * Google occasionally returns "high demand" or throttles a single model, so
 * each candidate model gets its own attempt before the error is surfaced.
 *
 * @param run   callback that performs the actual generation with a model
 * @param identity set true for Aadhaar / PAN style documents where accuracy
 *   matters more than speed or cost
 */
export async function runVision<T>(
  run: (model: LanguageModel) => Promise<T>,
  options: { identity?: boolean } = {},
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
