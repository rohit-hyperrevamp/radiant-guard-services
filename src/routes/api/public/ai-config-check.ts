import { createFileRoute } from "@tanstack/react-router";

/** Temporary diagnostic: reports whether AI keys reach the server runtime. No values exposed. */
export const Route = createFileRoute("/api/public/ai-config-check")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            lovable: Boolean(process.env["LOVABLE_API_KEY"]?.trim()),
            gemini: Boolean(process.env["GEMINI_API_KEY"]?.trim()),
          }),
          { headers: { "content-type": "application/json" } },
        ),
    },
  },
});
