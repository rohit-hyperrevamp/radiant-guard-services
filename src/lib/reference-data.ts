/**
 * Shared, session-cached reference (master) data.
 *
 * Small lookup tables — attendance codes, pincode ranges, PT slabs, LWF,
 * designations … — used to be fetched independently by ~30 call sites, often
 * 4–5 times on one screen. Every extra request queues in the database and
 * slows the whole page. Load them ONLY through this module: each table is
 * fetched once, shared by every caller, and kept for REFERENCE_TTL_MS.
 *
 * - In-flight requests are de-duplicated (concurrent callers share one fetch).
 * - Reads are paged, so tables beyond 1,000 rows are complete.
 * - The cache is cleared when the signed-in identity changes, so one user's
 *   scoped rows are never served to another.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REFERENCE_TTL_MS = 30 * 60_000;
const PAGE = 1000;

/** Tables served by this module (all are small master/config tables). */
export const REFERENCE_TABLES = {
  attendanceCodes: "attendance_codes",
  pincodeRanges: "pincode_ranges",
  ptSlabs: "professional_tax_slabs",
  lwf: "labour_welfare_funds",
  designations: "designations",
  departments: "departments",
  billingTypes: "billing_types",
  payrollWindows: "payroll_windows",
  payrollDayBases: "payroll_day_bases",
  serviceTypes: "service_types",
  states: "states",
  branches: "branches",
  allowanceTypes: "allowance_types",
  deductionTypes: "deduction_types",
  additionTypes: "addition_types",
  costComponents: "cost_components",
  orgSettings: "org_settings",
} as const;

export type ReferenceName = keyof typeof REFERENCE_TABLES;
type Row = Record<string, unknown>;

type Entry = { at: number; promise: Promise<Row[]> };
const cache = new Map<ReferenceName, Entry>();
let cacheOwner: string | null | undefined;

async function fetchAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Drops every cached table (identity change, or after editing a master). */
export function clearReferenceCache(name?: ReferenceName): void {
  if (name) cache.delete(name);
  else cache.clear();
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    const owner = session?.user?.id ?? null;
    if (cacheOwner !== undefined && owner !== cacheOwner) cache.clear();
    cacheOwner = owner;
  });
}

/** Rows of one reference table — shared, de-duplicated and cached. */
export function getReference<T = Row>(name: ReferenceName): Promise<T[]> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < REFERENCE_TTL_MS) return hit.promise as Promise<T[]>;
  const promise = fetchAll(REFERENCE_TABLES[name]);
  cache.set(name, { at: Date.now(), promise });
  // A failed load must not be cached — the next caller retries.
  promise.catch(() => {
    if (cache.get(name)?.promise === promise) cache.delete(name);
  });
  return promise as Promise<T[]>;
}

/** React hook form of getReference (react-query key: ["reference", name]). */
export function useReference<T = Row>(name: ReferenceName, enabled = true) {
  return useQuery({
    queryKey: ["reference", name],
    queryFn: () => getReference<T>(name),
    staleTime: REFERENCE_TTL_MS,
    gcTime: REFERENCE_TTL_MS * 2,
    enabled,
  });
}
