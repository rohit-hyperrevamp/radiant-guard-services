import { createFileRoute } from "@tanstack/react-router";

/**
 * Read-only diagnostics for the login OTP path.
 *
 * Returns whether the SMS credential is present on the running deployment and
 * whether real SMS is toggled on. Never returns the credential itself.
 */
export const Route = createFileRoute("/api/public/otp-health")({
  server: {
    handlers: {
      GET: async () => {
        const authKey = process.env["MSG91_AUTH_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"] ?? null;

        let smsEnabled: boolean | null = null;
        let settingsError: string | null = null;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("inv_settings" as never)
            .select("value")
            .eq("key", "msg91_otp_enabled")
            .maybeSingle();
          if (error) settingsError = error.message;
          else {
            const value = (data as unknown as { value?: { enabled?: boolean } } | null)?.value;
            smsEnabled = data ? Boolean(value?.enabled ?? true) : true;
          }
        } catch (error) {
          settingsError = error instanceof Error ? error.message : "unknown";
        }

        return Response.json(
          {
            smsCredentialPresent: Boolean(authKey),
            smsCredentialLength: authKey ? authKey.length : 0,
            smsEnabled,
            settingsError,
            backend: supabaseUrl,
            checkedAt: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
