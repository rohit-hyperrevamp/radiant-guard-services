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
import { useQuery, type QueryClient } from "@tanstack/react-query";
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
  billingDayBases: "billing_day_bases",
  publicHolidays: "public_holidays",
  clientHolidays: "client_holidays",
} as const;

/**
 * Tables that feed payroll / invoice money directly get a shorter life: an
 * edit made in ANOTHER browser reaches an open tab within this window (edits in
 * this tab invalidate immediately through invalidateReference).
 */
export const REFERENCE_MONEY_TTL_MS = 5 * 60_000;
const MONEY_TABLES = new Set<string>(["allowanceTypes", "costComponents", "billingDayBases", "publicHolidays", "clientHolidays"]);
export function referenceTtl(name: ReferenceName): number {
  return MONEY_TABLES.has(name) ? REFERENCE_MONEY_TTL_MS : REFERENCE_TTL_MS;
}

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
  if (hit && Date.now() - hit.at < referenceTtl(name)) return hit.promise as Promise<T[]>;
  const promise = fetchAll(REFERENCE_TABLES[name]);
  cache.set(name, { at: Date.now(), promise });
  // A failed load must not be cached — the next caller retries.
  promise.catch(() => {
    if (cache.get(name)?.promise === promise) cache.delete(name);
  });
  return promise as Promise<T[]>;
}

/** Query-key prefix of data derived from reference tables (e.g. the register finance context). */
export const REFERENCE_QK = "reference";

/**
 * Call after saving / deleting rows of a master table (before refreshing the
 * screen's own queries): drops the session cache for those tables and refreshes
 * every query built on reference data (["reference", …], including the register
 * finance context), so payroll / invoice in this tab never price with an old
 * master. With no names only the derived queries refresh (e.g. a platform flag).
 */
export function invalidateReference(qc: QueryClient | null | undefined, ...names: ReferenceName[]): void {
  for (const n of names) clearReferenceCache(n);
  if (qc) void qc.invalidateQueries({ queryKey: [REFERENCE_QK] });
}

/** React hook form of getReference (react-query key: ["reference", name]). */
export function useReference<T = Row>(name: ReferenceName, enabled = true) {
  return useQuery({
    queryKey: [REFERENCE_QK, name],
    queryFn: () => getReference<T>(name),
    staleTime: referenceTtl(name),
    gcTime: REFERENCE_TTL_MS * 2,
    enabled,
  });
}
