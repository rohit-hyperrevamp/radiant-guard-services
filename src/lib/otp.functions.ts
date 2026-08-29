import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Phone OTP for sign-in.
 *
 * - Real OTPs are sent through MSG91 (API v5, account default template/sender),
 *   exactly like the working MSG91 widget flow — 4 digit codes.
 * - The super admin always signs in with the fixed code 2503 (never SMS).
 * - When Platform Settings → "MSG91 real OTP" is toggled OFF, every other user
 *   falls back to the fixed code 1111.
 */

export const OTP_LENGTH = 4;
export const SUPER_ADMIN_OTP = "2503";
export const FALLBACK_OTP = "1111";
const SUPER_ADMIN_PHONE = "8373914073";

const MSG91_API = "https://control.msg91.com/api/v5";
const OTP_EXPIRY_MIN = 10;
const SETTING_KEY = "msg91_otp_enabled";

const phoneSchema = z.object({ phone: z.string().regex(/^\d{10}$/) });
const verifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
  otp: z.string().regex(/^\d{4}$/),
});

type Mode = "sms" | "fixed";

async function isMsg91Enabled(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings" as never)
      .select("enabled")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (error || !data) return true; // fail safe: real OTPs stay on
    return Boolean((data as unknown as { enabled?: boolean }).enabled ?? true);
  } catch {
    return true;
  }
}

async function msg91Call(path: string, method: "GET" | "POST" = "GET") {
  const authKey = process.env["MSG91_AUTH_KEY"] ?? "";
  if (!authKey) throw new Error("SMS service is not configured.");
  const res = await fetch(`${MSG91_API}/${path}`, {
    method,
    headers: { authkey: authKey, "Content-Type": "application/json" },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { message: text.slice(0, 300) };
  }
  const failed = !res.ok || String(data?.["type"] ?? "").toLowerCase() === "error";
  return { failed, data };
}

async function msg91Send(phone: string) {
  const params = new URLSearchParams({
    mobile: `91${phone}`,
    otp_length: String(OTP_LENGTH),
    otp_expiry: String(OTP_EXPIRY_MIN),
  });
  return msg91Call(`otp?${params.toString()}`, "POST");
}

async function resolveMode(phone: string): Promise<Mode> {
  if (phone === SUPER_ADMIN_PHONE) return "fixed";
  return (await isMsg91Enabled()) ? "sms" : "fixed";
}

export const sendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => phoneSchema.parse(input))
  .handler(async ({ data }): Promise<{ mode: Mode }> => {
    const mode = await resolveMode(data.phone);
    if (mode === "fixed") return { mode };

    const { failed, data: res } = await msg91Send(data.phone);
    if (failed) {
      throw new Error(
        String(res?.["message"] ?? "Could not send the code. Please try again."),
      );
    }
    return { mode: "sms" };
  });

export const resendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => phoneSchema.parse(input))
  .handler(async ({ data }): Promise<{ mode: Mode }> => {
    const mode = await resolveMode(data.phone);
    if (mode === "fixed") return { mode };

    // Start a fresh transaction rather than reviving an older request, so a
    // delayed SMS from a previous attempt cannot invalidate the new code.
    const { failed, data: res } = await msg91Send(data.phone);
    if (failed) {
      throw new Error(
        String(res?.["message"] ?? "Could not resend the code. Please try again."),
      );
    }
    return { mode: "sms" };
  });

export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => verifySchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (data.phone === SUPER_ADMIN_PHONE) {
      if (data.otp !== SUPER_ADMIN_OTP) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    if (!(await isMsg91Enabled())) {
      if (data.otp !== FALLBACK_OTP) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    const { failed, data: res } = await msg91Call(
      `otp/verify?mobile=91${data.phone}&otp=${data.otp}`,
    );
    if (failed) {
      throw new Error(String(res?.["message"] ?? "Wrong code. Please try again."));
    }
    return { ok: true };
  });
