import { createFileRoute } from "@tanstack/react-router";

/**
 * Public liveness probe for the login path. Deliberately reveals nothing about
 * credentials, configuration or the backend — detailed diagnostics belong in
 * server logs, not on an unauthenticated URL.
 */
export const Route = createFileRoute("/api/public/otp-health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }),
    },
  },
});
