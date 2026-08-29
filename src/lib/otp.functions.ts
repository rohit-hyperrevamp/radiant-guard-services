import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FALLBACK_OTP,
  SUPER_ADMIN_OTP,
  SUPER_ADMIN_OTP_PHONE as SUPER_ADMIN_PHONE,
} from "@/lib/otp-config";

/**
 * Phone OTP for sign-in.
 *
 * - Real OTPs are sent through MSG91 (API v5, account default template/sender),
 *   exactly like the working MSG91 widget flow — 4 digit codes.
 * - The super admin always signs in with the fixed code 2503 (never SMS).
 * - When Platform Settings → "MSG91 real OTP" is toggled OFF, every other user
 *   falls back to the fixed code 1111.
 */


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

async function resolveMode(phone: string): Promise<Mode> {
  if (phone === SUPER_ADMIN_PHONE) return "fixed";
  return (await isMsg91Enabled()) ? "sms" : "fixed";
}

export const sendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => phoneSchema.parse(input))
  .handler(async ({ data }): Promise<{ mode: Mode }> => {
    return { mode: await resolveMode(data.phone) };
  });

export const resendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => phoneSchema.parse(input))
  .handler(async ({ data }): Promise<{ mode: Mode }> => {
    return { mode: await resolveMode(data.phone) };
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

    // Real SMS codes are verified by the hosted MSG91 widget in the browser.
    // This server check confirms the setting did not switch to fixed mode
    // while the user was entering the code.
    return { ok: true };
  });
