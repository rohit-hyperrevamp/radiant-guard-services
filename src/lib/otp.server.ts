import { SUPER_ADMIN_OTP_PHONE } from "@/lib/otp-config";
import { WIDGET_ID, WIDGET_TOKEN } from "@/lib/otp-widget";

const MSG91_API = "https://control.msg91.com/api/v5";
const OTP_RELAY_URL = "https://radiant-guard-services.lovable.app/api/public/otp-relay";
export type OtpMode = "sms" | "fixed";

/** Named users approved to sign in with a fixed code (last 4 digits of their phone). */
const FIXED_CODE_PHONES: Record<string, string> = {
  "7517551288": "1288", // Ritesh (49551), VP Operations — approved by owner
  "9175292300": "2300", // Prachi Bendge (32224) — approved by owner
};

export function fixedCodeFor(phone: string): string | null {
  return FIXED_CODE_PHONES[phone] ?? null;
}

/** Refuse to send a code to a phone that belongs to no employee. */
export async function assertRegisteredPhone(phone: string): Promise<void> {
  if (phone === SUPER_ADMIN_OTP_PHONE) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .in("mobile", [phone, `+91${phone}`, `91${phone}`, `0${phone}`])
    .limit(1);
  if (error) return; // fail open on lookup errors; verification still gates sign-in
  if (!data || data.length === 0) {
    throw new Error("This mobile number is not registered. Please contact your administrator.");
  }
}

export async function resolveOtpMode(phone: string): Promise<OtpMode> {
  if (phone === SUPER_ADMIN_OTP_PHONE || FIXED_CODE_PHONES[phone]) return "fixed";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("inv_settings" as never)
      .select("value")
      .eq("key", "msg91_otp_enabled")
      .maybeSingle();
    if (error || !data) return "sms";
    const value = (data as unknown as { value?: { enabled?: boolean } }).value;
    return Boolean(value?.enabled ?? true)
      ? "sms"
      : "fixed";
  } catch {
    return "sms";
  }
}

type WidgetVerificationResponse = {
  type?: string;
  status?: string;
  message?: string;
};

function msg91Error(message: string | undefined, fallback: string): string {
  if (message?.toLowerCase().includes("ipblocked")) {
    return "This network was blocked by the SMS provider. Please resend the code.";
  }
  return message || fallback;
}

async function relayOtp(action: "send" | "verify", phone: string, otp?: string): Promise<void> {
  const response = await fetch(OTP_RELAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-radiant-caller": "radiant-production-shell",
    },
    body: JSON.stringify({ action, phone, otp }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok) throw new Error(msg91Error(payload.message, "SMS service is unavailable. Please try again."));
}

/**
 * DLT-approved MSG91 OTP template. Indian operators hold any OTP SMS that is
 * not tied to a registered DLT template (MSG91 report: status Pending,
 * pause "code: 211", DLT_TE_ID null), so every send must carry it.
 * Template IDs are not secrets; MSG91_OTP_TEMPLATE_ID overrides this value.
 */
const MSG91_OTP_TEMPLATE_ID = "";

/** Send through the configured MSG91 OTP Widget, which applies the account's DLT template. Returns the request ID. */
export async function sendMsg91WidgetOtp(phone: string): Promise<string> {
  const response = await fetch(`${MSG91_API}/widget/sendOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetId: WIDGET_ID, tokenAuth: WIDGET_TOKEN, identifier: `91${phone}` }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success" || !payload.message) {
    console.error("[otp] widget send failed", response.status, JSON.stringify(payload));
    throw new Error(msg91Error(payload.message, "Could not send the code. Please try again."));
  }
  return payload.message;
}

export async function sendMsg91Otp(phone: string, allowRelay = true): Promise<string | undefined> {
  const configuredTemplate = process.env["MSG91_OTP_TEMPLATE_ID"] || MSG91_OTP_TEMPLATE_ID;
  if (!configuredTemplate) {
    try {
      return await sendMsg91WidgetOtp(phone);
    } catch (e) {
      console.warn("[otp] widget send unavailable, using account default OTP template", e);
    }
  }
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) {
    if (allowRelay) {
      await relayOtp("send", phone);
      return undefined;
    }
    throw new Error("SMS service is not configured on this deployment.");
  }
  const templateId = process.env["MSG91_OTP_TEMPLATE_ID"] || MSG91_OTP_TEMPLATE_ID;
  // Without a template ID, MSG91 uses the account's default OTP template.
  const query = new URLSearchParams({ mobile: `91${phone}`, otp_length: "4" });
  if (templateId) query.set("template_id", templateId);
  const response = await fetch(`${MSG91_API}/otp?${query}`, {
    method: "POST",
    headers: { authkey: authKey },
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    throw new Error(msg91Error(payload.message, "Could not send the code. Please try again."));
  }
  return undefined;
}

export async function verifyMsg91PhoneOtp(
  phone: string,
  otp: string,
  allowRelay = true,
): Promise<void> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) {
    if (allowRelay) return relayOtp("verify", phone, otp);
    throw new Error("SMS service is not configured on this deployment.");
  }
  const query = new URLSearchParams({ mobile: `91${phone}`, otp });
  const response = await fetch(`${MSG91_API}/otp/verify?${query}`, {
    method: "GET",
    headers: { authkey: authKey },
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    throw new Error(msg91Error(payload.message, "Wrong code. Please try again."));
  }
}

export async function verifyMsg91WidgetAccessToken(accessToken: string): Promise<void> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) throw new Error("SMS service is not configured on this deployment.");

  const response = await fetch(`${MSG91_API}/widget/verifyAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (
    !response.ok ||
    payload.type?.toLowerCase() === "error" ||
    payload.status?.toLowerCase() === "error"
  ) {
    throw new Error(msg91Error(payload.message, "OTP verification failed. Please try again."));
  }
}

export async function verifyMsg91Otp(requestId: string, otp: string): Promise<void> {
  const response = await fetch(`${MSG91_API}/widget/verifyOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetId: WIDGET_ID, tokenAuth: WIDGET_TOKEN, reqId: requestId, otp }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    throw new Error(msg91Error(payload.message, "Wrong code. Please try again."));
  }
}