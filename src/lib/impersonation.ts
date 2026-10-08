import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";

const IMP_KEY = "radiant.impersonator";
const AUTH_KEY = "radiant.auth";

export type ImpersonationState = {
  adminPhone: string;
  adminRefreshToken: string;
  adminAccessToken: string;
  target: { phone: string; fullName: string; employeeCode: string; roleKey: string };
  startedAt: string;
};

export function readImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMP_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

// Large best-effort caches (employee/unit snapshots, translations, dashboard
// counts) can fill browser storage; free them so sign-in data always fits.
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return;
  } catch {
    const keep = new Set([IMP_KEY, AUTH_KEY]);
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k || keep.has(k) || k.startsWith("sb-")) continue;
      window.localStorage.removeItem(k);
    }
    window.localStorage.setItem(key, value);
  }
}

function hardReload(to: string) {
  window.location.assign(to);
}

export async function beginImpersonation(
  tokens: { accessToken: string; refreshToken: string },
  target: ImpersonationState["target"],
) {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s) throw new Error("Your session has expired. Please sign in again.");
  const adminPhone =
    (JSON.parse(window.localStorage.getItem(AUTH_KEY) ?? "null")?.phone as string | undefined) ?? "";
  await logActivity({
    module: "View as User",
    action: "open",
    entityType: "user",
    entityLabel: `${target.fullName} (${target.employeeCode || target.phone})`,
  });
  const state: ImpersonationState = {
    adminPhone,
    adminRefreshToken: s.refresh_token,
    adminAccessToken: s.access_token,
    target,
    startedAt: new Date().toISOString(),
  };
  safeSet(IMP_KEY, JSON.stringify(state));
  const res = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (res.error) {
    window.localStorage.removeItem(IMP_KEY);
    await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    throw res.error;
  }
  safeSet(AUTH_KEY, JSON.stringify({ phone: `+91${target.phone}`, role: "user" }));
  hardReload("/");
}

export async function endImpersonation() {
  const st = readImpersonation();
  if (!st) return;
  // Local-only sign out so the employee's own devices stay signed in.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  const res = await supabase.auth.setSession({
    access_token: st.adminAccessToken,
    refresh_token: st.adminRefreshToken,
  });
  window.localStorage.removeItem(IMP_KEY);
  if (res.error || !res.data.session) {
    window.localStorage.removeItem(AUTH_KEY);
    hardReload("/login");
    return;
  }
  safeSet(AUTH_KEY, JSON.stringify({ phone: st.adminPhone, role: "super_admin" }));
  await logActivity({
    module: "View as User",
    action: "logout",
    entityType: "user",
    entityLabel: `${st.target.fullName} (${st.target.employeeCode || st.target.phone})`,
  }).catch(() => undefined);
  hardReload("/admin/dashboard");
}
