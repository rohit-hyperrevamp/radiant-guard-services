import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/hooks/finance-refresh")({
  server: { handlers: {
    POST: async ({ request }) => {
      const key = request.headers.get("x-finance-key");
      if (!key || key.length > 256) return new Response("Unauthorized", { status: 401 });
      const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
      const { data, error } = await supabaseAdmin.from("finance_refresh_config" as never).select("hook_key,enabled").eq("id", true).maybeSingle();
      const config = data as { hook_key: string; enabled: boolean } | null;
      const hash = (value: string) => createHash("sha256").update(value).digest();
      if (error || !config?.enabled || !timingSafeEqual(hash(key), hash(config.hook_key))) return new Response("Unauthorized", { status: 401 });
      try {
        const { refreshFinanceSummaries } = await import("@/lib/finance-refresh.server");
        return Response.json(await refreshFinanceSummaries(), { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json({ error: "Finance refresh failed; saved figures have not been replaced" }, { status: 503 });
      }
    },
  } },
});