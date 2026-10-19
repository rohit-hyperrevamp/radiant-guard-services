import { hydrate, type QueryClient, type QueryKey } from "@tanstack/react-query";

// Deliberately exclude permissions, balances, payroll, attendance, documents,
// tokens and calculated results. Session storage ends when the tab is closed.
const LISTS = new Set([
  "candidates", "units", "designations", "departments", "departments-lite",
  "ex-services", "billing-types", "offboarding-reasons", "languages",
  "duties", "service-types",
]);
export const CACHE_MAX_AGE = 5 * 60_000;
const PREFIX = "radiant.portal-cache.v1.";
let activeOwner: string | null = null;

export function isSavedList(key: QueryKey): boolean {
  return key.length === 2 && key[0] === "admin" && typeof key[1] === "string" && LISTS.has(key[1]);
}

export function readSavedList<T>(key: QueryKey): T | undefined {
  if (typeof window === "undefined" || !activeOwner || !isSavedList(key)) return undefined;
  try {
    const entries = JSON.parse(window.sessionStorage.getItem(PREFIX + activeOwner) ?? "[]") as SavedEntry[];
    return entries.find((entry) => validEntry(entry, Date.now()) && JSON.stringify(entry.key) === JSON.stringify(key))?.data as T | undefined;
  } catch { return undefined; }
}

type SavedEntry = { key: QueryKey; data: unknown; at: number };
export function validEntry(entry: SavedEntry, now: number): boolean {
  return !!entry && Array.isArray(entry.key) && isSavedList(entry.key) &&
    typeof entry.at === "number" && entry.at <= now && now - entry.at < CACHE_MAX_AGE && entry.data !== undefined;
}

/** Install once per browser router. Never runs during SSR. */
export function createPortalCache(client: QueryClient, storage: Storage) {
  let owner: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let restoring = false;
  const purge = () => {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(PREFIX)) storage.removeItem(key);
      }
    } catch { /* Storage is optional. */ }
  };
  const save = () => {
    timer = undefined;
    if (!owner) return;
    const rows: SavedEntry[] = client.getQueryCache().getAll()
      .filter((query) => isSavedList(query.queryKey) && query.state.status === "success" && !query.state.isInvalidated)
      .map((query) => ({ key: query.queryKey, data: query.state.data, at: query.state.dataUpdatedAt }))
      .filter((entry) => validEntry(entry, Date.now()));
    try { storage.setItem(PREFIX + owner, JSON.stringify(rows)); } catch { /* Quota/private mode. */ }
  };
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (restoring || !owner || !isSavedList(event.query.queryKey)) return;
    if (event.type === "updated" && event.action.type === "invalidate") {
      // Remove invalidated records immediately, even if the tab closes during a save.
      try { storage.removeItem(PREFIX + owner); } catch { /* Best effort. */ }
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 500);
  });
  return {
    setOwner(next: string | null) {
      if (owner === next) return;
      if (timer) clearTimeout(timer);
      timer = undefined;
      restoring = true;
      if (owner !== null) { purge(); client.clear(); }
      owner = next;
      activeOwner = next;
      try {
        if (next) {
          const entries = JSON.parse(storage.getItem(PREFIX + next) ?? "[]") as SavedEntry[];
          if (Array.isArray(entries)) {
            hydrate(client, { mutations: [], queries: entries.filter((entry) => validEntry(entry, Date.now())).map((entry) => ({
              queryKey: entry.key,
              queryHash: JSON.stringify(entry.key),
              state: { data: entry.data, dataUpdatedAt: entry.at, dataUpdateCount: 1,
                error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0,
                fetchFailureReason: null, fetchMeta: null, isInvalidated: false,
                status: "success" as const, fetchStatus: "idle" as const },
            })) });
          }
        } else { purge(); client.clear(); }
      } catch { /* Invalid or unavailable storage must not prevent login. */ }
      finally { restoring = false; }
    },
    dispose() { if (timer) { clearTimeout(timer); save(); } unsubscribe(); activeOwner = null; },
  };
}