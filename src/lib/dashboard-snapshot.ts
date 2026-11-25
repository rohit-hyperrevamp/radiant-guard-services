/**
 * Tiny localStorage snapshots for dashboard figures.
 *
 * The first screen paints from the last value this browser saw (marked stale
 * so react-query revalidates in the background) instead of waiting for the
 * network. Snapshots are versioned and age-limited, and every storage access
 * is guarded: private windows and blocked storage simply skip the snapshot.
 */

const PREFIX = "radiant.dash-snap.v1:";
/** Snapshots older than this are ignored (figures would be misleading). */
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60_000;

type Stored<T> = { at: number; value: T };

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSnapshot<T>(key: string, now: number = Date.now()): T | undefined {
  const s = storage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || typeof parsed.at !== "number" || now - parsed.at > SNAPSHOT_MAX_AGE_MS) return undefined;
    return parsed.value;
  } catch {
    return undefined;
  }
}

export function writeSnapshot<T>(key: string, value: T, now: number = Date.now()): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREFIX + key, JSON.stringify({ at: now, value } satisfies Stored<T>));
  } catch {
    /* quota / blocked storage: the snapshot is only a convenience */
  }
}

/** Short, stable key fragment for a (possibly long) list of ids. */
export function hashIds(ids: readonly string[] | null | undefined): string {
  if (!ids) return "all";
  let h = 0;
  const joined = [...ids].sort().join(",");
  for (let i = 0; i < joined.length; i++) h = (h * 31 + joined.charCodeAt(i)) | 0;
  return `${ids.length}:${h >>> 0}`;
}
