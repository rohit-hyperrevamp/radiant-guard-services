import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, getClientIp } from "@/lib/activity-log";

const STORAGE_KEY = "radiant.auth";
const AUTH_TIMEOUT_MS = 12_000;
const IP_LOOKUP_TIMEOUT_MS = 1_500;
/**
 * Sign-in: the code is verified server-side in `src/lib/otp.functions.ts`,
 * which is also the only place a Supabase session is issued. This module
 * adopts that session and keeps it alive.
 *
 * SUPER_ADMIN_PHONE only drives client-side UI defaults; real authorisation is
 * enforced by the database (RLS) and server functions.
 */
export const SUPER_ADMIN_PHONE =
  (import.meta.env.VITE_SUPER_ADMIN_PHONE as string | undefined) ??
  "8373914073";

export type AuthUser = { phone: string; role: "super_admin" | "user" };

export function readStoredAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Only a confirmed server-side employment block ends otherwise recoverable sessions. */
export async function checkEmploymentAccess(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return true;
  const { data, error } = await supabase.rpc("guard_absence_access_allowed" as never);
  if (error || data !== false) return true; // Offline/undeployed rule is not evidence of a block.
  manualSignOut = true;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem("radiant.impersonator");
  await supabase.auth.signOut({ scope: "local" });
  emit();
  return false;
}

// A session is only ever abandoned when the user taps Log out. Everything else
// (offline refresh, background app, flaky network, slow storage broker) is
// treated as recoverable so a refresh can never silently sign somebody out.
let manualSignOut = false;
const isAuthHardFailure = (message: string) => {
  const m = message.toLowerCase();
  return (
    m.includes("invalid refresh token") ||
    m.includes("refresh token not found") ||
    m.includes("already used") ||
    m.includes("user not found") ||
    m.includes("user banned")
  );
};

/** Best-effort session recovery; resolves true when a session is live. */
async function recoverSession(attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return true;
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.user) return true;
    const message = refreshed.error?.message ?? "";
    // A genuinely revoked/expired refresh token is the only reason to give up.
    if (message && isAuthHardFailure(message)) return false;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return false;
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function withTimeout<T>(promise: Promise<T>, message: string, ms = AUTH_TIMEOUT_MS) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function resolveClientIpQuickly() {
  return Promise.race<string>([
    getClientIp(),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve(""), IP_LOOKUP_TIMEOUT_MS);
    }),
  ]).catch(() => "");
}

async function authUserFromSession(): Promise<AuthUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    const stored = readStoredAuthUser();
    // Storage brokering / token refresh can be momentarily unavailable. Try to
    // bring the session back before treating the user as signed out.
    if (stored && !manualSignOut) {
      const ok = await recoverSession();
      if (ok) return stored;
      // Still no session but nothing proved the login invalid — stay signed in
      // and let the next refresh attempt recover it.
      return stored;
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }

  const stored = readStoredAuthUser();
  if (stored) return stored;

  const email = session.user.email ?? "";
  const match = email.match(/^phone-(\d{10})@radiantguard\.local$/i);
  if (!match) return null;

  const phone = `+91${match[1]}`;
  const user: AuthUser = {
    phone,
    role: match[1] === SUPER_ADMIN_PHONE ? "super_admin" : "user",
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  return user;
}

export type SessionTokens = { accessToken: string; refreshToken: string };

/**
 * Establishes the Supabase session for `phone`.
 *
 * - With `tokens` (issued by verifyLoginOtp after a verified code): adopt them.
 * - Without tokens (Face ID unlock): only re-open a session that already
 *   exists on this device for the SAME phone. There is no way to obtain a new
 *   session from a phone number alone.
 */
async function ensureSupabaseSession(phone: string, tokens?: SessionTokens) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (tokens) {
    const set = await withTimeout(
      supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }),
      "Login is taking too long. Please try again.",
    );
    if (set.error || !set.data.session) {
      throw set.error ?? new Error("Could not establish a secure session.");
    }
    return;
  }
  const live = await recoverSession(2);
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email ?? "";
  if (!live || email.toLowerCase() !== phoneIdentityEmailFor(digits)) {
    throw new Error("Your session has expired. Please sign in with the OTP sent to your phone.");
  }
}

function phoneIdentityEmailFor(digits: string): string {
  return `phone-${digits}@radiantguard.local`;
}

export function useAuth() {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Supabase emits auth events on every token refresh and tab focus. Writing
    // a freshly parsed (but identical) user object each time re-rendered the
    // whole admin shell and made large screens like the payroll register
    // flicker. Only change state when the identity actually changes.
    const setUser = (next: AuthUser | null) => {
      setUserState((prev) =>
        JSON.stringify(prev ?? null) === JSON.stringify(next ?? null) ? prev : next,
      );
    };
    const syncStoredUser = () => {
      if (!active) return;
      setUser(readStoredAuthUser());
    };


    const syncFromSession = async () => {
      try {
        const nextUser = await authUserFromSession();
        if (!active) return;
        setUser(nextUser);
      } finally {
        if (!active) return;
        setIsReady(true);
      }
    };

    listeners.add(syncStoredUser);
    window.addEventListener("storage", syncStoredUser);

    void syncFromSession().catch(() => {
      if (!active) return;
      setUser(null);
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (!session?.user) {
        const stored = readStoredAuthUser();
        // Only an explicit Log out ends the session. A null session from a
        // failed/expired refresh is recovered in the background.
        if (stored && !manualSignOut && event !== "SIGNED_OUT") {
          setUser(stored);
          setIsReady(true);
          void recoverSession();
          return;
        }
        if (stored && !manualSignOut && event === "SIGNED_OUT") {
          setUser(stored);
          setIsReady(true);
          void recoverSession().then((ok) => {
            if (!active || ok) return;
            window.localStorage.removeItem(STORAGE_KEY);
            setUser(null);
          });
          return;
        }
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setIsReady(true);
        return;
      }

      const stored = readStoredAuthUser();
      if (stored) {
        setUser(stored);
        setIsReady(true);
        return;
      }

      const email = session.user.email ?? "";
      const match = email.match(/^phone-(\d{10})@radiantguard\.local$/i);
      if (!match) {
        setUser(null);
        setIsReady(true);
        return;
      }

      const nextUser: AuthUser = {
        phone: `+91${match[1]}`,
        role: match[1] === SUPER_ADMIN_PHONE ? "super_admin" : "user",
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      setIsReady(true);
    });

    // Keep the session warm: phones suspend timers while the app is in the
    // background, so refresh on resume, on reconnect, and periodically.
    const keepAlive = () => {
      if (!active || manualSignOut || !readStoredAuthUser()) return;
      void recoverSession(1);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") keepAlive();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", keepAlive);
    window.addEventListener("online", keepAlive);
    const keepAliveTimer = setInterval(keepAlive, 10 * 60_000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", keepAlive);
      window.removeEventListener("online", keepAlive);
      clearInterval(keepAliveTimer);
      listeners.delete(syncStoredUser);
      window.removeEventListener("storage", syncStoredUser);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (phone: string, tokens?: SessionTokens) => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const role: AuthUser["role"] =
      digits === SUPER_ADMIN_PHONE ? "super_admin" : "user";
    const ipPromise = resolveClientIpQuickly();
    manualSignOut = false;
    try {
      await ensureSupabaseSession(phone, tokens);
    } catch (e) {
      void ipPromise.then((ip) =>
        logActivity({
          module: "Authentication",
          action: "login",
          entityType: "user",
          entityLabel: phone,
          userPhone: phone,
          userRole: role,
          ip,
          status: "failure",
          errorMessage: e instanceof Error ? e.message : String(e),
        }),
      );
      throw e;
    }
    const u: AuthUser = { phone, role };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    // If a different phone had biometric enabled on this device, wipe it so
    // the next Face ID prompt can't sign in as the previous user.
    void (async () => {
      try {
        const { getStoredBiometricPhone, disableBiometric } = await import("./biometric");
        const stored = await getStoredBiometricPhone();
        if (stored) {
          const storedDigits = stored.replace(/\D/g, "").slice(-10);
          if (storedDigits && storedDigits !== digits) {
            await disableBiometric();
          }
        }
      } catch {
        /* noop */
      }
    })();
    void ipPromise.then((ip) =>
      logActivity({
        module: "Authentication",
        action: "login",
        entityType: "user",
        entityLabel: phone,
        userPhone: phone,
        userRole: role,
        ip,
      }),
    );
    emit();
  }, []);

  const logout = useCallback(() => {
    const current = readStoredAuthUser();
    void logActivity({
      module: "Authentication",
      action: "logout",
      entityType: "user",
      entityLabel: current?.phone ?? "",
      userPhone: current?.phone ?? "",
      userRole: current?.role ?? "",
    });
    manualSignOut = true;
    const impersonating = !!window.localStorage.getItem("radiant.impersonator");
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("radiant.impersonator");
    // While viewing as someone, only end this device's session — never the employee's own.
    void supabase.auth.signOut(impersonating ? { scope: "local" } : undefined);
    emit();
  }, []);

  return { user, login, logout, isReady };
}
