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
  return { ...resolved, amount: Math.max(0, resolved.amount - other.pt) };
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
