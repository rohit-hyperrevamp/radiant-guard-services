// Resolve how many days can be marked as "Present" (P) in a payroll period.
// Driven entirely by the Payroll Days Manager entry attached to a contract
// resource — never hard-coded. Anything beyond this cap must be paid as OT.

export type PayrollDayBaseLike = {
  method:
    | "actual_days"
    | "fixed_days"
    | "actual_minus_weekly_off"
    | "custom_weekdays"
    | "fixed_annual_average"
    /** Actual days in the period minus a fixed number (e.g. 31 − 4 = 27). */
    | "actual_minus_days";
  fixedDays?: number | null;
  weeklyOffDay?: number | null;
  includedWeekdays?: number[] | null;
};

/** Fallback only: used when a `fixed_annual_average` base carries no explicit
 *  day count. Any base can override it by storing its own `fixed_days`. */
const ANNUAL_AVERAGE_DAYS = 30.4166;

export type DayCountOptions = {
  /**
   * Clamp the result to the number of days in the period.
   * TRUE for payroll (you cannot be present more days than the month has),
   * FALSE for a billing divisor (a 30.40-day divisor stays 30.40 even in a
   * 28-day billing cycle).
   */
  clampToPeriod?: boolean;
};

/** Period dates as ISO strings (YYYY-MM-DD). */
export function resolvePayrollDayCount(
  base: PayrollDayBaseLike | null | undefined,
  periodDates: string[],
  options: DayCountOptions = {},
): number | null {
  const clamp = options.clampToPeriod !== false;
  const total = periodDates.length;
  if (!base || total === 0) return null;
  const weekday = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  };
  switch (base.method) {
    case "fixed_days": {
      const n = Number(base.fixedDays) || 0;
      if (n <= 0) return null;
      return clamp ? Math.min(n, total) : n;
    }
    case "fixed_annual_average": {
      const configured = Number(base.fixedDays);
      return Number.isFinite(configured) && configured > 0 ? configured : ANNUAL_AVERAGE_DAYS;
    }

    case "actual_days":
      return total;
    case "actual_minus_days": {
      const subtract = Number(base.fixedDays);
      if (!Number.isFinite(subtract) || subtract <= 0) return total;
      return Math.max(1, total - subtract);
    }
    case "actual_minus_weekly_off": {
      const off = base.weeklyOffDay;
      if (off == null) return total;
      return periodDates.reduce((n, iso) => n + (weekday(iso) === off ? 0 : 1), 0);
    }
    case "custom_weekdays": {
      const allowed = Array.isArray(base.includedWeekdays) ? base.includedWeekdays : [];
      if (allowed.length === 0) return total;
      return periodDates.reduce((n, iso) => n + (allowed.includes(weekday(iso)) ? 1 : 0), 0);
    }
    default:
      return null;
  }
}
