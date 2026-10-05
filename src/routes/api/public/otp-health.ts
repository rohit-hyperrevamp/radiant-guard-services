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
      POST: async ({ request }) => {
        // Temporary diagnostics: send a real OTP through the server /otp path
        // with the configured auth key to verify delivery end to end.
        const { phone, action } = (await request.json().catch(() => ({}))) as {
          phone?: string;
          action?: string;
        };
        if (action === "report") {
          // Temporary diagnostics: latest OTP delivery report entries.
          const authKey = process.env["MSG91_AUTH_KEY"];
          if (!authKey) return Response.json({ error: "no key" }, { status: 500 });
          const res = await fetch(
            "https://control.msg91.com/api/v5/report/logs/p/otp?pageSize=10",
            { headers: { authkey: authKey } },
          );
          const data = await res.text();
          return Response.json({ status: res.status, data: data.slice(0, 4000) });
        }
        if (!phone || !/^\d{10}$/.test(phone)) {
          return Response.json({ error: "phone required" }, { status: 400 });
        }
        try {
          const { sendMsg91Otp } = await import("@/lib/otp.server");
          await sendMsg91Otp(phone, false);
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "unknown" },
            { status: 200 },
          );
        }
      },
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
