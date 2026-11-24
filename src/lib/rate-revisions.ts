import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";

/**
 * Contract rate cards are versioned per resource line in contract_rate_revisions.
 * For a payroll/invoice period this returns each resource row with the rate
 * that applies. When a new rate starts mid-period, monthly amounts are split
 * by calendar days (days before the date on the old rate, from the date on the new).
 * Rows without any approved revision are returned unchanged.
 */
type Row = Record<string, unknown>;
export type RateRevisionRow = Rev;
type Rev = {
  resource_id: string;
  status: string;
  effective_from: string | null;
  effective_to: string | null;
} & Row;

const RATE_FIELDS = [
  "components",
  "benefits",
  "deductions",
  "employer_contributions",
  "payroll_day_base_id",
  "billing_day_base_id",
  "shift_hours",
  "gross",
] as const;
const ARRAY_FIELDS = ["components", "benefits", "deductions", "employer_contributions"] as const;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

function revFor(revs: Rev[], day: string): Rev | null {
  let best: Rev | null = null;
  for (const r of revs) {
    if (r.effective_from && r.effective_from > day) continue;
    if (r.effective_to && r.effective_to < day) continue;
    if (!best || (r.effective_from ?? "") > (best.effective_from ?? "")) best = r;
  }
  return best;
}

const itemKey = (it: Row) =>
  String(it.allowanceId ?? it.costComponentId ?? "") + "|" + String(it.name ?? it.label ?? "");

function blendArrays(parts: { arr: unknown; w: number }[]): Row[] {
  const order: string[] = [];
  const base = new Map<string, Row>();
  const amt = new Map<string, number>();
  for (const { arr, w } of parts) {
    for (const raw of Array.isArray(arr) ? arr : []) {
      const it = (raw ?? {}) as Row;
      const k = itemKey(it);
      if (!base.has(k)) order.push(k);
      base.set(k, { ...it });
      amt.set(k, (amt.get(k) ?? 0) + (Number(it.amount) || 0) * w);
    }
  }
  return order.map((k) => ({ ...base.get(k)!, amount: Math.round((amt.get(k) ?? 0) * 100) / 100 }));
}

/** Approved/expired revisions for many resource lines (chunked: long id lists exceed URL limits). */
export async function fetchRevisions(ids: string[]): Promise<Rev[] | null> {
  try {
    return await fetchInChunks<Rev>(ids, (chunk, a, b) =>
      supabase
        .from("contract_rate_revisions" as never)
        .select("*")
        .in("resource_id", chunk)
        .in("status", ["approved", "expired"])
        .order("id")
        .range(a, b),
    );
  } catch {
    return null;
  }
}

export async function applyRateRevisionsForPeriod<T extends Row>(
  resources: T[],
  start: string,
  end: string,
): Promise<T[]> {
  const ids = resources.map((r) => r.id).filter(Boolean).map(String);
  if (!ids.length || !start || !end) return resources;
  return applyRateRevisionsWith(resources, await fetchRevisions(ids), start, end);
}

/** Same as applyRateRevisionsForPeriod, with revisions already loaded (bulk callers). */
export function applyRateRevisionsWith<T extends Row>(
  resources: T[],
  data: Rev[] | null,
  start: string,
  end: string,
): T[] {
  if (!resources.length || !start || !end) return resources;
  if (!data || data.length === 0) return resources;
  const byRes = new Map<string, Rev[]>();
  for (const r of data as unknown as Rev[]) {
    const list = byRes.get(r.resource_id) ?? [];
    list.push(r);
    byRes.set(r.resource_id, list);
  }
  const total = dayDiff(start, end);
  return resources.map((res) => {
    const revs = byRes.get(String(res.id));
    if (!revs?.length) return res;
    // Build day segments where the applicable version is constant.
    const boundaries = new Set<string>([start]);
    for (const r of revs) {
      if (r.effective_from && r.effective_from > start && r.effective_from <= end) boundaries.add(r.effective_from);
      if (r.effective_to && r.effective_to >= start && r.effective_to < end) boundaries.add(addDays(r.effective_to, 1));
    }
    const starts = Array.from(boundaries).sort();
    const segs = starts.map((s, i) => {
      const e = i + 1 < starts.length ? addDays(starts[i + 1], -1) : end;
      const v = revFor(revs, s);
      return { values: (v ?? res) as Row, w: dayDiff(s, e) / total };
    });
    if (segs.length === 1) {
      const v = segs[0].values;
      const out: Row = { ...res };
      for (const f of RATE_FIELDS) if (f in res) out[f] = v[f];
      return out as T;
    }
    const last = segs[segs.length - 1].values;
    const out: Row = { ...res };
    for (const f of RATE_FIELDS) if (f in res) out[f] = last[f];
    for (const f of ARRAY_FIELDS) {
      if (f in res) out[f] = blendArrays(segs.map((s) => ({ arr: s.values[f], w: s.w })));
    }
    if ("gross" in res) out.gross = segs.reduce((s, x) => s + (Number(x.values.gross) || 0) * x.w, 0);
    return out as T;
  });
}

export type RateSegment<T> = { from: string; to: string; values: T };

/** Payroll must calculate formulas in their original date windows, never blended arrays. */
export function payrollRateSegmentsWith<T extends Row>(resources: T[], data: Rev[], start: string, end: string): Map<string, RateSegment<T>[]> {
  const result = new Map<string, RateSegment<T>[]>();
  for (const resource of resources) {
    const revisions = data.filter((r) => r.resource_id === String(resource.id) && (r.status === "approved" || r.status === "expired"));
    result.set(String(resource.id), splitSegments(resource, revisions, start, end));
  }
  return result;
}

/**
 * For invoices: resources whose rate changes inside the period, split into
 * date windows each carrying that window's own (unblended) rate card.
 * Resources with a single applicable rate are omitted.
 */
export async function rateSegmentsForPeriod<T extends Row>(
  resources: T[],
  start: string,
  end: string,
): Promise<Map<string, RateSegment<T>[]>> {
  const ids = resources.map((r) => r.id).filter(Boolean).map(String);
  if (!ids.length || !start || !end) return new Map();
  return rateSegmentsWith(resources, await fetchRevisions(ids), start, end);
}

/** Same as rateSegmentsForPeriod, with revisions already loaded (bulk callers). */
export function rateSegmentsWith<T extends Row>(
  resources: T[],
  data: Rev[] | null,
  start: string,
  end: string,
): Map<string, RateSegment<T>[]> {
  const out = new Map<string, RateSegment<T>[]>();
  if (!resources.length || !start || !end) return out;
  if (!data) return out;
  const byRes = new Map<string, Rev[]>();
  for (const r of data as unknown as Rev[]) {
    const list = byRes.get(r.resource_id) ?? [];
    list.push(r);
    byRes.set(r.resource_id, list);
  }
  for (const res of resources) {
    const revs = byRes.get(String(res.id));
    if (!revs?.length) continue;
    const segs = splitSegments(res, revs, start, end);
    if (segs.length > 1) out.set(String(res.id), segs);
  }
  return out;
}

function splitSegments<T extends Row>(res: T, revs: Rev[], start: string, end: string): RateSegment<T>[] {
  const boundaries = new Set<string>([start]);
  for (const r of revs) {
    if (r.effective_from && r.effective_from > start && r.effective_from <= end) boundaries.add(r.effective_from);
    if (r.effective_to && r.effective_to >= start && r.effective_to < end) boundaries.add(addDays(r.effective_to, 1));
  }
  const starts = Array.from(boundaries).sort();
  const segs: RateSegment<T>[] = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i];
    const to = i + 1 < starts.length ? addDays(starts[i + 1], -1) : end;
    const rev = revFor(revs, from);
    const v = (rev ?? res) as Row;
    const revKey = rev ? `${String((rev as unknown as Row).id ?? "")}|${rev.effective_from ?? ""}|${rev.effective_to ?? ""}` : "";
    const values: Row = { ...res };
    for (const f of RATE_FIELDS) if (f in res && f in v) values[f] = v[f];
    const prev = segs[segs.length - 1] as (RateSegment<T> & { _rev?: string }) | undefined;
    // Merge only windows resolved from the same revision; distinct revisions
    // (e.g. 1–16 and 17+ windows) always print as separate invoice lines,
    // even when their amounts happen to be equal.
    if (prev && prev._rev === revKey) {
      prev.to = to;
      continue;
    }
    segs.push({ from, to, values: values as T, _rev: revKey } as RateSegment<T>);
  }
  return segs;
}
