import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady, useHasSupabaseSession } from "@/lib/supabase-ready";
import { fetchAllPages, fetchForIds, runBulk } from "@/lib/supabase-batch";
import { payrollPeriodForMonth, type PayrollWindow } from "@/lib/payroll-period";
import { resolveSavedAttendancePeriod, type SavedAttendancePeriod } from "@/lib/saved-attendance-period";
import { fetchPeriodStatusesForUnitPeriods, PERIOD_STATUS_QK } from "@/lib/period-status";

/**
 * Marker passed as `windows` while payroll windows are still loading
 * (usePayrollWindowSelection returns it). useRegisterPeriods waits for real
 * windows instead of resolving periods with defaults and then fetching saved
 * dates / statuses / contract codes a second time. It is an ordinary empty
 * Map, so any other reader behaves exactly as before.
 */
export const PENDING_WINDOWS: ReadonlyMap<string, PayrollWindow> = new Map();

export function windowsPending(windows: ReadonlyMap<string, PayrollWindow>): boolean {
  return windows === PENDING_WINDOWS;
}

/** Above this many ids the read scans the month instead of id chunks (fetchForIds default). */
export const SAVED_PERIODS_SCAN_THRESHOLD = 450;
/** A prefetched month scan is consumed once, and only if this fresh. */
const SAVED_PERIODS_PREFETCH_MS = 20_000;
const prefetchedScans = new Map<string, { at: number; promise: Promise<SavedAttendancePeriod[]> }>();

function monthBounds(year: number, monthIdx: number) {
  const month = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  return { month, from: `${month}-01`, to: payrollPeriodForMonth(year, monthIdx).end };
}

function savedPeriodsBase(year: number, monthIdx: number) {
  const { from, to } = monthBounds(year, monthIdx);
  return () => supabase.from("attendance_sheets" as never).select("unit_id, period_start, period_end")
    .gte("period_end", from).lte("period_end", to);
}

/**
 * Start the month's sheet-date scan before unit ids are known (while the unit
 * roster loads). The next many-sites fetchSavedPeriods for that month consumes
 * it once; every later read is fresh.
 */
export function prefetchSavedPeriods(year: number, monthIdx: number): void {
  const { month } = monthBounds(year, monthIdx);
  const existing = prefetchedScans.get(month);
  if (existing && Date.now() - existing.at < SAVED_PERIODS_PREFETCH_MS) return;
  const base = savedPeriodsBase(year, monthIdx);
  const promise = supabaseSessionReady().then(() =>
    runBulk(() => fetchAllPages<SavedAttendancePeriod>((a, b) => base().order("id").range(a, b))),
  );
  const entry = { at: Date.now(), promise };
  prefetchedScans.set(month, entry);
  promise.catch(() => {
    if (prefetchedScans.get(month) === entry) prefetchedScans.delete(month);
  });
}

/**
 * Saved sheet dates ending in the viewed month. Many sites: one scan of the
 * month's sheets (already filtered server-side by period_end, paged 1,000 at a
 * time) narrowed to `ids` in memory, instead of a dozen URL-limited id chunks —
 * reusing a scan prefetched while the roster loaded. Few sites: plain id
 * chunks. Same rows either way.
 */
export function fetchSavedPeriods(ids: string[], year: number, monthIdx: number): Promise<SavedAttendancePeriod[]> {
  const { month } = monthBounds(year, monthIdx);
  const base = savedPeriodsBase(year, monthIdx);
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const prefetched = prefetchedScans.get(month);
  if (prefetched && unique.length > SAVED_PERIODS_SCAN_THRESHOLD) {
    prefetchedScans.delete(month);
    if (Date.now() - prefetched.at < SAVED_PERIODS_PREFETCH_MS) {
      const wanted = new Set(unique);
      return prefetched.promise.then((rows) => rows.filter((row) => wanted.has(String(row.unit_id ?? ""))));
    }
  }
  return fetchForIds<SavedAttendancePeriod>(ids, {
    chunk: (chunk, a, b) => base().in("unit_id", chunk).order("id").range(a, b),
    scan: (a, b) => base().order("id").range(a, b),
    idOf: (row) => row.unit_id,
    scanThreshold: SAVED_PERIODS_SCAN_THRESHOLD,
  });
}

/** All three registers and dashboard tiles use the same historical sheet dates. */
export function useRegisterPeriods(unitIds: string[], year: number, monthIdx: number, windows: Map<string, PayrollWindow>, enabledArg = true) {
  const hasSession = useHasSupabaseSession();
  // Periods depend on each unit's payroll window: wait for them, or saved dates,
  // statuses and every money loader keyed on periods would run twice.
  const enabled = enabledArg && !windowsPending(windows);
  const unitKey = [...new Set(unitIds)].sort().join(",");
  const ids = useMemo(() => unitKey ? unitKey.split(",") : [], [unitKey]);
  const month = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  const savedQ = useQuery({
    queryKey: ["attendance-saved-periods", unitKey, month],
    enabled: enabled && hasSession && ids.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      await supabaseSessionReady();
      return fetchSavedPeriods(ids, year, monthIdx);
    },
  });
  const periods = useMemo(() => {
    const result = new Map<string, ReturnType<typeof payrollPeriodForMonth>>();
    for (const id of ids) {
      const expected = payrollPeriodForMonth(year, monthIdx, windows.get(id));
      const resolved = resolveSavedAttendancePeriod(id, expected, month, savedQ.data ?? []);
      const start = new Date(`${resolved.start}T00:00:00`);
      const end = new Date(`${resolved.end}T00:00:00`);
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - start.getTime()) / 86400000) + 1));
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      result.set(id, { ...resolved, totalDays, elapsedDays, mtdEnd: elapsedDays === 0 ? resolved.start : todayIso > resolved.end ? resolved.end : todayIso });
    }
    return result;
  }, [ids, year, monthIdx, windows, month, savedQ.data]);
  const periodKey = [...periods].map(([id, p]) => `${id}:${p.start}:${p.end}`).join("|");
  const statusesQ = useQuery({
    queryKey: [PERIOD_STATUS_QK, "register-all", periodKey],
    enabled: enabled && hasSession && ids.length > 0 && savedQ.isSuccess,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: () => fetchPeriodStatusesForUnitPeriods(periods),
  });
  return { periods, periodKey, periodsReady: enabled && savedQ.isSuccess, statusesQ, isLoading: enabled && hasSession && ids.length > 0 && !savedQ.error && (savedQ.isLoading || (savedQ.isSuccess && statusesQ.isLoading)), error: savedQ.error ?? statusesQ.error };
}