import { supabase } from "@/integrations/supabase/client";
import { computeDashboardUnitFinance } from "@/lib/dashboard-finance";
import { computePayrollUnitsTotals } from "@/lib/payroll-engine";
import { splitSavedRegisterTotals, type SavedFinanceRow } from "@/lib/finance-totals";
import { fetchForIds, fetchInChunks } from "@/lib/supabase-batch";
import { latestPostedPayrollTotals, type PostedPayrollSnapshot } from "@/lib/finance-posted-totals";

/** Save aggregates only, never employee names, bank details or invoice export payloads. */
export async function computeFinanceSummaries(periods: Map<string, { start: string; end: string }>, db = supabase) {
  const [invoices, payroll] = await Promise.all([
    computeDashboardUnitFinance(periods, db),
    computePayrollUnitsTotals(periods, db),
  ]);
  const out = new Map<string, NonNullable<SavedFinanceRow["totals"]>>();
  for (const [id] of periods) {
    const inv = invoices.get(id), pay = payroll.get(id);
    if (!inv || !pay) continue;
    out.set(id, {
      unit_code: inv.unit_code, unit_name: inv.unit_name, customer_name: inv.customer_name, internal: inv.internal,
      contract_value: inv.contract_value, committed_payroll: inv.committed_payroll,
      committed_strength: inv.committed_strength, actual_strength: inv.actual_strength,
      invoice_amount: inv.invoice_amount, payroll_cost: pay.gross,
      employer_contribution: pay.employerAll, management_fee: pay.managementFee,
      employer_cost: pay.employer, billing_addons: Math.round((pay.employerAll - pay.employer) * 100) / 100,
      deductions: pay.deductions, net_pay: pay.net,
      invoice_parts: inv.parts.map((p) => ({ key: p.key, taxable: p.taxable })),
    });
  }
  // Saved, processed payroll takes precedence, but only for this exact window and latest version.
  const runs = await fetchInChunks<{ id: string; unit_id: string; period_start: string; period_end: string }>([...periods.keys()], (chunk, a, b) =>
    db.from("payroll_runs").select("id,unit_id,period_start,period_end").in("unit_id", chunk).eq("payroll_status" as never, "processed").order("id").range(a, b));
  const exactRuns = runs.filter((r) => { const p = periods.get(r.unit_id); return p?.start === r.period_start && p.end === r.period_end; });
  const snapshots = await fetchInChunks<PostedPayrollSnapshot>(exactRuns.map((r) => r.id), (chunk, a, b) =>
    db.from("payroll_run_snapshots" as never).select("payroll_run_id,version,unit_id,gross,total_deductions,net_pay,total_employer,employer_contributions").in("payroll_run_id", chunk).order("id").range(a, b));
  for (const [id, posted] of latestPostedPayrollTotals(snapshots)) {
    const t = out.get(id);
    if (t) Object.assign(t, { payroll_cost: posted.gross, deductions: posted.deductions, net_pay: posted.net, employer_contribution: posted.employer, management_fee: posted.managementFee, employer_cost: posted.employerCost, billing_addons: posted.billingAddons });
  }
  // Keep each finalised part's saved amount; never drop ED by taking only the last part.
  const links = await fetchInChunks<{ final_invoice_id: string; unit_id: string; period_start: string; period_end: string; part_key: string | null }>([...periods.keys()], (chunk, a, b) =>
    db.from("final_invoice_units" as never).select("final_invoice_id,unit_id,period_start,period_end,part_key").in("unit_id", chunk).order("id").range(a, b));
  const exactLinks = links.filter((r) => { const p = periods.get(r.unit_id); return p?.start === r.period_start && p.end === r.period_end; });
  const finalIds = [...new Set(exactLinks.map((r) => r.final_invoice_id))];
  const [finals, allLinks] = await Promise.all([
    fetchInChunks<{ id: string; taxable_value: number; created_at: string; part_key: string | null }>(finalIds, (chunk, a, b) => db.from("final_invoices" as never).select("id,taxable_value,created_at,part_key").in("id", chunk).order("id").range(a, b)),
    fetchInChunks<{ final_invoice_id: string; unit_id: string }>(finalIds, (chunk, a, b) => db.from("final_invoice_units" as never).select("final_invoice_id,unit_id").in("final_invoice_id", chunk).order("id").range(a, b)),
  ]);
  const byId = new Map(finals.map((f) => [f.id, f]));
  const latestParts = new Map<string, { amount: number; created: string; unitId: string; part: string }>();
  for (const link of exactLinks) {
    const f = byId.get(link.final_invoice_id);
    const sites = new Set(allLinks.filter((l) => l.final_invoice_id === link.final_invoice_id).map((l) => l.unit_id));
    // Group invoices have no stored per-unit allocation; their whole value must not be assigned to every site.
    if (!f || sites.size !== 1) continue;
    const part = f.part_key ?? link.part_key ?? "main", key = `${link.unit_id}|${part}`;
    const prev = latestParts.get(key);
    if (!prev || f.created_at > prev.created) latestParts.set(key, { amount: Number(f.taxable_value), created: f.created_at, unitId: link.unit_id, part });
  }
  for (const [id, t] of out) for (const p of t.invoice_parts) {
    const posted = latestParts.get(`${id}|${p.key}`);
    if (posted) p.taxable = posted.amount;
  }
  for (const t of out.values()) t.invoice_amount = t.internal ? 0 : Math.round(t.invoice_parts.reduce((n, p) => n + p.taxable, 0) * 100) / 100;
  return out;
}
type Periods = Map<string, { start: string; end: string }>;

/**
 * Saved finance_period_totals for exactly these site periods. Rows are read per
 * period window (most sites share one or two), never every period a site ever
 * had: a large window is one period-filtered scan (~2 pages), a small one a
 * few unit-id chunks.
 */
export async function readSavedFinanceRows(periods: Periods, db = supabase): Promise<SavedFinanceRow[]> {
  const groups = new Map<string, { start: string; end: string; ids: string[] }>();
  for (const [id, p] of periods) {
    const key = `${p.start}|${p.end}`;
    const g = groups.get(key) ?? { start: p.start, end: p.end, ids: [] };
    g.ids.push(id);
    groups.set(key, g);
  }
  const table = () => db.from("finance_period_totals" as never).select("*");
  const parts = await Promise.all([...groups.values()].map((g) => fetchForIds<SavedFinanceRow>(g.ids, {
    chunk: (chunk, from, to) => table().eq("period_start" as never, g.start as never).eq("period_end" as never, g.end as never).in("unit_id" as never, chunk as never).order("unit_id" as never).range(from, to) as never,
    scan: (from, to) => table().eq("period_start" as never, g.start as never).eq("period_end" as never, g.end as never).order("unit_id" as never).range(from, to) as never,
    idOf: (row) => row.unit_id,
  })));
  return parts.flat();
}

const recomputeRequested = new Set<string>();
/**
 * Ask the server worker (once per site period per page session) to recompute
 * totals that are missing or stale. Never awaited by the screen; failures are
 * ignored — the register computes those sites live anyway.
 */
export function requestFinanceRecompute(periods: Periods, unitIds: string[], db = supabase): Promise<void> {
  const todo = unitIds.filter((u) => {
    const p = periods.get(u);
    const key = p ? `${u}|${p.start}|${p.end}` : "";
    if (!p || recomputeRequested.has(key)) return false;
    recomputeRequested.add(key);
    return true;
  });
  const call = db.rpc as unknown as (fn: string, args: unknown) => Promise<{ error: { message: string } | null }>;
  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < todo.length; i += 250) {
    jobs.push(call.call(db, "request_finance_totals", {
      p_periods: todo.slice(i, i + 250).map((u) => ({ u, s: periods.get(u)?.start, e: periods.get(u)?.end })),
    }).catch(() => undefined));
  }
  return Promise.all(jobs).then(() => undefined);
}

/** Register first paint: saved current totals, plus the sites that still need a live compute. */
export async function readRegisterSavedTotals(periods: Periods, db = supabase) {
  const saved = await readSavedFinanceRows(periods, db);
  return splitSavedRegisterTotals(periods, saved);
}
