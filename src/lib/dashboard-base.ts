/**
 * Shared base lookups for the dashboard coverage cards.
 *
 * The Workforce and Attendance coverage cards render on the same screen and
 * each used to read the same six tables independently — twelve requests for
 * six results — and each read was unbounded, so PostgREST silently cut them at
 * 1000 rows (with ~4000 units, most units simply went missing).
 *
 * This module loads each table once, fully paged, and hands the same payload
 * to every caller for a short window.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { roundDutyDays } from "@/lib/duty-days";

export type BaseRow = Record<string, unknown>;

export type DashboardBase = {
  /** Active client contracts. */
  contracts: BaseRow[];
  units: BaseRow[];
  customers: BaseRow[];
  designations: BaseRow[];
  /** Active employees. */
  candidates: BaseRow[];
  candidateUnits: BaseRow[];
  /** Contract resources for the active client contracts above. */
  resources: BaseRow[];
  attendanceCodes: BaseRow[];
};

/** Full company-wide base: heavy (every contract, unit, employee), so cache per user. */
const TTL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* India-time date helpers (pure).                                     */
/* `toISOString()` is UTC: between 00:00 and 05:30 IST it still says   */
/* "yesterday", and a local month start converts to the previous day.  */
/* ------------------------------------------------------------------ */

const IST_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in India (YYYY-MM-DD). */
export function istDate(now: Date = new Date()): string {
  return IST_FORMAT.format(now);
}

/** Add whole days to a YYYY-MM-DD date without any time-zone drift. */
export function istAddDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First and last calendar day of the current India month (YYYY-MM-DD). */
export function istMonthRange(now: Date = new Date()): { start: string; end: string } {
  const [y, m] = istDate(now).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export type AttendanceCodeMeta = {
  code: string;
  counts_as_present?: boolean | null;
  is_leave?: boolean | null;
  is_paid?: boolean | null;
  day_value?: number | string | null;
};

/**
 * One person's month from their own attendance rows. Present follows the
 * attendance code master (`counts_as_present`, weighted by `day_value`) —
 * not "any code except A/L", which counted WO/PH as present and Late ("L")
 * as leave. `ot_hours` stores Extra Duty in days.
 */
export function summarizeMyAttendance(
  rows: ReadonlyArray<{ code: string | null; ot_hours: number | string | null }>,
  codes: ReadonlyArray<AttendanceCodeMeta> | null | undefined,
): { present: number; absent: number; leave: number; edDays: number; total: number } {
  const meta = new Map((codes ?? []).map((c) => [String(c.code).toUpperCase(), c]));
  let present = 0;
  let absent = 0;
  let leave = 0;
  let edDays = 0;
  for (const r of rows) {
    const code = (r.code || "").toUpperCase();
    edDays += Number(r.ot_hours || 0);
    if (!code) continue;
    const m = meta.get(code);
    if (m) {
      if (m.counts_as_present) {
        const dv = Number(m.day_value);
        present += Number.isFinite(dv) && dv > 0 ? dv : 1;
      } else if (m.is_leave) leave++;
      // Unpaid codes are absences. A master row with is_paid unset still counts
      // when the code is the plain "A"; paid offs (WO/H) are never absences.
      else if (m.is_paid === false || (m.is_paid == null && code === "A")) absent++;
    } else if (code === "P") present++;
    else if (code === "A") absent++;
  }
  return {
    present: roundDutyDays(present),
    absent,
    leave,
    edDays: roundDutyDays(edDays),
    total: rows.length,
  };
}

type SelfCandidate = {
  id: string;
  status?: string | null;
  is_enabled?: boolean | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Pick the signed-in person's own employee row from every row sharing their
 * mobile. Rehires leave two live rows on one number, so `.maybeSingle()`
 * threw; prefer enabled, then active/approved, then the most recent record.
 */
export function pickSelfEmployee<T extends SelfCandidate>(rows: readonly T[] | null | undefined): T | null {
  if (!rows?.length) return null;
  const live = (s?: string | null) => (s === "active" || s === "approved" ? 1 : 0);
  const stamp = (r: T) => r.approved_at || r.created_at || r.updated_at || "";
  return [...rows].sort(
    (a, b) =>
      Number(b.is_enabled !== false) - Number(a.is_enabled !== false) ||
      live(b.status) - live(a.status) ||
      stamp(b).localeCompare(stamp(a)) ||
      b.id.localeCompare(a.id),
  )[0];
}

/* ------------------------------------------------------------------ */
/* Per-user cache. Keyed by the signed-in user so a shared device never */
/* shows the previous person's base data, and dropped on sign-out.     */
/* ------------------------------------------------------------------ */

let cached: { at: number; owner: string | null; data: DashboardBase } | null = null;
let inflight: { owner: string | null; promise: Promise<DashboardBase> } | null = null;
let authWatch = false;

async function currentOwner(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function watchIdentity() {
  if (authWatch || typeof window === "undefined") return;
  authWatch = true;
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      const owner = session?.user.id ?? null;
      if (cached && cached.owner !== owner) cached = null;
      if (inflight && inflight.owner !== owner) inflight = null;
      if (!owner) scopedCache.clear();
    });
  } catch {
    authWatch = false;
  }
}

const CANDIDATE_COLUMNS =
  "id,full_name,designation_id,role_key,status,non_billable,unit_id,employee_code,candidate_code,is_enabled";

async function load(): Promise<DashboardBase> {
  const [
    contracts,
    units,
    customers,
    designations,
    candidates,
    candidateUnits,
    allResources,
    attendanceCodes,
  ] = await Promise.all([
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("client_contracts" as never)
        .select("id,contract_code,unit_id,status,record_type,approval_status")
        .eq("record_type", "client")
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("units" as never).select("id,name,customer_id").eq("status", "active").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("customers" as never).select("id,name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("designations" as never).select("id,name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("candidates" as never)
        .select(CANDIDATE_COLUMNS)
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("candidate_units" as never)
        .select("candidate_id,unit_id")
        .order("candidate_id", { ascending: true })
        .range(from, to),
    ),
    // One paged read of every resource line beats an `.in(...)` over several
    // hundred contract ids, which overflows the request URL.
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("contract_resources" as never)
        .select("contract_id,designation_id,role_key,quantity")
        .order("contract_id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("attendance_codes" as never)
        .select("code,counts_as_present,is_leave,is_paid,day_value")
        .range(from, to),
    ),
  ]);

  const activeUnitIds = new Set(units.map((u) => String(u.id)));
  const visibleContracts = contracts.filter((c) => activeUnitIds.has(String(c.unit_id)));
  const activeContractIds = new Set(visibleContracts.map((c) => String(c.id)));
  const resources = allResources.filter((r) => activeContractIds.has(String(r.contract_id)));

  return {
    contracts: visibleContracts,
    units,
    customers,
    designations,
    candidates,
    candidateUnits: candidateUnits.filter((row) => activeUnitIds.has(String(row.unit_id))),
    resources,
    attendanceCodes,
  };
}

/** Load the shared lookups, reusing a recent result or an in-flight request. */
export async function loadDashboardBase(): Promise<DashboardBase> {
  watchIdentity();
  const owner = await currentOwner();
  if (cached && cached.owner === owner && Date.now() - cached.at < TTL_MS) return cached.data;
  if (inflight && inflight.owner === owner) return inflight.promise;
  const entry = {
    owner,
    promise: load()
      .then((data) => {
        if (inflight === entry) cached = { at: Date.now(), owner, data };
        return data;
      })
      .finally(() => {
        if (inflight === entry) inflight = null;
      }),
  };
  inflight = entry;
  return entry.promise;
}

/** Drop the cache so the next read hits the database (used after writes and sign-out). */
export function invalidateDashboardBase() {
  cached = null;
  inflight = null;
  scopedCache.clear();
}

/* ------------------------------------------------------------------ */
/* Scoped base: the same payload restricted to a list of units (e.g.   */
/* one page of the Attendance register). Rows for those units are      */
/* identical to the full load; other units are simply absent.          */
/* ------------------------------------------------------------------ */

const SCOPED_MAX_ENTRIES = 24;
const scopedCache = new Map<string, { at: number; promise: Promise<DashboardBase> }>();

/** Canonical cache key for a unit list (order and duplicates ignored). */
export function scopedBaseKey(owner: string | null, unitIds: readonly string[]): string {
  return `${owner ?? "anon"}|${[...new Set(unitIds.filter(Boolean))].sort().join(",")}`;
}

async function loadScoped(unitIds: string[]): Promise<DashboardBase> {
  const ids = [...new Set(unitIds.filter(Boolean))];
  if (ids.length === 0) {
    return { contracts: [], units: [], customers: [], designations: [], candidates: [], candidateUnits: [], resources: [], attendanceCodes: [] };
  }
  const [units, contracts, candidateUnits, primaryCandidates, designations, attendanceCodes] = await Promise.all([
    fetchInChunks<BaseRow>(ids, (chunk, from, to) =>
      supabase.from("units" as never).select("id,name,customer_id").eq("status", "active").in("id", chunk).order("id", { ascending: true }).range(from, to),
    ),
    fetchInChunks<BaseRow>(ids, (chunk, from, to) =>
      supabase
        .from("client_contracts" as never)
        .select("id,contract_code,unit_id,status,record_type,approval_status")
        .eq("record_type", "client")
        .eq("status", "active")
        .in("unit_id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchInChunks<BaseRow>(ids, (chunk, from, to) =>
      supabase.from("candidate_units" as never).select("candidate_id,unit_id").in("unit_id", chunk).order("candidate_id", { ascending: true }).range(from, to),
    ),
    fetchInChunks<BaseRow>(ids, (chunk, from, to) =>
      supabase
        .from("candidates" as never)
        .select(CANDIDATE_COLUMNS)
        .eq("status", "active")
        .in("unit_id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("designations" as never).select("id,name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("attendance_codes" as never).select("code,counts_as_present,is_leave,is_paid,day_value").range(from, to),
    ),
  ]);

  const activeUnitIds = new Set(units.map((u) => String(u.id)));
  const visibleContracts = contracts.filter((c) => activeUnitIds.has(String(c.unit_id)));
  const contractIds = visibleContracts.map((c) => String(c.id));
  const mapped = candidateUnits.filter((row) => activeUnitIds.has(String(row.unit_id)));
  // People mapped through candidate_units whose primary unit lies elsewhere.
  const have = new Set(primaryCandidates.map((c) => String(c.id)));
  const extraIds = [...new Set(mapped.map((m) => String(m.candidate_id ?? "")))].filter((id) => id && !have.has(id));
  const customerIds = [...new Set(units.map((u) => String(u.customer_id ?? "")).filter(Boolean))];

  const [resources, extraCandidates, customers] = await Promise.all([
    fetchInChunks<BaseRow>(contractIds, (chunk, from, to) =>
      supabase
        .from("contract_resources" as never)
        .select("contract_id,designation_id,role_key,quantity")
        .in("contract_id", chunk)
        .order("contract_id", { ascending: true })
        .range(from, to),
    ),
    fetchInChunks<BaseRow>(extraIds, (chunk, from, to) =>
      supabase
        .from("candidates" as never)
        .select(CANDIDATE_COLUMNS)
        .eq("status", "active")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchInChunks<BaseRow>(customerIds, (chunk, from, to) =>
      supabase.from("customers" as never).select("id,name").in("id", chunk).order("id", { ascending: true }).range(from, to),
    ),
  ]);

  return {
    contracts: visibleContracts,
    units,
    customers,
    designations,
    candidates: [...primaryCandidates, ...extraCandidates],
    candidateUnits: mapped,
    resources,
    attendanceCodes,
  };
}

/**
 * Base lookups for just these units — a handful of `.in(...)` reads instead
 * of paging every contract resource, mapping and employee in the company.
 * Cached per user and unit list for the same window as the full load.
 */
export async function loadDashboardBaseForUnits(unitIds: readonly string[]): Promise<DashboardBase> {
  watchIdentity();
  const owner = await currentOwner();
  const key = scopedBaseKey(owner, unitIds);
  const hit = scopedCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = loadScoped([...unitIds]);
  scopedCache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (scopedCache.get(key)?.promise === promise) scopedCache.delete(key);
  });
  while (scopedCache.size > SCOPED_MAX_ENTRIES) {
    const oldest = scopedCache.keys().next().value;
    if (oldest === undefined) break;
    scopedCache.delete(oldest);
  }
  return promise;
}
