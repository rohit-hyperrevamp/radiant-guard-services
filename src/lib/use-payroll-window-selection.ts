import { useEffect, useMemo, useState } from "react";
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
  const [selectedKey, setSelectedKey] = useState(initial?.window ?? "");
  const [anchor, setAnchor] = useState(() => ({
    monthIdx: initial?.month ?? new Date().getMonth(),
    year: initial?.year ?? new Date().getFullYear(),
  }));

  useEffect(() => {
    if (!options.length || options.some((option) => option.key === selectedKey)) return;
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
  const selectedWindow = options.find((option) => option.key === selectedKey) ?? options[0];
  const unitIdsForWindow = useMemo(() => {
    if (!selectedWindow) return new Set<string>();
    return new Set(stableIds.filter((id) => {
      const window = windowsQ.data?.get(id) ?? { windowStartDay: 1, windowEndDay: 31 };
      return `${window.windowStartDay}-${window.windowEndDay}` === selectedWindow.key;
    }));
  }, [selectedWindow, stableIds, windowsQ.data]);

  return {
    ...anchor,
    options,
    selectedKey: selectedWindow?.key ?? "",
    selectedWindow,
    windowsByUnit: windowsQ.data ?? new Map(),
    unitIdsForWindow,
    isLoading: windowsQ.isLoading,
    selectWindow,
    shiftCycle,
  };
}