import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { fetchAllPages } from "@/lib/supabase-batch";
import { activeClientIds } from "@/lib/client-visibility";

/** Active unit ids are shared by every caller for five minutes. */
export const ACTIVE_CLIENTS_TTL_MS = 5 * 60_000;

type Entry = { owner: string | null; at: number; promise: Promise<Set<string>> };
let entry: Entry | null = null;
let watching = false;

/** Forget the cached ids (identity change, or after a unit's status is saved). */
export function clearActiveClientIdsCache(): void {
  entry = null;
}

function watchIdentity() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      const owner = session?.user?.id ?? null;
      if (entry && entry.owner !== owner) entry = null;
    });
  } catch {
    watching = false;
  }
}

async function currentOwner(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function loadActiveClientIds(): Promise<Set<string>> {
  const rows = await fetchAllPages<{ id: string; status: string }>((from, to) =>
    supabase.from("units").select("id,status").eq("status", "active")
      .order("id").range(from, to),
  );
  return activeClientIds(rows);
}

/**
 * Ids of active clients (units), read once and shared: concurrent callers get
 * the same request, and the result is reused for ACTIVE_CLIENTS_TTL_MS for the
 * same signed-in user. A failed read is never cached, so errors cannot revive
 * a stale list of active clients.
 */
export async function fetchActiveClientIds(): Promise<Set<string>> {
  watchIdentity();
  await supabaseSessionReady();
  const owner = await currentOwner();
  const now = Date.now();
  if (entry && entry.owner === owner && now - entry.at < ACTIVE_CLIENTS_TTL_MS) {
    return new Set(await entry.promise);
  }
  const promise = loadActiveClientIds();
  const mine: Entry = { owner, at: now, promise };
  entry = mine;
  promise.catch(() => {
    if (entry === mine) entry = null;
  });
  // Callers get their own copy so nobody can mutate the shared set.
  return new Set(await promise);
}
