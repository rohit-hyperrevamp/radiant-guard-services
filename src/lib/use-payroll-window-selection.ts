import { useEffect, useMemo } from "react";
import { useSessionState } from "@/lib/use-session-state";
import { useQuery } from "@tanstack/react-query";
import {
  buildPayrollWindowOptions,
  fetchPayrollWindowsByUnit,
  payrollAnchorForDate,
  payrollPeriodForMonth,
  shiftPayrollAnchor,
} from "@/lib/payroll-period";

export function usePayrollWindowSelection(
  unitIds: string[],
  initial?: { window?: string; month?: number; year?: number },
  storageKey = "payroll-window",
) {
  const unitKey = Array.from(new Set(unitIds)).sort().join(",");
  const stableIds = useMemo(() => unitKey ? unitKey.split(",") : [], [unitKey]);
  const windowsQ = useQuery({
    queryKey: ["charter-payroll-windows-all", unitKey],
    enabled: stableIds.length > 0,
    queryFn: () => fetchPayrollWindowsByUnit(stableIds),
  });
  const options = useMemo(
    () => buildPayrollWindowOptions(stableIds, windowsQ.data ?? new Map()),
    [stableIds, windowsQ.data],
  );
  const [storedKey, setSelectedKey] = useSessionState<string>(`${storageKey}:window`, "all");
  const selectedKey = storedKey;
  const [storedAnchor, setAnchor] = useSessionState(`${storageKey}:anchor`, () => ({
    monthIdx: new Date().getMonth(),
    year: new Date().getFullYear(),
  }));
  const anchor = storedAnchor;
  // Links that carry window/month/year in the URL win once, on arrival.
  useEffect(() => {
    if (initial?.window) setSelectedKey(initial.window);
    if (initial?.month != null && initial?.year != null) setAnchor({ monthIdx: initial.month, year: initial.year });
  }, [initial?.window, initial?.month, initial?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!options.length || selectedKey === "all" || options.some((option) => option.key === selectedKey)) return;
    const today = new Date();
    const containing = options
      .map((option) => {
        const nextAnchor = payrollAnchorForDate(option, today);
        const period = payrollPeriodForMonth(nextAnchor.year, nextAnchor.monthIdx, option, today);
        return { option, anchor: nextAnchor, period };
      })
      .filter(({ period }) => period.start <= period.mtdEnd && period.mtdEnd <= period.end)
      .sort((a, b) => a.period.end.localeCompare(b.period.end));
    const chosen = containing[0] ?? {
      option: options[0],
      anchor: payrollAnchorForDate(options[0], today),
    };
    setSelectedKey(chosen.option.key);
    if (initial?.month == null || initial?.year == null) setAnchor(chosen.anchor);
  }, [initial?.month, initial?.year, options, selectedKey]);

  const selectWindow = (key: string) => {
    setSelectedKey(key);
  };
  const shiftCycle = (delta: number) => setAnchor((current) => shiftPayrollAnchor(current.year, current.monthIdx, delta));
  const setPeriod = (year: number, monthIdx: number) => setAnchor({ year, monthIdx });
  const selectedWindow = options.find((option) => option.key === selectedKey);
  const unitIdsForWindow = useMemo(() => {
    if (selectedKey === "all") return new Set(stableIds);
    if (!selectedWindow) return new Set<string>();
    return new Set(stableIds.filter((id) => {
      const window = windowsQ.data?.get(id) ?? { windowStartDay: 1, windowEndDay: 31 };
      return `${window.windowStartDay}-${window.windowEndDay}` === selectedWindow.key;
    }));
  }, [selectedKey, selectedWindow, stableIds, windowsQ.data]);

  return {
    ...anchor,
    options,
    selectedKey: selectedKey === "all" ? "all" : (selectedWindow?.key ?? "all"),
    selectedWindow,
    windowsByUnit: windowsQ.data ?? new Map(),
    unitIdsForWindow,
    isLoading: windowsQ.isLoading,
    selectWindow,
    shiftCycle,
    setPeriod,
  };
}