import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createRateLimiter } from "@/lib/server-guards";
type OtpMode = "sms" | "fixed";

/**
 * Failed-attempt limit: 4-digit codes must not be brute-forceable. Keyed on
 * phone + client IP so a stranger can't lock the real user out of their own
 * number; cleared on a successful sign-in. In-memory per server instance (a
 * durable store would be stronger); 5 wrong codes = 15-minute lock.
 */
const failedOtp = createRateLimiter(5, 15 * 60_000);

/**
 * Phone OTP for sign-in.
 *
 * - Real OTPs use MSG91's configured Widget process (DLT template, SMS
 *   channel, four-digit length, retry, expiry). The browser widget returns an
 *   access token that the server re-verifies here, bound to the phone.
 * - Fixed codes exist only for numbers configured in server env vars
 *   (SUPER_ADMIN_OTP / FIXED_OTP_CODES) — never in source, never phone-derived.
 * - A Supabase session is minted ONLY by `verifyLoginOtp`, after the code is
 *   verified. There is no other way to obtain a session for a phone number.
 */

export const sendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode }> => {
    // The SMS itself is sent by MSG91's OTP Widget in the browser: that is the
    // only path that carries the account's default DLT template. Server-side
    // /otp sends are held by operators (MSG91 pause code 211).
    const { resolveOtpMode, assertRegisteredPhone } = await import("@/lib/otp.server");
    await assertRegisteredPhone(data.phone);
    const mode = await resolveOtpMode(data.phone);
    return { mode };
  });

export const resendLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(/^\d{10}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ mode: OtpMode }> => {
    const { resolveOtpMode, assertRegisteredPhone } = await import("@/lib/otp.server");
    await assertRegisteredPhone(data.phone);
    const mode = await resolveOtpMode(data.phone);
    return { mode };
  });

export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z.string().regex(/^\d{10}$/),
        otp: z.string().regex(/^\d{4}$/),
        accessToken: z.string().min(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ accessToken: string; refreshToken: string }> => {
    const {
      resolveOtpMode,
      verifyMsg91WidgetAccessToken,
      verifyMsg91PhoneOtp,
      fixedCodeFor,
      assertRegisteredPhone,
    } = await import("@/lib/otp.server");
    const { mintPhoneSession, superAdminPhone } = await import("@/lib/phone-session.server");

    const isSuperAdmin = data.phone === superAdminPhone();
    const fixed = fixedCodeFor(data.phone);
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = (getRequestIP({ xForwardedFor: true }) ?? "unknown").split(",")[0]!.trim();
    const lockKey = `otp:${data.phone}:${ip}`;
    if (!failedOtp.peek(lockKey)) {
      throw new Error("Too many wrong codes. Please wait 15 minutes and try again.");
    }
    const fail = (message: string): never => {
      failedOtp.take(lockKey);
      throw new Error(message);
    };

    if (fixed) {
      if (data.otp !== fixed) fail("Wrong code. Please try again.");
    } else {
      await assertRegisteredPhone(data.phone);
      if ((await resolveOtpMode(data.phone)) === "fixed") {
        throw new Error("SMS sign-in is temporarily unavailable. Please contact an administrator.");
      }
      try {
        if (data.accessToken) {
          await verifyMsg91WidgetAccessToken(data.accessToken, data.phone);
        } else {
          await verifyMsg91PhoneOtp(data.phone, data.otp);
        }
      } catch (e) {
        fail(e instanceof Error ? e.message : "Wrong code. Please try again.");
      }
    }

    // Verified — only now check the account is allowed in, then issue a session.
    if (!isSuperAdmin) {
      const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
      const eligibility = await supabaseAdmin.rpc("can_phone_login", { _mobile: data.phone });
      if (eligibility.error || eligibility.data !== true) {
        throw new Error("Access disabled. Your account is not active. Please contact your administrator.");
      }
    }
    const session = await mintPhoneSession(data.phone);
    failedOtp.reset(lockKey);
    return session;
  });
