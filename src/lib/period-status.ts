import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Period lifecycle shared by Attendance → Payroll → Invoice.
 *
 * Attendance (`attendance_sheets.status`)
 *   draft      → open, editable
 *   submitted  → awaiting approval, locked for the field officer
 *   approved   → locked; only an approver/admin can reopen
 *   rejected   → back to open
 *
 * Payroll & Invoice (`payroll_runs`)
 *   Stay OPEN until the attendance sheet for that unit+period is approved and
 *   handed off. Once the register has been run, they are marked PROCESSED
 *   (`payroll_status` / `invoice_status`), which locks the money for the
 *   period until an admin reopens it.
 */

export type AttendanceStatus = "draft" | "submitted" | "approved" | "rejected" | "none";
export type MoneyStatus = "open" | "ready" | "approved" | "processed";

export type PeriodStatus = {
  unitId: string;
  attendance: AttendanceStatus;
  handedOff: boolean;
  payroll: MoneyStatus;
  invoice: MoneyStatus;
  runId: string | null;
};

export type PeriodStatusMap = Map<string, PeriodStatus>;

export const PERIOD_STATUS_QK = "period-status-v1";

export function periodStatusQueryKey(unitIds: string[], start: string, end: string) {
  return [PERIOD_STATUS_QK, unitIds.join(","), start, end] as const;
}

export async function fetchPeriodStatuses(
  unitIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<PeriodStatusMap> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const out: PeriodStatusMap = new Map();
  if (!ids.length) return out;

  const [{ data: sheets }, { data: runs }, { data: finals }] = await Promise.all([
    supabase
      .from("attendance_sheets" as never)
      .select("unit_id, status, tally_invoice_path")
      .in("unit_id", ids)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd),
    supabase
      .from("payroll_runs" as never)
      .select("id, unit_id, status, payroll_status, invoice_status")
      .in("unit_id", ids)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd),
    supabase
      .from("final_invoice_units" as never)
      .select("unit_id")
      .in("unit_id", ids)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd),
  ]);
  // A generated final invoice has used its number for good, so the site is
  // "Invoice processed" from that moment; the Tally copy can still be uploaded.
  const finalised = new Set(((finals ?? []) as unknown as Array<{ unit_id: string }>).map((f) => f.unit_id));

  const sheetRows = ((sheets ?? []) as unknown) as Array<{
    unit_id: string;
    status: AttendanceStatus;
    tally_invoice_path: string | null;
  }>;
  const runRows = ((runs ?? []) as unknown) as Array<{
    id: string;
    unit_id: string;
    status: string;
    payroll_status: string | null;
    invoice_status: string | null;
  }>;

  const sheetByUnit = new Map(sheetRows.map((s) => [s.unit_id, s]));
  const runByUnit = new Map(runRows.map((r) => [r.unit_id, r]));

  for (const unitId of ids) {
    const sheet = sheetByUnit.get(unitId);
    const attendance = sheet?.status ?? "none";
    const run = runByUnit.get(unitId);
    const handedOff = ["submitted", "approved"].includes(run?.status ?? "");
    const ready = attendance === "approved";
    const money = (value: string | null | undefined): MoneyStatus =>
      value === "processed" ? "processed" : ready ? "ready" : "open";
    out.set(unitId, {
      unitId,
      attendance,
      handedOff,
      payroll:
        run?.payroll_status !== "processed" && ready && run?.status === "approved"
          ? "approved"
          : money(run?.payroll_status),
      invoice: sheet?.tally_invoice_path || finalised.has(unitId) ? "processed" : ready ? "ready" : "open",
      runId: run?.id ?? null,
    });
  }

  return out;
}

/** Periods per batch_period_statuses call: below the 1,000-row response cap with room for split parts. */
export const PERIOD_STATUS_RPC_CHUNK = 900;
const RPC_PAGE = 1000;

type PeriodRequest = { unit_id: string; period_start: string; period_end: string };

export function chunkPeriodRequests<T>(requested: T[], size = PERIOD_STATUS_RPC_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < requested.length; i += size) chunks.push(requested.slice(i, i + size));
  return chunks;
}

/** One RPC call per chunk; a full page (split-invoice rows) pulls the next one. */
async function fetchStatusPages(chunk: PeriodRequest[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += RPC_PAGE) {
    // Ordered so pages are stable; rows sharing a unit_id are identical.
    const { data, error } = await supabase
      .rpc("batch_period_statuses" as never, { p_periods: chunk } as never)
      .order("unit_id" as never)
      .range(from, from + RPC_PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown[];
    out.push(...page);
    if (page.length < RPC_PAGE) break;
  }
  return out;
}

export async function fetchPeriodStatusesForUnitPeriods(
  periods: Map<string, { start: string; end: string }>,
): Promise<PeriodStatusMap> {
  const out: PeriodStatusMap = new Map();
  if (periods.size === 0) return out;

  const requested = Array.from(periods, ([unit_id, period]) => ({
    unit_id,
    period_start: period.start,
    period_end: period.end,
  }));
  // The API caps any single response at 1,000 rows (and a split invoice adds
  // a row per part), so each call carries up to 900 periods and is paged in
  // the rare case it still fills a page — ~2 calls for 1,800 sites instead of 4.
  const results = await Promise.all(
    chunkPeriodRequests(requested).map((chunk) => fetchStatusPages(chunk)),
  );
  const rows = results.flat() as unknown as Array<{
    unit_id: string;
    attendance_status: AttendanceStatus | null;
    tally_invoice_path: string | null;
    run_id: string | null;
    run_status: string | null;
    payroll_status: string | null;
    invoice_status: string | null;
    finalised: boolean;
  }>;
  for (const row of rows) {
    const attendance = row.attendance_status ?? "none";
    const ready = attendance === "approved";
    const money = (value: string | null): MoneyStatus =>
      value === "processed" ? "processed" : ready ? "ready" : "open";
    out.set(row.unit_id, {
      unitId: row.unit_id,
      attendance,
      handedOff: ["submitted", "approved"].includes(row.run_status ?? ""),
      payroll:
        row.payroll_status !== "processed" && ready && row.run_status === "approved"
          ? "approved"
          : money(row.payroll_status),
      invoice: row.tally_invoice_path || row.finalised ? "processed" : money(row.invoice_status),
      runId: row.run_id,
    });
  }
  return out;
}

/** Ensure a payroll_runs row exists for the unit+period, then return its id. */
async function ensureRun(unitId: string, periodStart: string, periodEnd: string): Promise<string> {
  const { data: existing } = await supabase
    .from("payroll_runs" as never)
    .select("id")
    .eq("unit_id", unitId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();
  const id = (existing as { id?: string } | null)?.id;
  if (id) return id;

  const { data, error } = await supabase
    .from("payroll_runs" as never)
    .insert({ unit_id: unitId, period_start: periodStart, period_end: periodEnd, status: "draft" } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
}

export async function setMoneyStatus(params: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  kind: "payroll" | "invoice";
  next: "processed" | "open";
}): Promise<void> {
  const runId = await ensureRun(params.unitId, params.periodStart, params.periodEnd);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const ts = params.next === "processed" ? new Date().toISOString() : null;
  const patch: Record<string, unknown> =
    params.kind === "payroll"
      ? { payroll_status: params.next, payroll_processed_at: ts, payroll_processed_by: ts ? uid : null }
      : { invoice_status: params.next, invoice_processed_at: ts, invoice_processed_by: ts ? uid : null };

  const { error } = await supabase.from("payroll_runs" as never).update(patch as never).eq("id", runId);
  if (error) throw error;
}

/** Batching window for realtime refreshes — status flips are rare, refetches are not cheap. */
export const REALTIME_REFRESH_MS = 30_000;

const REALTIME_PREFIXES = [
  "dashboard-counts",
  "dashboard-pnl",
  "attendance",
  "finance-charter",
  "payroll",
  "invoice",
  "live-contract-deductions",
];

/** A changed unit + payroll month (YYYY-MM of period_end), or "all" when the payload lacks them. */
export type RealtimeTarget = { unitId: string; month: string | null } | "all";

export function realtimeTargetOf(payload: { new?: unknown; old?: unknown }): RealtimeTarget {
  const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const n = rec(payload.new);
  const o = rec(payload.old);
  const unitId = (n.unit_id ?? o.unit_id) as string | undefined;
  if (!unitId) return "all";
  const end = (n.period_end ?? o.period_end) as string | undefined;
  return { unitId: String(unitId), month: end ? String(end).slice(0, 7) : null };
}

const DATE_LIKE = /\d{4}-\d{2}/;

/**
 * Should this query refresh for these changes? Only register / money keys, and
 * only those naming a changed unit — and, when the key carries dates, the
 * changed payroll month. "all" (unknown target) refreshes every such key.
 */
export function realtimeKeyMatches(queryKey: readonly unknown[], targets: RealtimeTarget[]): boolean {
  const head = queryKey[0];
  if (typeof head !== "string") return false;
  if (head !== PERIOD_STATUS_QK && !REALTIME_PREFIXES.some((p) => head.startsWith(p))) return false;
  if (targets.some((t) => t === "all")) return true;
  const text = JSON.stringify(queryKey);
  const hasDates = DATE_LIKE.test(text);
  return targets.some((t) => t !== "all" && text.includes(t.unitId) && (!hasDates || !t.month || text.includes(t.month)));
}

/**
 * Live wiring: a sheet transition or payroll-run change refreshes the
 * attendance / payroll / invoice surfaces showing that unit and month. Changes
 * are collected for REALTIME_REFRESH_MS and flushed together, so a burst of
 * approvals costs one refresh instead of a refetch storm.
 */
export function useAttendanceMoneyRealtime() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let pending: RealtimeTarget[] = [];
    const flush = () => {
      timerRef.current = null;
      const targets = pending;
      pending = [];
      if (!targets.length) return;
      void qc.invalidateQueries({ predicate: (query) => realtimeKeyMatches(query.queryKey, targets) });
    };
    const onChange = (payload: { new?: unknown; old?: unknown }) => {
      pending.push(realtimeTargetOf(payload));
      // Max-wait batching: the first change starts the window; later ones join it.
      if (!timerRef.current) timerRef.current = setTimeout(flush, REALTIME_REFRESH_MS);
    };

    // Only status changes (sheet submitted/approved, payroll run updated) refresh
    // money pages. Per-day attendance rows change thousands of times a day (guard
    // punches, bulk imports); listening to them re-downloaded every open payroll
    // and invoice page continuously and overloaded the database.
    const channel = supabase
      .channel("attendance-money-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sheets" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_runs" }, onChange)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
