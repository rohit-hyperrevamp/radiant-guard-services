/**
 * MIS billing values — taken straight from the invoice.
 *
 * The MIS sheet must never invent its own rate. The invoice bills a duty at
 *   per-duty rate = monthly contract value ÷ the contract's billing-days rule
 * (e.g. ₹28,026.11 ÷ 27 = ₹1,038.00) and charges every billed duty at that
 * rate. Extra Duty (OT) is a duty like any other, so it bills at the very same
 * per-duty rate — there is no separate OT formula.
 *
 * Both MIS exports (per-invoice and the combined charter export) build their
 * numbers here so the sheet always reconciles with the invoice.
 */

import { taxSplit } from "@/lib/gst-billing";
import { resolvePayrollDayCount, type PayrollDayBaseLike } from "@/lib/payroll-days";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Inclusive list of ISO dates in a payroll period. */
export function periodDateList(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if (!sy || !ey) return out;
  const cursor = new Date(sy, (sm ?? 1) - 1, sd ?? 1);
  const end = new Date(ey, (em ?? 1) - 1, ed ?? 1);
  while (cursor <= end && out.length < 400) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Number of days the monthly contract value is divided by to reach the per-duty
 * billing rate — exactly the rule the invoice uses: the resource's billing-days
 * basis when configured, otherwise its payroll-days basis, otherwise the days in
 * the cycle. A billing divisor is a contractual constant, so it is never clamped
 * down to the length of the period.
 */
export function resolveBillingDivisor(
  bases: { billingDayBase?: PayrollDayBaseLike | null; payrollDayBase?: PayrollDayBaseLike | null },
  periodDates: string[],
): number {
  const billing = resolvePayrollDayCount(bases.billingDayBase ?? null, periodDates, { clampToPeriod: false });
  if (billing && billing > 0) return billing;
  const payroll = resolvePayrollDayCount(bases.payrollDayBase ?? null, periodDates);
  if (payroll && payroll > 0) return payroll;
  return periodDates.length || 30;
}

/** Per-duty billing rate for a monthly contract value in this period. */
export function billingRatePerDay(
  monthlyBillable: number,
  bases: { billingDayBase?: PayrollDayBaseLike | null; payrollDayBase?: PayrollDayBaseLike | null },
  periodDates: string[],
): number {
  const divisor = resolveBillingDivisor(bases, periodDates);
  return divisor > 0 ? r2(monthlyBillable / divisor) : 0;
}

export type MisBillingLine = {
  perDay: number;
  /** Regular duties billed = all billed duties minus Extra Duty. */
  workingDays: number;
  otDays: number;
  /** Extra Duty bills at the duty rate — same rate, no separate formula. */
  otRate: number;
  otAmount: number;
  regularBilling: number;
  otBilling: number;
  totalBilling: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstTotal: number;
  grandTotal: number;
};

/**
 * Split one employee's invoice amount into the MIS columns.
 *
 * `total` is the amount the invoice actually bills for this line; the regular
 * portion is whatever remains after the Extra Duty duties, so the sheet's
 * Total Billing always equals the invoice to the rupee.
 */
export function misBillingLine({
  perDay,
  billedDays,
  otDays,
  total,
  intraState,
}: {
  perDay: number;
  billedDays: number;
  otDays: number;
  total: number;
  intraState: boolean;
}): MisBillingLine {
  const ot = Math.max(0, r2(otDays));
  const workingDays = Math.max(0, r2(billedDays - ot));
  const otBilling = r2(perDay * ot);
  const totalBilling = r2(total);
  const regularBilling = r2(totalBilling - otBilling);
  const tax = taxSplit(totalBilling, intraState);
  return {
    perDay: r2(perDay),
    workingDays,
    otDays: ot,
    otRate: r2(perDay),
    otAmount: otBilling,
    regularBilling,
    otBilling,
    totalBilling,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    gstTotal: tax.total,
    grandTotal: r2(totalBilling + tax.total),
  };
}
