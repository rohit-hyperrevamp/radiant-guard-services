import { billingRatePerDay, resolveBillingDivisor } from "./mis-billing";
import type { PayrollDayBaseLike } from "./payroll-days";

type AmountLine = { amount?: unknown };

/** Use all saved invoice wage and employer lines, never employee deductions. */
export function contractMonthlyBilling(resource: {
  components: AmountLine[];
  benefits?: AmountLine[];
  employerContributions?: AmountLine[];
  roundOffFinal?: boolean;
}): number {
  const sum = (lines: AmountLine[] = []) => lines.reduce((total, line) => total + (Number(line.amount) || 0), 0);
  const monthly = sum(resource.components) + sum(resource.benefits) + sum(resource.employerContributions);
  return resource.roundOffFinal ? Math.round(monthly) : Math.round(monthly * 100) / 100;
}

export function contractDailyBilling(
  monthly: number,
  bases: { billingDayBase?: PayrollDayBaseLike | null; payrollDayBase?: PayrollDayBaseLike | null },
  periodDates: string[],
) {
  return {
    billingDays: resolveBillingDivisor(bases, periodDates),
    perDay: billingRatePerDay(monthly, bases, periodDates),
  };
}