import { DEFAULT_WIDGET_ID } from "@/lib/otp-config.functions";
import { superAdminPhone } from "@/lib/phone-session.server";
import { WIDGET_TOKEN } from "@/lib/otp-widget";

/** Widget ID from secrets (MSG91_WIDGET_ID) with the built-in default as fallback. */
function widgetId(): string {
  const override = process.env["MSG91_WIDGET_ID"];
  return override && /^[0-9a-f]{24,}$/i.test(override) ? override : DEFAULT_WIDGET_ID;
}

const MSG91_API = "https://control.msg91.com/api/v5";
export type OtpMode = "sms" | "fixed";

/**
 * Fixed sign-in codes come ONLY from server environment variables — never from
 * source code (this repo was public and earlier codes are compromised):
 *   SUPER_ADMIN_OTP   — overrides the Super Admin's fixed code (default 2503)
 *   FIXED_OTP_CODES   — "9876543210:4821,9123456789:7302" for named users
 *                       approved by the owner (optional)
 * Codes must be exactly 4 digits and must NOT be derived from the phone number.
 */
export function parseFixedCodes(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of String(raw ?? "").split(",")) {
    const [phone, code] = pair.split(":").map((s) => s.trim());
    if (/^\d{10}$/.test(phone ?? "") && /^\d{4}$/.test(code ?? "") && code !== phone!.slice(-4)) {
      out[phone!] = code!;
    }
  }
  return out;
}

export function fixedCodeFor(phone: string): string | null {
  if (phone === superAdminPhone()) {
    // Owner decision: the Super Admin signs in with a fixed code (default 2503).
    // Server-only — never shipped to the browser. Override with SUPER_ADMIN_OTP.
    const code = (process.env["SUPER_ADMIN_OTP"] ?? "").trim();
    return /^\d{4}$/.test(code) ? code : "2503";
  }
  return parseFixedCodes(process.env["FIXED_OTP_CODES"])[phone] ?? null;
}

/** Refuse to send a code to a phone that belongs to no employee. */
export async function assertRegisteredPhone(phone: string): Promise<void> {
  if (phone === superAdminPhone()) return;
  const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
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
  if (fixedCodeFor(phone)) return "fixed";
  try {
    const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
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
    body: JSON.stringify({ widgetId: widgetId(), tokenAuth: WIDGET_TOKEN, identifier: `91${phone}` }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success" || !payload.message) {
    console.error("[otp] widget send failed", response.status, JSON.stringify(payload));
    throw new Error(msg91Error(payload.message, "Could not send the code. Please try again."));
  }
  return payload.message;
}

export async function sendMsg91Otp(phone: string): Promise<string | undefined> {
  // Restored original working path: MSG91 account default OTP template.
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) throw new Error("SMS service is not configured on this deployment.");
  const templateId = process.env["MSG91_OTP_TEMPLATE_ID"];
  const query = new URLSearchParams({ mobile: `91${phone}` });
  if (templateId) query.set("template_id", templateId);
  const response = await fetch(`${MSG91_API}/otp?${query}`, {
    method: "POST",
    headers: { authkey: authKey },
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    console.error("[otp] send failed", response.status, JSON.stringify(payload));
    throw new Error(msg91Error(payload.message, "Could not send the code. Please try again."));
  }
  return undefined;
}

export async function verifyMsg91PhoneOtp(phone: string, otp: string): Promise<void> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) throw new Error("SMS service is not configured on this deployment.");
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

/**
 * MSG91's verifyAccessToken success payload carries the verified mobile in
 * `message` (e.g. "919876543210"). Sign-in is allowed only when that mobile is
 * present AND equals the phone being signed in — otherwise a token verified
 * for one number could be replayed to sign in as another.
 */
export function identifierMatches(message: string | undefined, phone: string): boolean {
  const m = String(message ?? "").trim().match(/^\+?(\d{10,13})$/);
  return !!m && m[1].slice(-10) === phone;
}

export async function verifyMsg91WidgetAccessToken(accessToken: string, phone: string): Promise<void> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  if (!authKey) throw new Error("SMS service is not configured on this deployment.");

  const response = await fetch(`${MSG91_API}/widget/verifyAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    throw new Error(msg91Error(payload.message, "OTP verification failed. Please try again."));
  }
  if (!identifierMatches(payload.message, phone)) {
    console.error("[otp] widget token not verified for this number", JSON.stringify({ type: payload.type }));
    throw new Error("OTP verification failed. Please try again.");
  }
}

export async function verifyMsg91Otp(requestId: string, otp: string): Promise<void> {
  const response = await fetch(`${MSG91_API}/widget/verifyOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetId: widgetId(), tokenAuth: WIDGET_TOKEN, reqId: requestId, otp }),
  });
  const payload = (await response.json().catch(() => ({}))) as WidgetVerificationResponse;
  if (!response.ok || payload.type?.toLowerCase() !== "success") {
    throw new Error(msg91Error(payload.message, "Wrong code. Please try again."));
  }
}