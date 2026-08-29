import { SUPER_ADMIN_OTP_PHONE } from "@/lib/otp-config";

const MSG91_ENDPOINT =
  "https://ogmhspwsvzvwqoavlxjn.supabase.co/functions/v1/msg91-otp";
const MSG91_PUBLISHABLE_KEY = "sb_publishable_poMI4GzypzM-3Y4znIJDEA_ocG6BARb";

type Msg91Action = "send" | "retry" | "verify";
export type OtpMode = "sms" | "fixed";

export async function resolveOtpMode(phone: string): Promise<OtpMode> {
  if (phone === SUPER_ADMIN_OTP_PHONE) return "fixed";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings" as never)
      .select("enabled")
      .eq("key", "msg91_otp_enabled")
      .maybeSingle();
    if (error || !data) return "sms";
    return Boolean((data as unknown as { enabled?: boolean }).enabled ?? true)
      ? "sms"
      : "fixed";
  } catch {
    return "sms";
  }
}

export async function callSharedMsg91(
  action: Msg91Action,
  phone: string,
  otp?: string,
): Promise<void> {
  const response = await fetch(MSG91_ENDPOINT, {
    method: "POST",
    headers: {
      apikey: MSG91_PUBLISHABLE_KEY,
      Authorization: `Bearer ${MSG91_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      identifier: `91${phone}`,
      ...(otp ? { otp } : {}),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error || payload.message || "Could not process the code. Please try again.",
    );
  }
}