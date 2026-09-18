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
 * The attendance reader is a high-volume OCR task, not a reasoning task.
 * Flash Lite has materially lower vision latency and is available on the
 * company's Google account. Keep this to one model: silently trying a second
 * model can double the wait after a slow/failed first request.
 */
const ATTENDANCE_VISION_MODEL = "gemini-3.1-flash-lite";

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
 * Google. Fail visibly rather than silently replaying the same large image on a
 * second model; duplicate model calls make a single upload take several minutes.
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

  return run(provider(ATTENDANCE_VISION_MODEL));
}
