import { computeFinanceSummaries } from "@/lib/finance-summary-compute";
import { FINANCE_CALCULATION_VERSION, type SavedFinanceRow } from "@/lib/finance-totals";

type ClaimedRow = SavedFinanceRow & { lease_token: string };

export async function refreshFinanceSummaries() {
  const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const claimed = await rpc("claim_finance_totals", { p_limit: 40 });
  if (claimed.error) throw new Error(claimed.error.message);
  const rows = (claimed.data ?? []) as ClaimedRow[];
  let published = 0;
  // Each map contains one exact window per site; historical windows never overwrite each other.
  const groups: ClaimedRow[][] = [];
  for (const row of rows) {
    const group = groups.find((g) => !g.some((r) => r.unit_id === row.unit_id));
    if (group) group.push(row); else groups.push([row]);
  }
  for (const group of groups) {
    try {
      const periods = new Map(group.map((r) => [r.unit_id, { start: r.period_start, end: r.period_end }]));
      const totals = await computeFinanceSummaries(periods, supabaseAdmin);
      const available = group.filter((r) => totals.has(r.unit_id));
      const missing = group.filter((r) => !totals.has(r.unit_id));
      if (missing.length) await rpc("fail_finance_totals", { p_rows: missing });
      const result = await rpc("publish_finance_totals", { p_rows: available.map((r) => ({
        unit_id: r.unit_id, period_start: r.period_start, period_end: r.period_end,
        generation: r.generation, lease_token: r.lease_token, calculation_version: FINANCE_CALCULATION_VERSION, totals: totals.get(r.unit_id),
      })) });
      if (result.error) throw new Error(result.error.message);
      published += Number(result.data) || 0;
    } catch {
      // Do not retain partial results, leak finance details, or spin on a failing batch.
      const result = await rpc("fail_finance_totals", { p_rows: group.map((r) => ({
        unit_id: r.unit_id, period_start: r.period_start, period_end: r.period_end, lease_token: r.lease_token,
      })) });
      if (result.error) throw new Error(result.error.message);
    }
  }
  await rpc("continue_finance_refresh");
  return { claimed: rows.length, published };
}