import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PERIOD_STATUS_QK } from "@/lib/period-status";
import { createThrottle, uniqueChannelName } from "@/lib/dashboard-realtime";

/** Query-key roots the dashboard's money tiles read. */
const DASHBOARD_MONEY_ROOTS = ["dashboard-counts", "dashboard-pnl", "attendance-saved-periods"];

export function isDashboardMoneyKey(key: readonly unknown[]): boolean {
  const root = key[0];
  if (typeof root !== "string") return false;
  return root === PERIOD_STATUS_QK || DASHBOARD_MONEY_ROOTS.some((p) => root.startsWith(p));
}

/**
 * Dashboard-scoped replacement for `useAttendanceMoneyRealtime`: listens to
 * sheet and payroll-run status changes only, refreshes only the dashboard's
 * own figures (not every payroll / invoice / attendance page in the cache),
 * and at most once every 30 s.
 */
export function useDashboardMoneyRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const throttle = createThrottle(() => {
      void qc.invalidateQueries({ predicate: (q) => isDashboardMoneyKey(q.queryKey) });
    });
    const channel = supabase
      .channel(uniqueChannelName("dashboard-money-live"))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sheets" }, throttle.run)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_runs" }, throttle.run)
      .subscribe();
    return () => {
      throttle.cancel();
      void supabase.removeChannel(channel);
    };
  }, [qc, enabled]);
}
