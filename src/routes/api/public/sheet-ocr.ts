import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { AttendanceOcrInputSchema, MigrationSheetInputSchema } from "@/lib/sheet-ocr-types";

/**
 * Sheet-reading (OCR) endpoint. Runs on this deployment with GEMINI_API_KEY.
 */

const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const VITE_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("migration"),
    accessToken: z.string().min(20),
    payload: MigrationSheetInputSchema,
  }),
  z.object({
    action: z.literal("muster"),
    accessToken: z.string().min(20),
    payload: AttendanceOcrInputSchema,
  }),
]);

function isAllowedOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.hostname === "radiant.hyperrevamp.com") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const headers = new Headers({
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  });
  if (origin && isAllowedOrigin(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function getBackendConfig() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || VITE_SUPABASE_URL;
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Sheet reading auth is not configured for this deployment.");
  }
  return { url, publishableKey };
}

async function authenticate(token: string) {
  const { url, publishableKey } = getBackendConfig();
  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", publishableKey);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return data.claims.sub;
}

export const Route = createFileRoute("/api/public/sheet-ocr")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const input = RequestSchema.parse(JSON.parse(rawBody));
          await authenticate(input.accessToken);

          if (input.action === "migration") {
            const { runMigrationSheetExtraction } = await import("@/lib/migration-sheet.server");
            return jsonResponse(request, await runMigrationSheetExtraction(input.payload));
          }

          const { runAttendanceOcr } = await import("@/lib/attendance-ocr.server");
          return jsonResponse(request, await runAttendanceOcr(input.payload));
        } catch (error) {
          if (error instanceof Response) {
            return jsonResponse(request, { error: await error.text() }, error.status);
          }
          const message = error instanceof Error ? error.message : String(error);
          return jsonResponse(request, { error: message }, 400);
        }
      },
    },
  },
});
