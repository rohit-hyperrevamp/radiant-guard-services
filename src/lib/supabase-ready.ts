import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase restores the persisted session from localStorage asynchronously.
 * Any query fired during the first render therefore goes out WITHOUT the
 * bearer token, and RLS silently returns zero rows (no error) — which is why
 * pages showed 0s until a second refresh.
 *
 * `supabaseSessionReady()` resolves once the client has hydrated its session,
 * so callers can await it before hitting the Data API. A "no session" answer
 * is never cached: the next call checks again, so a recovered session is seen.
 */
let readyPromise: Promise<boolean> | null = null;

export function supabaseSessionReady(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!readyPromise) {
    readyPromise = supabase.auth
      .getSession()
      .then(({ data }) => {
        const ok = !!data.session;
        if (!ok) readyPromise = null;
        return ok;
      })
      .catch(() => {
        readyPromise = null;
        return false;
      });
  }
  return readyPromise;
}

/**
 * True only while a real Supabase session (bearer token) exists. The app can
 * keep showing a remembered user while the token is being recovered; data
 * queries must wait for this instead, or they come back as zeros.
 */
export function useHasSupabaseSession(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHas(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHas(!!session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return has;
}

/**
 * Calls `onRecovered` whenever the session goes from missing to present
 * (first hydration, sign-in, or background recovery after an expired token).
 */
export function onSessionRecovered(onRecovered: () => void): () => void {
  let hadSession: boolean | null = null;
  void supabase.auth.getSession().then(({ data }) => {
    if (hadSession === null) hadSession = !!data.session;
  });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const has = !!session;
    if (has && hadSession === false) onRecovered();
    hadSession = has;
  });
  return () => data.subscription.unsubscribe();
}
