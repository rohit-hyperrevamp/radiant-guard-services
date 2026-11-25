import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { fetchActiveClientIds } from "@/lib/active-clients";
import { visibleClientRows } from "@/lib/client-visibility";
import { buildSearchHay, compileSearch, type SearchHay } from "@/lib/search-match";

/**
 * Shared unit roster used by the Attendance / Invoice / Payroll charters.
 *
 * One pre-joined payload from `get_attendance_charter_units(p_lite)` (gated by
 * Access Control and cached server-side per scope), filtered to active clients.
 * The active-client read and the RPC start together once the session is ready.
 *
 * Lite mode returns the same unit rows without guard-name arrays (first paint);
 * the full call carries names for search, the sheet picker and breakdowns.
 *
 * Nothing is written to browser storage: snapshots were never read back
 * (`readCharterUnitsSnapshot` always returns null), so writing ~4000 rows to
 * localStorage on every refresh was pure cost. Legacy copies are removed.
 */

export type EmployeeRef = { id: string; name: string };

export type ClientEmployee = {
  id: string;
  name: string;
  designation: string;
  unit_id: string;
  unit_name: string;
  unit_code: string;
};

export type CharterUnitRow = {
  id: string;
  code: string;
  name: string;
  location: string;
  branch_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  billing_state: string | null;
  billing_city: string | null;
  /** Client Detail state/city (falls back to billing server-side). Drives filters. */
  client_state?: string | null;
  client_city?: string | null;
  contract_codes: string[];
  contract_end: string | null;
  /** People deployed here (home unit or posting) — not scope assignments. */
  active_employee_count: number;
  /** Deployed + scope-assigned people (= full security_guards length); present from the fast RPC. */
  guard_count?: number;
  security_guards: EmployeeRef[];
};

export type CharterPageData = {
  units: CharterUnitRow[];
  organizations: { id: string; name: string; code: string }[];
  employeesByCustomer: Record<string, ClientEmployee[]>;
  summary: { organizations: number; units: number; activeEmployees: number };
  /** Distinct deployed people across every unit the RPC returned (null on an older DB). */
  activeEmployeesDistinct: number | null;
  /** True when this payload has no guard names (lite mode). */
  lite: boolean;
};

export const CHARTER_UNITS_QK = ["charter-units-v3-active"] as const;
export const CHARTER_UNITS_LITE_QK = ["charter-units-v3-active", "lite"] as const;

// Legacy snapshot keys ("radiant:charter-units:*") from older builds.
const SNAPSHOT_PREFIX = "radiant:charter-units";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Remove every legacy charter snapshot from this browser. */
export function clearCharterSnapshots() {
  const store = storage();
  if (!store) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(SNAPSHOT_PREFIX)) stale.push(key);
    }
    for (const key of stale) store.removeItem(key);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

let legacyCleared = false;

export function readCharterUnitsSnapshot(): CharterPageData | null {
  // Browser snapshots cannot establish the current client status.
  return null;
}

function buildPageData(rows: CharterUnitRow[], activeEmployeesDistinct: number | null = null, lite = false): CharterPageData {
  const units = rows.map((u) => ({
    ...u,
    location: u.location || "",
    billing_city: u.billing_city ?? null,
    customer_id: u.customer_id || "",
    customer_name: u.customer_name || "—",
    customer_code: u.customer_code || "",
    contract_codes: u.contract_codes ?? [],
    security_guards: u.security_guards ?? [],
    active_employee_count: Number(u.active_employee_count ?? 0),
    ...(u.guard_count != null ? { guard_count: Number(u.guard_count) } : {}),
  }));

  const organizations = Array.from(
    new Map(
      units.map((r) => [
        r.customer_id || r.customer_name,
        { id: r.customer_id || r.customer_name, name: r.customer_name, code: r.customer_code },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const employeesByCustomer: Record<string, ClientEmployee[]> = {};
  for (const r of units) {
    const key = r.customer_id || r.customer_name;
    for (const sg of r.security_guards) {
      if (!employeesByCustomer[key]) employeesByCustomer[key] = [];
      if (!employeesByCustomer[key].some((e) => e.id === sg.id && e.unit_id === r.id)) {
        employeesByCustomer[key].push({
          id: sg.id,
          name: sg.name,
          designation: "",
          unit_id: r.id,
          unit_name: r.name || r.code,
          unit_code: r.code,
        });
      }
    }
  }
  for (const key of Object.keys(employeesByCustomer)) {
    employeesByCustomer[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    units,
    organizations,
    employeesByCustomer,
    summary: {
      organizations: organizations.length,
      units: units.length,
      activeEmployees: activeEmployeesDistinct ?? units.reduce((s, r) => s + r.active_employee_count, 0),
    },
    activeEmployeesDistinct,
    lite,
  };
}

type CharterPayload = { units?: CharterUnitRow[]; active_employees?: number | null };

/** PostgREST "function not found / no matching signature" — DB migration not applied yet. */
export function isMissingRpcSignature(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

async function callCharterRpc(lite: boolean): Promise<{ payload: CharterPayload; lite: boolean }> {
  await supabaseSessionReady();
  const { data, error } = await supabase.rpc("get_attendance_charter_units" as never, { p_lite: lite } as never);
  if (!error) return { payload: (data ?? {}) as CharterPayload, lite };
  // Rolling deploy: an older database only has the zero-argument version.
  if (!isMissingRpcSignature(error)) throw error;
  const legacy = await supabase.rpc("get_attendance_charter_units" as never);
  if (legacy.error) throw legacy.error;
  return { payload: (legacy.data ?? {}) as CharterPayload, lite: false };
}

async function loadCharterUnits(lite: boolean): Promise<CharterPageData> {
  if (!legacyCleared) {
    legacyCleared = true;
    clearCharterSnapshots();
  }
  // Active-client ids and the roster RPC run in parallel (both wait for the session).
  const [activeIds, result] = await Promise.all([fetchActiveClientIds(), callCharterRpc(lite)]);
  const all = result.payload.units ?? [];
  const rows = visibleClientRows(all, activeIds);
  // The server total covers every row it returned; it is exact for the visible
  // list only when no row was dropped here.
  const total = result.payload.active_employees;
  const distinct = typeof total === "number" && rows.length === all.length ? total : null;
  return buildPageData(rows, distinct, result.lite);
}

/** Full roster, including guard names (search, sheet picker, breakdowns). */
export function fetchCharterUnits(): Promise<CharterPageData> {
  return loadCharterUnits(false);
}

/** Same unit rows without guard names — for first paint and count-only views. */
export function fetchCharterUnitsLite(): Promise<CharterPageData> {
  return loadCharterUnits(true);
}

/** Small stable hash so a large id list can key a query without a huge string. */
export function unitIdsKey(ids: readonly string[]): string {
  const sorted = Array.from(new Set(ids)).sort();
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      const c = id.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    }
    h1 = Math.imul(h1 ^ 0x2c, 0x01000193);
  }
  return `${sorted.length}:${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/**
 * Value for the "Active employees" tile: distinct deployed people across
 * `units` (never a per-unit sum, which double-counts multi-site staff).
 * Uses the payload total when `units` is the whole roster, else asks the
 * server for that subset. Falls back to the per-unit sum on an older database.
 */
export function pickActiveEmployees(
  units: ReadonlyArray<Pick<CharterUnitRow, "id" | "active_employee_count">>,
  data: { units: ReadonlyArray<unknown>; activeEmployeesDistinct: number | null } | undefined,
  subsetTotal: number | null | undefined,
): number {
  if (data?.activeEmployeesDistinct != null && units.length === data.units.length) return data.activeEmployeesDistinct;
  if (typeof subsetTotal === "number") return subsetTotal;
  return units.reduce((s, u) => s + (u.active_employee_count || 0), 0);
}

export async function fetchCharterActiveEmployeeTotal(unitIds: string[]): Promise<number | null> {
  if (!unitIds.length) return 0;
  await supabaseSessionReady();
  const { data, error } = await supabase.rpc("charter_active_employee_total" as never, { p_unit_ids: unitIds } as never);
  if (error) {
    if (isMissingRpcSignature(error)) return null;
    throw error;
  }
  return Number(data ?? 0);
}

/** Distinct deployed people across the given units (see pickActiveEmployees). */
export function useCharterActiveEmployees(
  units: ReadonlyArray<Pick<CharterUnitRow, "id" | "active_employee_count">>,
  data: { units: ReadonlyArray<unknown>; activeEmployeesDistinct: number | null } | undefined,
): number {
  const ids = useMemo(() => units.map((u) => u.id), [units]);
  const key = useMemo(() => unitIdsKey(ids), [ids]);
  const coversAll = data?.activeEmployeesDistinct != null && units.length === data.units.length;
  const q = useQuery({
    queryKey: ["charter-active-employee-total", key],
    enabled: !!data && !coversAll && ids.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: () => fetchCharterActiveEmployeeTotal(ids),
  });
  return pickActiveEmployees(units, data, coversAll ? null : q.data);
}

type SearchableUnit = {
  name?: string | null;
  code?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  location?: string | null;
  contract_codes?: readonly string[] | null;
  security_guards?: ReadonlyArray<{ name: string }> | null;
};

const hayCache = new WeakMap<object, SearchHay>();

function unitHay(u: SearchableUnit): SearchHay {
  let hay = hayCache.get(u);
  if (!hay) {
    hay = buildSearchHay([
      u.customer_name,
      u.customer_code,
      u.name,
      u.code,
      u.location,
      ...(u.contract_codes ?? []),
      ...(u.security_guards ?? []).map((g) => g.name),
    ]);
    hayCache.set(u, hay);
  }
  return hay;
}

/**
 * Register search (shared search-match rules: any word order, case-insensitive):
 * client, unit, location, contract codes and deployed guard names. Search text
 * is built once per row object and reused on every keystroke.
 */
export function filterCharterUnitsBySearch<T extends SearchableUnit>(units: readonly T[], query: string): T[] {
  const test = compileSearch(query);
  if (!test) return units.slice();
  return units.filter((u) => test(unitHay(u)));
}
