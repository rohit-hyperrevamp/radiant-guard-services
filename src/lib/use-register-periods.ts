import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady, useHasSupabaseSession } from "@/lib/supabase-ready";
import { fetchInChunks } from "@/lib/supabase-batch";
import { payrollPeriodForMonth, type PayrollWindow } from "@/lib/payroll-period";
import { resolveSavedAttendancePeriod, type SavedAttendancePeriod } from "@/lib/saved-attendance-period";
import { fetchPeriodStatusesForUnitPeriods, PERIOD_STATUS_QK } from "@/lib/period-status";

/** All three registers and dashboard tiles use the same historical sheet dates. */
export function useRegisterPeriods(unitIds: string[], year: number, monthIdx: number, windows: Map<string, PayrollWindow>, enabled = true) {
  const hasSession = useHasSupabaseSession();
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
      return fetchInChunks<SavedAttendancePeriod>(ids, (chunk, from, to) =>
        supabase.from("attendance_sheets" as never).select("unit_id, period_start, period_end")
          .in("unit_id", chunk).gte("period_end", `${month}-01`)
          .lte("period_end", payrollPeriodForMonth(year, monthIdx).end).order("id").range(from, to));
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
  return { periods, periodKey, periodsReady: savedQ.isSuccess, statusesQ, isLoading: enabled && hasSession && ids.length > 0 && !savedQ.error && (savedQ.isLoading || (savedQ.isSuccess && statusesQ.isLoading)), error: savedQ.error ?? statusesQ.error };
}