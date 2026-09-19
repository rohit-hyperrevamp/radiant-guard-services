import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";

export type PayrollWindow = {
  windowStartDay: number;
  windowEndDay: number;
};

export type PayrollPeriod = {
  start: string;
  end: string;
  mtdEnd: string;
  elapsedDays: number;
  totalDays: number;
};

export type PayrollWindowOption = PayrollWindow & {
  key: string;
  label: string;
  unitCount: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function iso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function inclusiveDays(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

/**
 * Resolve the payroll period represented by a selected payroll month.
 *
 * The period follows the contract's payroll window, exactly like the muster
 * roll: a standard window (1 → 30/31) is the plain calendar month, while a
 * spanning window such as "26 to 25" runs from day 26 of the previous month
 * through day 25 of the viewed month. Keeping this identical to the attendance
 * register is what lets payroll/invoice find the approved attendance sheet.
 */
export function payrollPeriodForMonth(
  year: number,
  monthIdx: number,
  payrollWindow?: PayrollWindow | null,
  today = new Date(),
): PayrollPeriod {
  const startDay = Math.max(1, Number(payrollWindow?.windowStartDay) || 1);
  const endDayRaw = Number(payrollWindow?.windowEndDay) || 0;

  let start: Date;
  let end: Date;
  if (startDay <= 1 || endDayRaw <= 0 || endDayRaw >= startDay) {
    start = new Date(year, monthIdx, 1);
    end = new Date(year, monthIdx, daysInMonth(year, monthIdx));
  } else {
    const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
    const prevYear = monthIdx === 0 ? year - 1 : year;
    start = new Date(prevYear, prevMonthIdx, Math.min(startDay, daysInMonth(prevYear, prevMonthIdx)));
    end = new Date(year, monthIdx, Math.min(endDayRaw, daysInMonth(year, monthIdx)));
  }

  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const capped = todayDate < start ? start : todayDate > end ? end : todayDate;

  return {
    start: iso(start),
    end: iso(end),
    mtdEnd: iso(capped),
    elapsedDays: todayDate < start ? 0 : inclusiveDays(start, capped),
    totalDays: inclusiveDays(start, end),
  };
}

export function payrollWindowKey(window: PayrollWindow) {
  return `${window.windowStartDay}-${window.windowEndDay}`;
}

export function payrollWindowLabel(window: PayrollWindow) {
  return window.windowStartDay <= 1
    ? `1 to month end`
    : `${window.windowStartDay} to ${window.windowEndDay}`;
}

export function payrollAnchorForDate(window: PayrollWindow, date = new Date()) {
  const spanning = window.windowStartDay > 1 && window.windowEndDay > 0 && window.windowEndDay < window.windowStartDay;
  const anchor = spanning && date.getDate() > window.windowEndDay
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : new Date(date.getFullYear(), date.getMonth(), 1);
  return { year: anchor.getFullYear(), monthIdx: anchor.getMonth() };
}

export function shiftPayrollAnchor(year: number, monthIdx: number, delta: number) {
  const shifted = new Date(year, monthIdx + delta, 1);
  return { year: shifted.getFullYear(), monthIdx: shifted.getMonth() };
}

export function formatPayrollPeriod(period: Pick<PayrollPeriod, "start" | "end">) {
  const format = (value: string, includeYear: boolean) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      ...(includeYear ? { year: "numeric" as const } : {}),
    }).format(new Date(year, month - 1, day));
  };
  const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
  return `${format(period.start, !sameYear)} – ${format(period.end, true)}`;
}

export function buildPayrollWindowOptions(
  unitIds: string[],
  windowsByUnit: Map<string, PayrollWindow>,
): PayrollWindowOption[] {
  const counts = new Map<string, PayrollWindowOption>();
  for (const unitId of unitIds) {
    const window = windowsByUnit.get(unitId) ?? { windowStartDay: 1, windowEndDay: 31 };
    const key = payrollWindowKey(window);
    const existing = counts.get(key);
    if (existing) existing.unitCount += 1;
    else counts.set(key, { ...window, key, label: payrollWindowLabel(window), unitCount: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => a.windowStartDay - b.windowStartDay || a.windowEndDay - b.windowEndDay);
}



/** Load the active client contract's payroll window for every unit. */
export async function fetchPayrollWindowsByUnit(unitIds: string[]): Promise<Map<string, PayrollWindow>> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const out = new Map<string, PayrollWindow>();
  if (!ids.length) return out;

  const contracts = await fetchInChunks<{ unit_id: string | null; payroll_window_id: string | null }>(
    ids,
    (chunk, from, to) =>
      supabase
        .from("client_contracts")
        .select("unit_id, payroll_window_id, start_date")
        .in("unit_id", chunk)
        .eq("record_type", "client")
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .range(from, to),
  );

  const windowIdByUnit = new Map<string, string>();
  for (const contract of contracts) {
    if (contract.unit_id && contract.payroll_window_id && !windowIdByUnit.has(contract.unit_id)) {
      windowIdByUnit.set(contract.unit_id, contract.payroll_window_id);
    }
  }
  const windowIds = Array.from(new Set(windowIdByUnit.values()));
  if (!windowIds.length) return out;

  const windows = await fetchInChunks<{ id: string; window_start_day: number; window_end_day: number }>(
    windowIds,
    (chunk, from, to) =>
      supabase.from("payroll_windows").select("id, window_start_day, window_end_day").in("id", chunk).range(from, to),
  );
  const byId = new Map(
    windows.map((row) => [
      row.id,
      { windowStartDay: row.window_start_day, windowEndDay: row.window_end_day },
    ]),
  );
  for (const [unitId, windowId] of windowIdByUnit) {
    const payrollWindow = byId.get(windowId);
    if (payrollWindow) out.set(unitId, payrollWindow);
  }
  return out;
}