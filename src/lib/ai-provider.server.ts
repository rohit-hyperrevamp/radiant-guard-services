/**
 * Single source of truth for which AI account reads a document.
 *
 * Priority:
 *   1. GEMINI_API_KEY — the company's own Google Gemini key. All usage is
 *      billed directly to the company's Google account and never consumes
 *      Lovable credits.
 *   2. LOVABLE_API_KEY — Lovable's AI gateway, kept only as a fallback so the
 *      app still works if the company key is ever removed.
 *
 * Every document-reading feature must go through runVision() so the ordering
 * and the retry behaviour stay in one place.
 */

import type { LanguageModel } from "ai";

/** Models tried, in order, when calling Google directly with the company key. */
const DIRECT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"];

/** Identity documents prefer the stronger model, then drop to the flash models. */
const IDENTITY_MODELS = ["gemini-3.1-pro-preview", ...DIRECT_MODELS];

/** Model used when falling back to the Lovable AI gateway. */
const GATEWAY_MODEL = "google/gemini-3.7-flash";

export type AiKeySource = "gemini" | "gateway";

function personalGeminiKey(): string {
  return process.env["GEMINI_API_KEY"]?.trim() || "";
}

function lovableGatewayKey(): string {
  return process.env["LOVABLE_API_KEY"]?.trim() || "";
}

/** True when at least one AI account is configured. */
export function aiKeyConfigured(): boolean {
  return Boolean(personalGeminiKey() || lovableGatewayKey());
}

/** Which account would be used right now. */
export function activeAiKeySource(): AiKeySource | null {
  if (personalGeminiKey()) return "gemini";
  if (lovableGatewayKey()) return "gateway";
  return null;
}

/**
 * Run one AI call against the company Gemini account, falling back to the
 * Lovable gateway only when no company key is configured.
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
    const gatewayKey = lovableGatewayKey();
    if (!gatewayKey) {
      throw new Error(
        "Sheet reading is not available on this deployment (missing AI key). Please contact support.",
      );
    }
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    return run(createLovableAiGatewayProvider(gatewayKey)(GATEWAY_MODEL));
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
