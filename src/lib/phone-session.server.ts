/**
 * Server-only: mint a Supabase session for a phone identity.
 *
 * Only call this AFTER the caller has proven who they are — a verified OTP
 * (verifyLoginOtp) or a verified Super Admin (startImpersonation). It must
 * never be reachable from an unauthenticated endpoint.
 *
 * Identities are `phone-<10 digits>@radiantguard.local`. New identities get a
 * random password: sign-in never uses passwords, so nothing can be derived
 * from the phone number.
 */
export type MintedSession = { accessToken: string; refreshToken: string };

export function phoneIdentityEmail(phone: string): string {
  return `phone-${phone}@radiantguard.local`;
}

export function randomPassword(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function mintPhoneSession(phone: string): Promise<MintedSession> {
  if (!/^\d{10}$/.test(phone)) throw new Error("Invalid mobile number.");
  const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
  const email = phoneIdentityEmail(phone);

  let link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) {
    // Identity not created yet (never signed in) — create it, then retry.
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
    });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      throw new Error("Could not prepare this account.");
    }
    link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  }
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) throw new Error("Could not start a secure session.");

  // For an identity that has never signed in, the auth service may issue a
  // *signup* confirmation token rather than a magic-link token — verify with
  // the type it actually issued.
  const issued = String(link.data?.properties?.verification_type ?? "magiclink");
  const otpType = (issued === "signup" ? "signup" : "magiclink") as "signup" | "magiclink";
  let signedIn = await supabaseAdmin.auth.verifyOtp({ type: otpType, token_hash: tokenHash });
  if ((signedIn.error || !signedIn.data.session) && otpType === "magiclink") {
    const retry = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const h = retry.data?.properties?.hashed_token;
    if (h) signedIn = await supabaseAdmin.auth.verifyOtp({ type: "signup", token_hash: h });
  }
  if (signedIn.error || !signedIn.data.session) {
    console.error("[phone-session] verify failed", issued, signedIn.error?.message);
    throw new Error("Could not start a secure session.");
  }
  return {
    accessToken: signedIn.data.session.access_token,
    refreshToken: signedIn.data.session.refresh_token,
  };
}

/** Super Admin phone, from server env (kept out of the browser bundle where possible). */
export function superAdminPhone(): string {
  return (process.env["SUPER_ADMIN_PHONE"] || process.env["VITE_SUPER_ADMIN_PHONE"] || "8373914073").trim();
}
