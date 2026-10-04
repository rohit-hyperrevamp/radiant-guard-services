import { supabase } from "@/integrations/supabase/client";

/**
 * Contract rate cards are versioned per resource line in contract_rate_revisions.
 * For a payroll/invoice period this returns each resource row with the rate
 * that applies. When a new rate starts mid-period, monthly amounts are split
 * by calendar days (days before the date on the old rate, from the date on the new).
 * Rows without any approved revision are returned unchanged.
 */
type Row = Record<string, unknown>;
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

export async function applyRateRevisionsForPeriod<T extends Row>(
  resources: T[],
  start: string,
  end: string,
): Promise<T[]> {
  const ids = resources.map((r) => r.id).filter(Boolean).map(String);
  if (!ids.length || !start || !end) return resources;
  const { data, error } = await supabase
    .from("contract_rate_revisions" as never)
    .select("*")
    .in("resource_id", ids)
    .in("status", ["approved", "expired"]);
  if (error || !data || (data as unknown[]).length === 0) return resources;
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
