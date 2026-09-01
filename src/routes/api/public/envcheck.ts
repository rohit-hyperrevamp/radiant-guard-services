import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({ hasKey: Boolean(process.env["LOVABLE_API_KEY"]) }),
          { headers: { "content-type": "application/json" } },
        ),
    },
  },
});
