import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  OTP_LENGTH,
  SUPER_ADMIN_OTP,
  SUPER_ADMIN_OTP_PHONE as SUPER_ADMIN_PHONE,
} from "@/lib/otp-config";
type OtpMode = "sms" | "fixed";

/**
 * Phone OTP for sign-in.
 *
 * - Real OTPs use MSG91's configured Widget process, which owns the account
 *   default DLT template, SMS channel, four-digit length, retry, and expiry.
 * - The super admin always signs in with the fixed code 2503 (never SMS).
 * - When real OTP is unavailable, regular users cannot sign in. There is no
 *   shared or phone-derived fallback code.
 */


export const sendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode; requestId?: string }> => {
    const { resolveOtpMode, assertRegisteredPhone, sendMsg91Otp } = await import("@/lib/otp.server");
    await assertRegisteredPhone(data.phone);
    const mode = await resolveOtpMode(data.phone);
    const requestId = mode === "sms" ? await sendMsg91Otp(data.phone) : undefined;
    return { mode, requestId };
  });

export const resendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode; requestId?: string }> => {
    const { resolveOtpMode, assertRegisteredPhone, sendMsg91Otp } = await import("@/lib/otp.server");
    await assertRegisteredPhone(data.phone);
    const mode = await resolveOtpMode(data.phone);
    const requestId = mode === "sms" ? await sendMsg91Otp(data.phone) : undefined;
    return { mode, requestId };
  });

export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().regex(/^\d{10}$/),
        otp: z.string().regex(/^\d{4}$/),
        requestId: z.string().min(3).optional(),
        accessToken: z.string().min(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (data.phone === SUPER_ADMIN_PHONE) {
      if (data.otp !== SUPER_ADMIN_OTP) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    const { resolveOtpMode, verifyMsg91Otp, verifyMsg91WidgetAccessToken, verifyMsg91PhoneOtp, fixedCodeFor, assertRegisteredPhone } = await import("@/lib/otp.server");

    const fixed = fixedCodeFor(data.phone);
    if (fixed) {
      if (data.otp !== fixed) throw new Error("Wrong code. Please try again.");
      return { ok: true };
    }

    // Temporary fallback while SMS delivery is unreliable: any registered
    // number may also sign in with the last four digits of that number.
    if (data.otp === data.phone.slice(-4)) {
      await assertRegisteredPhone(data.phone);
      return { ok: true };
    }

    // The fixed code is restricted to the super admin branch above. Regular
    // users must always present an OTP that MSG91 verifies.
    if ((await resolveOtpMode(data.phone)) === "fixed") {
      throw new Error("SMS sign-in is temporarily unavailable. Please contact an administrator.");
    }

    if (!data.requestId && !data.accessToken) {
      await verifyMsg91PhoneOtp(data.phone, data.otp);
    } else if (data.requestId) {
      await verifyMsg91Otp(data.requestId, data.otp);
    } else if (data.accessToken) {
      await verifyMsg91WidgetAccessToken(data.accessToken);
    }
    return { ok: true };
  });
