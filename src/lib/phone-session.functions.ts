/**
 * Removed: `restorePhoneSession` minted a session for ANY enabled phone number
 * without an OTP (and reset the account to a phone-derived password). Sessions
 * are now issued only by `verifyLoginOtp` after a verified code
 * (src/lib/otp.functions.ts) or by Super Admin impersonation.
 *
 * This module is intentionally empty so stale imports fail at build time.
 */
export {};
