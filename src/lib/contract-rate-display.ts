import { billingRatePerDay, resolveBillingDivisor } from "./mis-billing";
import type { PayrollDayBaseLike } from "./payroll-days";
import { isBillingAddOn, isRelieverLine, isMgmtFeeLine } from "./contract-billing-addons";

type AmountLine = { name?: unknown; amount?: unknown };

/** Use all saved invoice wage and employer lines, never employee deductions. */
export function contractMonthlyBilling(resource: {
  components: AmountLine[];
  benefits?: AmountLine[];
  employerContributions?: AmountLine[];
  roundOffFinal?: boolean;
  roundOffTotals?: Record<string, boolean>;
}): number {
  const sum = (lines: AmountLine[] = []) => lines.reduce((total, line) => total + (Number(line.amount) || 0), 0);
  // Rounded intermediate totals feed later totals, exactly as in the editor.
  // Keep saved line/formula amounts untouched; rounding is a total-level choice.
  const rt = (key: string, value: number) => resource.roundOffTotals?.[key] ? Math.round(value) : value;
  const benefits = resource.benefits ?? [];
  const employer = resource.employerContributions ?? [];
  const addOns = [...benefits, ...employer];
  const gross = rt("gross", sum(resource.components) + sum(benefits.filter((line) => !isBillingAddOn(line))));
  const employerTotal = rt("employer", sum(employer.filter((line) => !isBillingAddOn(line))));
  const ctc = rt("ctc", gross + employerTotal);
  const billing = rt("billing", ctc + sum(addOns.filter(isRelieverLine)));
  const monthly = billing + sum(addOns.filter(isMgmtFeeLine));
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
/** Monthly rate printed in an invoice line ("@ Rs 30930.90/-"): exact contract value, paise kept unless whole. */
export function invoiceMonthlyRateLabel(monthly: number): string {
  const value = Math.round((Number(monthly) || 0) * 100) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
