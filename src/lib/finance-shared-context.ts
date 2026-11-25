/**
 * One shared read of the period-wide inputs both bulk engines need
 * (computeDashboardUnitFinance + computePayrollUnitsTotals), per register load.
 *
 * The register live-computes stale sites in batches; every batch used to reload
 * the same formula masters, holidays, ESI flag, rate revisions, additions and
 * deductions for both engines. The context loads them ONCE for the register's
 * whole window and hands every batch its own deep copy, filtered in memory to
 * exactly the rows that batch's own server query used to return — so every
 * engine sees identical inputs and computes identical money.
 *
 * Browser display only. Server recomputes that save totals never pass a
 * context and keep their own fresh reads.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchForIds, fetchInChunks, runBulk } from "@/lib/supabase-batch";
import { loadAllFormulaMasters, type FormulaMaster } from "@/lib/contract-hydrate";
import { ADDITION_COLS, DEDUCTION_COLS, loadInvoiceGlobals, type InvoiceGlobals } from "@/lib/invoice-engine";
import { fetchAllRevisions } from "@/lib/invoice-engine-bulk";
import { fetchEnabledPublicHolidaysWith, type PublicHoliday } from "@/lib/public-holidays";
import { fetchPlatformFlag, PLATFORM_SETTING_KEYS } from "@/lib/platform-settings";
import type { RateRevisionRow } from "@/lib/rate-revisions";
import { REFERENCE_QK } from "@/lib/reference-data";

type Row = Record<string, unknown>;
type Periods = Map<string, { start: string; end: string }>;
type Db = typeof supabase;

const s = (v: unknown) => String(v ?? "");
const fields = (cols: string) => cols.split(",").map((c) => c.trim()).filter(Boolean);

/** Columns (and order) each engine's own additions / deductions query selects. */
export const INVOICE_ADDITION_FIELDS = [...fields(ADDITION_COLS), "addition_date", "end_date", "unit_id"];
export const INVOICE_DEDUCTION_FIELDS = [...fields(DEDUCTION_COLS), "deduction_date", "unit_id"];
export const PAYROLL_ADDITION_FIELDS = fields("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi, formula_expression, per_day_amount, addition_date, end_date, unit_id");
export const PAYROLL_DEDUCTION_FIELDS = fields("candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, deduction_date, unit_id");
const union = (...lists: string[][]) => Array.from(new Set(lists.flat()));
const ADDITION_READ = union(INVOICE_ADDITION_FIELDS, PAYROLL_ADDITION_FIELDS).join(", ");
const DEDUCTION_READ = union(INVOICE_DEDUCTION_FIELDS, PAYROLL_DEDUCTION_FIELDS).join(", ");

export type FinanceWindow = { minStart: string; maxEnd: string };

export function financeWindowOf(periods: Periods): FinanceWindow | null {
  if (!periods.size) return null;
  const starts = [...periods.values()].map((p) => p.start).sort();
  const ends = [...periods.values()].map((p) => p.end).sort();
  return { minStart: starts[0]!, maxEnd: ends[ends.length - 1]! };
}

/** Payroll reads deductions from 62 days before the window (joining fees carry into a first window). */
export function payrollDeductionFrom(minStart: string): string {
  const d = new Date(`${minStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 62);
  return d.toISOString().slice(0, 10);
}

/** PostgREST filter: additions dated in the window, or repeating ones still running at its start (the single-site rule). */
export function additionLowerBound(minStart: string): string {
  return `addition_date.gte.${minStart},and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.${minStart}))`;
}

/** The same rule in memory (plus the upper bound): `addition_date <= maxEnd` and additionLowerBound(minStart). */
export function additionInWindow(a: Row, minStart: string, maxEnd: string): boolean {
  const date = a.addition_date ? s(a.addition_date) : null;
  if (!date || date > maxEnd) return false;
  return date >= minStart || (a.repeat_monthly === true && (!a.end_date || s(a.end_date) >= minStart));
}

export type FinanceSharedContext = {
  /** Client the context was read through: only callers using the same client may use it. */
  db: object;
  window: FinanceWindow & { dedFrom: string };
  masters: Map<string, FormulaMaster>;
  invoiceGlobals: InvoiceGlobals;
  holidays: PublicHoliday[];
  esiRoundUp: boolean;
  revisions: RateRevisionRow[] | null;
  /** Active additions in the window (both engines' columns), ordered by id. */
  additions: Row[];
  /** Active deductions from payroll's 62-day lead-in to the window end, ordered by id. */
  deductions: Row[];
  /** Period-wide scans shared by batches (payroll snapshots / PT allocations by month). */
  memo: Map<string, Promise<Row[]>>;
};

/** Reads every shared input once for this window. */
export async function loadFinanceSharedContext(window: FinanceWindow, db: Db = supabase): Promise<FinanceSharedContext> {
  const dedFrom = payrollDeductionFrom(window.minStart);
  const all = (q: (a: number, b: number) => unknown) => fetchInChunks<Row>(["x"], (_c, a, b) => q(a, b) as never);
  const mastersP = loadAllFormulaMasters(db);
  const [masters, invoiceGlobals, holidays, esiRoundUp, revisions, additions, deductions] = await Promise.all([
    mastersP,
    loadInvoiceGlobals([], null, mastersP, db),
    fetchEnabledPublicHolidaysWith(db),
    fetchPlatformFlag(PLATFORM_SETTING_KEYS.esiRoundUp, true, db),
    fetchAllRevisions(db),
    all((a, b) => db.from("additions" as never).select(ADDITION_READ).eq("status", "active").lte("addition_date", window.maxEnd).or(additionLowerBound(window.minStart)).order("id").range(a, b)),
    all((a, b) => db.from("deductions" as never).select(DEDUCTION_READ).eq("status", "active").gte("deduction_date", dedFrom).lte("deduction_date", window.maxEnd).order("id").range(a, b)),
  ]);
  return { db, window: { ...window, dedFrom }, masters, invoiceGlobals, holidays, esiRoundUp, revisions, additions, deductions, memo: new Map() };
}

/** Usable for a batch read through `db` over [minStart, maxEnd]? */
export function contextCovers(ctx: FinanceSharedContext | null | undefined, db: object, minStart: string, maxEnd: string): ctx is FinanceSharedContext {
  return !!ctx && ctx.db === db && ctx.window.minStart <= minStart && ctx.window.maxEnd >= maxEnd;
}

const project = (cols: string[]) => (r: Row): Row => Object.fromEntries(cols.map((c) => [c, r[c]]));

/** Exactly the additions an engine's own query returns for a batch window, in its column order. */
export function contextAdditions(ctx: FinanceSharedContext, cols: string[], minStart: string, maxEnd: string): Row[] {
  return structuredClone(ctx.additions.filter((a) => additionInWindow(a, minStart, maxEnd)).map(project(cols)));
}

/** Exactly the deductions an engine's own query returns for [from, maxEnd], in its column order. */
export function contextDeductions(ctx: FinanceSharedContext, cols: string[], from: string, maxEnd: string): Row[] {
  return structuredClone(ctx.deductions.filter((d) => {
    const date = d.deduction_date ? s(d.deduction_date) : null;
    return !!date && date >= from && date <= maxEnd;
  }).map(project(cols)));
}

/** Own copy of a shared value (Maps / Sets included), so no engine sees another's edits. */
export const contextCopy = <T,>(v: T): T => structuredClone(v);

/** Above this many people a period-wide scan beats candidate-id chunks (fetchForIds' default). */
const SCAN_THRESHOLD = 450;

const monthBounds = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return { y: y!, mo: mo!, ms: `${m}-01`, me: new Date(Date.UTC(y!, mo!, 0)).toISOString().slice(0, 10) };
};

/**
 * Rows of a per-month people read for `ids`: a few candidate-id chunks for a
 * small roster, else one period-filtered scan (shared by every batch of the
 * register through the context) narrowed to `ids` in memory. Both paths
 * select the same rows for these people; both are ordered by id.
 */
async function monthPeopleRows(
  ctx: FinanceSharedContext | null,
  key: string,
  ids: string[],
  chunk: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  scan: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Row[]> {
  if (!ctx || ids.length <= SCAN_THRESHOLD) return fetchForIds<Row>(ids, { chunk, scan, idOf: (r) => s(r.candidate_id), scanThreshold: SCAN_THRESHOLD });
  let shared = ctx.memo.get(key);
  if (!shared) {
    shared = runBulk(() => fetchAllPages<Row>(scan));
    ctx.memo.set(key, shared);
    shared.catch(() => { if (ctx.memo.get(key) === shared) ctx.memo.delete(key); });
  }
  const wanted = new Set(ids);
  return structuredClone((await shared).filter((r) => wanted.has(s(r.candidate_id))));
}

/**
 * The people-wide reads of bulk payroll: own wage setups, processed snapshots
 * at other sites (per month) and recorded PT splits (per month).
 */
export async function loadPayrollPeopleReads(db: Db, everyone: string[], months: string[], ctx: FinanceSharedContext | null) {
  const from = db as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  return Promise.all([
    // Wage setups stay candidate-id chunks: a person may hold several unit rows
    // and the page keeps the last one read, so their read order is left as is.
    fetchInChunks<Row>(everyone, (chunk, a, b) => db.from("employee_wages" as never).select("candidate_id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id").in("candidate_id", chunk).range(a, b) as never),
    Promise.all(months.map(async (m) => {
      const { ms, me } = monthBounds(m);
      const base = () => from
        .from("payroll_run_snapshots")
        .select("candidate_id, payroll_run_id, version, gross, deductions, payroll_runs!inner(unit_id, period_end, payroll_status)")
        .eq("payroll_runs.payroll_status", "processed")
        .gte("payroll_runs.period_end", ms).lte("payroll_runs.period_end", me);
      const rows = await monthPeopleRows(ctx, `snapshots:${m}`, everyone,
        (chunk, a, b) => base().in("candidate_id", chunk).order("id").range(a, b),
        (a, b) => base().order("id").range(a, b));
      return [m, rows] as const;
    })),
    Promise.all(months.map(async (m) => {
      const { y, mo } = monthBounds(m);
      // One split per person / site / month: (person, site) orders pages deterministically.
      const base = () => from.from("pt_site_allocations").select("candidate_id, unit_id, pt_amount").eq("period_year", y).eq("period_month", mo);
      const ordered = (q: any) => q.order("candidate_id").order("unit_id").order("pt_amount"); // eslint-disable-line @typescript-eslint/no-explicit-any
      const rows = await monthPeopleRows(ctx, `allocations:${m}`, everyone,
        (chunk, a, b) => ordered(base().in("candidate_id", chunk)).range(a, b),
        (a, b) => ordered(base()).range(a, b));
      return [m, rows] as const;
    })),
  ]);
}

export const FINANCE_CONTEXT_STALE_MS = 60_000;
export const financeContextKey = (w: FinanceWindow) => [REFERENCE_QK, "finance-context", w.minStart, w.maxEnd] as const;

/**
 * The register's shared context, cached in react-query for 60 s under
 * ["reference", "finance-context", …] (master edits invalidate it through
 * invalidateReference). Concurrent batches share one load.
 */
export function getFinanceSharedContext(qc: QueryClient, periods: Periods): Promise<FinanceSharedContext | null> {
  const w = financeWindowOf(periods);
  if (!w) return Promise.resolve(null);
  return qc.fetchQuery({ queryKey: financeContextKey(w), staleTime: FINANCE_CONTEXT_STALE_MS, queryFn: () => loadFinanceSharedContext(w) });
}
