import { computeFinanceSummaries } from "@/lib/finance-summary-compute";
import { FINANCE_CALCULATION_VERSION, type SavedFinanceRow } from "@/lib/finance-totals";

type ClaimedRow = SavedFinanceRow & { lease_token: string };
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
type Compute = (periods: Map<string, { start: string; end: string }>) => Promise<Map<string, unknown>>;

const publishRow = (r: ClaimedRow, totals: unknown) => ({
  unit_id: r.unit_id,
  period_start: r.period_start,
  period_end: r.period_end,
  generation: r.generation,
  lease_token: r.lease_token,
  calculation_version: FINANCE_CALCULATION_VERSION,
  totals,
});
const failRow = (r: ClaimedRow) => ({
  unit_id: r.unit_id,
  period_start: r.period_start,
  period_end: r.period_end,
  lease_token: r.lease_token,
});

/**
 * Computes one group (one window per site). If the batch throws, every site is
 * retried on its own so a single broken site can't fail the other 39 — before
 * this, one bad site left the whole batch "failed" forever, and every register
 * load then recomputed those sites live in the browser.
 */
export async function computeGroupIsolated(
  group: ClaimedRow[],
  compute: Compute,
  onError: (unitId: string | null, message: string) => void = () => {},
): Promise<{ ok: Array<{ row: ClaimedRow; totals: unknown }>; failed: ClaimedRow[] }> {
  const periodsOf = (rows: ClaimedRow[]) =>
    new Map(rows.map((r) => [r.unit_id, { start: r.period_start, end: r.period_end }]));
  const ok: Array<{ row: ClaimedRow; totals: unknown }> = [];
  const failed: ClaimedRow[] = [];
  try {
    const totals = await compute(periodsOf(group));
    for (const r of group) {
      if (totals.has(r.unit_id)) ok.push({ row: r, totals: totals.get(r.unit_id) });
      else failed.push(r);
    }
    return { ok, failed };
  } catch (batchError) {
    onError(null, batchError instanceof Error ? batchError.message : String(batchError));
  }
  for (const r of group) {
    try {
      const totals = await compute(periodsOf([r]));
      if (totals.has(r.unit_id)) ok.push({ row: r, totals: totals.get(r.unit_id) });
      else failed.push(r);
    } catch (e) {
      onError(r.unit_id, e instanceof Error ? e.message : String(e));
      failed.push(r);
    }
  }
  return { ok, failed };
}

export async function refreshFinanceSummaries() {
  const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as Rpc;
  const claimed = await rpc("claim_finance_totals", { p_limit: 40 });
  if (claimed.error) throw new Error(claimed.error.message);
  const rows = (claimed.data ?? []) as ClaimedRow[];
  let published = 0;
  let failedCount = 0;
  // Each map contains one exact window per site; historical windows never overwrite each other.
  const groups: ClaimedRow[][] = [];
  for (const row of rows) {
    const group = groups.find((g) => !g.some((r) => r.unit_id === row.unit_id));
    if (group) group.push(row);
    else groups.push([row]);
  }
  const compute: Compute = (periods) =>
    computeFinanceSummaries(periods, supabaseAdmin) as unknown as Promise<Map<string, unknown>>;
  for (const group of groups) {
    const { ok, failed } = await computeGroupIsolated(group, compute, (unitId, message) => {
      // Server log only (no finance figures): lets failing sites be diagnosed.
      console.error("[finance-refresh] compute failed", unitId ?? "batch", message.slice(0, 300));
    });
    if (failed.length) {
      failedCount += failed.length;
      const res = await rpc("fail_finance_totals", { p_rows: failed.map(failRow) });
      if (res.error) throw new Error(res.error.message);
    }
    if (ok.length) {
      const result = await rpc("publish_finance_totals", { p_rows: ok.map(({ row, totals }) => publishRow(row, totals)) });
      if (result.error) {
        // Never keep half-published batches: mark them failed so they retry later.
        await rpc("fail_finance_totals", { p_rows: ok.map(({ row }) => failRow(row)) });
        throw new Error(result.error.message);
      }
      published += Number(result.data) || 0;
    }
  }
  await rpc("continue_finance_refresh");
  if (failedCount) console.error("[finance-refresh] sites failed this run:", failedCount);
  return { claimed: rows.length, published };
}
