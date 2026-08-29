import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FALLBACK_OTP,
  OTP_LENGTH,
  SUPER_ADMIN_OTP,
  SUPER_ADMIN_OTP_PHONE as SUPER_ADMIN_PHONE,
} from "@/lib/otp-config";
import type { OtpMode } from "@/lib/otp.server";

/**
 * Phone OTP for sign-in.
 *
 * - Real OTPs are sent through MSG91 (API v5, account default template/sender),
 *   exactly like the working MSG91 widget flow — 4 digit codes.
 * - The super admin always signs in with the fixed code 2503 (never SMS).
 * - When Platform Settings → "MSG91 real OTP" is toggled OFF, every other user
 *   falls back to the fixed code 1111.
 */


export const sendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode }> => {
    const { callMsg91, resolveOtpMode } = await import("@/lib/otp.server");
    const mode = await resolveOtpMode(data.phone);
    if (mode === "fixed") return { mode };

    await callMsg91("send", data.phone);
    return { mode: "sms" };
  });

export const resendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode }> => {
    const { callMsg91, resolveOtpMode } = await import("@/lib/otp.server");
    const mode = await resolveOtpMode(data.phone);
    if (mode === "fixed") return { mode };

    await callMsg91("retry", data.phone);
    return { mode: "sms" };
  });

export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().regex(/^\d{10}$/),
        otp: z.string().regex(/^\d{4}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (data.phone === SUPER_ADMIN_PHONE) {
      if (data.otp !== SUPER_ADMIN_OTP) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    const { callMsg91, resolveOtpMode } = await import("@/lib/otp.server");
    if ((await resolveOtpMode(data.phone)) === "fixed") {
      if (data.otp !== FALLBACK_OTP) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    await callMsg91("verify", data.phone, data.otp);
    return { ok: true };
  });
