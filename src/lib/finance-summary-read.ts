import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";
import { financeRowIsCurrent, financeProfit, financeLossReason, type SavedFinanceRow } from "@/lib/finance-totals";

export async function readDashboardFinance(periods: Map<string, { start: string; end: string }>) {
  const ids = [...periods.keys()];
  const [saved, sheets] = await Promise.all([
    fetchInChunks<SavedFinanceRow>(ids, (chunk, from, to) => supabase.from("finance_period_totals" as never).select("*").in("unit_id", chunk).order("unit_id").order("period_start").order("period_end").range(from, to)),
    fetchInChunks<{ unit_id: string; period_start: string; period_end: string; status: string }>(ids, (chunk, from, to) => supabase.from("attendance_sheets").select("unit_id,period_start,period_end,status").in("unit_id", chunk).order("id").range(from, to)),
  ]);
  const exact = (r: { unit_id: string; period_start: string; period_end: string }) => {
    const p = periods.get(r.unit_id);
    return p?.start === r.period_start && p.end === r.period_end;
  };
  const byId = new Map(saved.filter(exact).map((r) => [r.unit_id, r]));
  const pending = ids.filter((id) => { const row = byId.get(id); return !row || !financeRowIsCurrent(row); });
  if (pending.length) {
    for (let i = 0; i < pending.length; i += 250) {
      const result = await (supabase.rpc as unknown as (fn: string, args: unknown) => Promise<{ error: { message: string } | null }>)("request_finance_totals", {
        p_periods: pending.slice(i, i + 250).map((u) => ({ u, s: periods.get(u)?.start, e: periods.get(u)?.end })),
      });
      if (result.error) throw new Error(result.error.message);
    }
  }
  const approved = new Set(sheets.filter((r) => exact(r) && r.status === "approved").map((r) => r.unit_id));
  const rows = [...byId.values()].filter(financeRowIsCurrent).flatMap((r) => {
    if (!r.totals) return [];
    const t = r.totals;
    const profit = financeProfit({ invoice: t.invoice_amount, gross: t.payroll_cost, employer: t.employer_contribution, managementFee: t.management_fee });
    return [{ ...t, unit_id: r.unit_id, period_start: r.period_start, period_end: r.period_end,
      variance: profit, variance_pct: t.invoice_amount > 0 ? profit / t.invoice_amount * 100 : 0,
      attendance_approved: approved.has(r.unit_id),
      loss_reason: financeLossReason({ invoice: t.invoice_amount, gross: t.payroll_cost, employer: t.employer_contribution, managementFee: t.management_fee }, t.internal),
    }];
  });
  // No substitute estimates: stale/missing periods are explicitly omitted until refreshed.
  const pnlTotals = rows.reduce((s, r) => ({ contract: s.contract + r.contract_value, invoice: s.invoice + r.invoice_amount, payroll: s.payroll + r.payroll_cost, employer: s.employer + r.employer_contribution }), { contract: 0, invoice: 0, payroll: 0, employer: 0 });
  return { pnlRows: rows, pnlTotals, pending: pending.length };
}