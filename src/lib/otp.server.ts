import { SUPER_ADMIN_OTP_PHONE } from "@/lib/otp-config";

const MSG91_API = "https://control.msg91.com/api/v5";
const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 10;

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

type Msg91Response = {
  type?: string;
  message?: string;
  request_id?: string;
};

async function callMsg91Api(path: string, method: "GET" | "POST" = "GET") {
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) {
    throw new Error("SMS service is not configured on this deployment.");
  }

  const response = await fetch(`${MSG91_API}/${path}`, {
    method,
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Msg91Response;
  if (!response.ok || payload.type?.toLowerCase() === "error") {
    throw new Error(payload.message || "Could not process the code. Please try again.");
  }
  return payload;
}

export async function callMsg91(
  action: Msg91Action,
  phone: string,
  otp?: string,
): Promise<void> {
  const mobile = `91${phone}`;

  if (action === "send" || action === "retry") {
    const params = new URLSearchParams({
      mobile,
      otp_length: String(OTP_LENGTH),
      otp_expiry: String(OTP_EXPIRY_MINUTES),
    });
    await callMsg91Api(`otp?${params.toString()}`, "POST");
    return;
  }

  if (!otp || otp.length !== OTP_LENGTH) throw new Error("Enter the 4-digit code.");
  const params = new URLSearchParams({ mobile, otp });
  await callMsg91Api(`otp/verify?${params.toString()}`);
}