import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";
import { resolvePtAmount, type PincodeRangeLike, type PtSlabLike } from "@/lib/payroll-calc";

/**
 * Professional Tax is one monthly slab per person. A guard who works at more
 * than one site in the same month is taxed on the COMBINED gross, and the PT
 * already charged at earlier-processed sites is subtracted (Pages Payroll's
 * rule: 9,841 at site A → ₹175, then 3,280 at site B → slab(13,121)=200 − 175 = ₹25).
 */
export type OtherSitePt = { gross: number; pt: number };

const PT_RE = /\bprofessional\s*tax\b|\bp\.?\s*tax\b|\bpt\b/i;

export function ptForSite(input: {
  state: string | null;
  pincode: string | null;
  gender: string;
  siteGross: number;
  other?: OtherSitePt | null;
  /**
   * PT Pages already settled for this person at THIS site this month
   * (`pt_site_allocations`; 0 when Pages charged it at another site).
   * Absent = no recorded allocation, use the processing-order rule.
   */
  allocated?: number | null;
  /** @deprecated kept for callers; PT now follows processing order like Pages. */
  spread?: PtSpread | null;
  slabs: PtSlabLike[];
  ranges: PincodeRangeLike[];
}) {
  const other = input.other ?? { gross: 0, pt: 0 };
  const resolved = resolvePtAmount({
    state: input.state,
    pincode: input.pincode,
    gender: input.gender,
    earnedGross: Math.max(0, input.siteGross + other.gross),
    slabs: input.slabs,
    ranges: input.ranges,
  });
  if (input.allocated != null && Number.isFinite(input.allocated)) {
    return { ...resolved, amount: Math.max(0, Number(input.allocated)) };
  }
  // Pages rule: each site, when processed, charges slab(gross at this site +
  // gross at sites already processed this month) − PT already charged there.
  return { ...resolved, amount: Math.max(0, resolved.amount - other.pt) };
}

/**
 * PT Pages charged per person per site for the month of `periodEnd`, for
 * people Pages paid at more than one site. A person with rows this month but
 * none for `unitId` gets 0 here (Pages charged them elsewhere).
 */
export async function fetchPtAllocations(
  candidateIds: string[],
  unitId: string,
  periodEnd: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!candidateIds.length || !periodEnd) return out;
  const [y, m] = periodEnd.split("-").map(Number);
  type Row = { candidate_id: string; unit_id: string; pt_amount: number | string | null };
  const rows = await fetchInChunks<Row>(candidateIds, (chunk, from, to) =>
    (supabase as unknown as { from: (t: string) => any })
      .from("pt_site_allocations")
      .select("candidate_id, unit_id, pt_amount")
      .in("candidate_id", chunk)
      .eq("period_year", y)
      .eq("period_month", m)
      .range(from, to) as never,
  ).catch(() => [] as Row[]);
  for (const r of rows) {
    if (!out.has(r.candidate_id)) out.set(r.candidate_id, 0);
    if (r.unit_id === unitId) out.set(r.candidate_id, (out.get(r.candidate_id) ?? 0) + (Number(r.pt_amount) || 0));
  }
  return out;
}

export type PtSpread = { isCarrier: boolean; siteShare: number };

/** Most-duties site per person (informational only; no longer decides PT). */
export function ptSpread(dutiesByUnit: Map<string, number> | undefined, unitId: string): PtSpread | null {
  if (!dutiesByUnit || dutiesByUnit.size === 0) return null;
  let total = 0;
  let carrier = "";
  let best = -1;
  for (const [u, d] of Array.from(dutiesByUnit.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    total += d;
    if (d > best) {
      best = d;
      carrier = u;
    }
  }
  const site = dutiesByUnit.get(unitId) ?? 0;
  if (total <= 0 || site <= 0) return null;
  return { isCarrier: carrier === unitId, siteShare: site / total };
}

/** Duties (present days + Extra Duty) per person per site for the month of `periodEnd`. */
export async function fetchMonthDutiesBySite(
  candidateIds: string[],
  periodEnd: string,
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (!candidateIds.length || !periodEnd) return out;
  const [y, m] = periodEnd.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { data: codes } = await supabase.from("attendance_codes").select("code, counts_as_present, day_value");
  const dayValue = new Map(
    ((codes ?? []) as { code: string; counts_as_present: boolean | null; day_value: number | string | null }[]).map((c) => [
      String(c.code).toUpperCase(),
      c.counts_as_present ? Number(c.day_value ?? 1) || 1 : 0,
    ]),
  );
  type Row = { candidate_id: string; unit_id: string; code: string | null; ot_hours: number | string | null };
  const rows = await fetchInChunks<Row>(candidateIds, (chunk, from, to) =>
    supabase
      .from("attendance_entries")
      .select("candidate_id, unit_id, code, ot_hours")
      .in("candidate_id", chunk)
      .gte("entry_date", monthStart)
      .lte("entry_date", monthEnd)
      .range(from, to) as never,
  ).catch(() => [] as Row[]);
  for (const r of rows) {
    const d = (dayValue.get(String(r.code ?? "").toUpperCase()) ?? 0) + (Number(r.ot_hours) || 0);
    if (d <= 0) continue;
    const per = out.get(r.candidate_id) ?? new Map<string, number>();
    per.set(r.unit_id, (per.get(r.unit_id) ?? 0) + d);
    out.set(r.candidate_id, per);
  }
  return out;
}

/** Gross and PT from processed payrolls at other sites whose period ends in the same month. */
export async function fetchOtherSitePtTotals(
  candidateIds: string[],
  unitId: string,
  periodEnd: string,
): Promise<Map<string, OtherSitePt>> {
  const out = new Map<string, OtherSitePt>();
  if (!candidateIds.length || !periodEnd) return out;
  const [y, m] = periodEnd.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  type Snap = {
    candidate_id: string;
    payroll_run_id: string;
    version: number;
    gross: number | string | null;
    deductions: unknown;
  };
  const snaps = await fetchInChunks<Snap>(candidateIds, (chunk, from, to) =>
    supabase
      .from("payroll_run_snapshots")
      .select("candidate_id, payroll_run_id, version, gross, deductions, payroll_runs!inner(unit_id, period_end, payroll_status)")
      .in("candidate_id", chunk)
      .eq("payroll_runs.payroll_status", "processed")
      .neq("payroll_runs.unit_id", unitId)
      .gte("payroll_runs.period_end", monthStart)
      .lte("payroll_runs.period_end", monthEnd)
      .range(from, to) as never,
  ).catch(() => [] as Snap[]);
  // Latest version per run + person.
  const latest = new Map<string, Snap>();
  for (const s of snaps) {
    const k = `${s.payroll_run_id}|${s.candidate_id}`;
    const prev = latest.get(k);
    if (!prev || Number(s.version) > Number(prev.version)) latest.set(k, s);
  }
  for (const s of latest.values()) {
    const deds = Array.isArray(s.deductions) ? (s.deductions as { name?: string; amount?: number | string }[]) : [];
    const pt = deds.filter((d) => PT_RE.test(String(d?.name ?? ""))).reduce((a, d) => a + (Number(d.amount) || 0), 0);
    const cur = out.get(s.candidate_id) ?? { gross: 0, pt: 0 };
    out.set(s.candidate_id, { gross: cur.gross + (Number(s.gross) || 0), pt: cur.pt + pt });
  }
  return out;
}

/** Other sites where these people have attendance this month (any payroll status). */
export async function fetchOtherSitesWorked(
  candidateIds: string[],
  unitId: string,
  periodEnd: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!candidateIds.length || !periodEnd) return out;
  const [y, m] = periodEnd.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  type Row = { candidate_id: string; unit_id: string; units: { code: string | null } | null };
  const rows = await fetchInChunks<Row>(candidateIds, (chunk, from, to) =>
    supabase
      .from("attendance_entries")
      .select("candidate_id, unit_id, units!inner(code)")
      .in("candidate_id", chunk)
      .neq("unit_id", unitId)
      .gte("entry_date", monthStart)
      .lte("entry_date", monthEnd)
      .range(from, to) as never,
  ).catch(() => [] as Row[]);
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    const s = sets.get(r.candidate_id) ?? new Set<string>();
    s.add(r.units?.code || r.unit_id);
    sets.set(r.candidate_id, s);
  }
  for (const [k, s] of sets) out.set(k, Array.from(s).sort());
  return out;
}

/** True when the PT already charged elsewhere changed since the register was computed. */
export function otherSitePtChanged(
  used: Map<string, OtherSitePt | null | undefined>,
  fresh: Map<string, OtherSitePt>,
): boolean {
  for (const [id, u] of used) {
    const f = fresh.get(id);
    if (Math.round((u?.pt ?? 0) * 100) !== Math.round((f?.pt ?? 0) * 100)) return true;
    if (Math.round((u?.gross ?? 0) * 100) !== Math.round((f?.gross ?? 0) * 100)) return true;
  }
  return false;
}
