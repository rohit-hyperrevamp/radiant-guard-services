/**
 * Single source of truth for which AI account reads a document.
 *
 * Priority:
 *   1. GEMINI_API_KEY — the company's own Google Gemini key. All usage is
 *      billed directly to the company's Google account and never touches
 *      Lovable credits.
 *   2. LOVABLE_API_KEY — Lovable's AI gateway, kept only as a fallback so the
 *      app still works if the personal key is ever removed.
 *
 * Every document-reading feature must go through createVisionModel() so the
 * ordering stays in one place.
 */

/** Model used when calling Google directly with the company key. */
const DIRECT_MODEL = "gemini-3.6-flash";

/** Model used when falling back to the Lovable AI gateway. */
const GATEWAY_MODEL = "google/gemini-3.7-flash";

/** Stronger model for identity documents (Aadhaar / PAN). */
export const DIRECT_IDENTITY_MODEL = "gemini-3.1-pro-preview";

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
 * Build a vision-capable model handle.
 *
 * @param identity set true for Aadhaar / PAN style documents where accuracy
 *   matters more than speed or cost.
 */
export async function createVisionModel(identity = false) {
  const geminiKey = personalGeminiKey();
  if (geminiKey) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    return {
      model: createOpenAICompatible({
        name: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: geminiKey,
      })(identity ? DIRECT_IDENTITY_MODEL : DIRECT_MODEL),
      source: "gemini" as AiKeySource,
    };
  }

  const gatewayKey = lovableGatewayKey();
  if (gatewayKey) {
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    return {
      model: createLovableAiGatewayProvider(gatewayKey)(GATEWAY_MODEL),
      source: "gateway" as AiKeySource,
    };
  }

  throw new Error(
    "Sheet reading is not available on this deployment (missing AI key). Please contact support.",
  );
}
