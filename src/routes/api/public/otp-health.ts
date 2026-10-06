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
        let employeeLookupOk: boolean | null = null;
        let generatedClientSeesEmployees: boolean | null = null;
        try {
          const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
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
          const people = await supabaseAdmin.from("candidates").select("id").limit(1);
          employeeLookupOk = !people.error && (people.data?.length ?? 0) > 0;
        } catch (error) {
          settingsError = error instanceof Error ? error.message : "unknown";
        }
        try {
          const generated = await import("@/integrations/supabase/client.server");
          const people = await generated.supabaseAdmin.from("candidates").select("id").limit(1);
          generatedClientSeesEmployees = !people.error && (people.data?.length ?? 0) > 0;
        } catch {
          generatedClientSeesEmployees = false;
        }

        return Response.json(
          {
            smsCredentialPresent: Boolean(authKey),
            smsCredentialLength: authKey ? authKey.length : 0,
            smsEnabled,
            settingsError,
            employeeLookupOk,
            generatedClientSeesEmployees,
            backend: supabaseUrl,
            checkedAt: new Date().toISOString(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
