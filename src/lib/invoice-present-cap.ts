import { roundDutyDays } from "./duty-days";
import { resolveBillingDivisor } from "./mis-billing";
import type { PayrollDayBaseLike } from "./payroll-days";

export type InvoiceCapRule = {
  invoicePresentCap?: boolean;
  designationId?: string | null;
  shiftHours?: number;
  billingDayBase?: PayrollDayBaseLike | null;
  payrollDayBase?: PayrollDayBaseLike | null;
};

export type InvoiceCapInput = {
  pool: string;
  order: string;
  present: number;
  extraDuty: number;
  cap: number | null;
};

/** One divisor per role/duty-length pool, not per employee or staffing quantity. */
export function invoicePresentLimit(rule: InvoiceCapRule | null | undefined, dates: string[]): number | null {
  return rule?.invoicePresentCap === true && rule.billingDayBase
    ? resolveBillingDivisor(rule, dates)
    : null;
}

export function invoiceCapPool(unitId: string, rule: InvoiceCapRule): string {
  return `${unitId}|${rule.designationId ?? ""}|${rule.shiftHours ?? 8}`;
}

/** Pure invoice allocation. Original attendance and payroll totals are never mutated.
 * Stable employee identity then date/window order makes paging and invoice tabs irrelevant.
 * Holidays and existing ED do not consume the Present allowance.
 */
export function allocateInvoicePresent(inputs: readonly InvoiceCapInput[]) {
  const remaining = new Map<string, number>();
  for (const input of inputs) {
    if (input.cap == null) continue;
    if (!Number.isFinite(input.cap) || input.cap <= 0) throw new Error("Invalid invoice Present limit");
    const previous = remaining.get(input.pool);
    if (previous != null && previous !== roundDutyDays(input.cap)) {
      throw new Error("Conflicting Billing Days in the same invoice role");
    }
    remaining.set(input.pool, roundDutyDays(input.cap));
  }
  const output = inputs.map((input) => ({ present: input.present, extraDuty: input.extraDuty, moved: 0 }));
  const ordered = inputs.map((input, index) => ({ input, index }))
    .sort((a, b) => a.input.order.localeCompare(b.input.order) || a.index - b.index);
  for (const { input, index } of ordered) {
    if (input.cap == null) continue;
    const left = remaining.get(input.pool) ?? 0;
    const present = Math.max(0, roundDutyDays(input.present));
    const retained = Math.min(present, left);
    const moved = roundDutyDays(present - retained);
    remaining.set(input.pool, roundDutyDays(left - retained));
    output[index] = { present: retained, extraDuty: roundDutyDays(input.extraDuty + moved), moved };
  }
  return output;
}

/** Shared adapter for raw attendance and charter aggregate rows. */
export function allocateInvoiceEntries<T extends { unit_id?: string; candidate_id: string; entry_date: string; code: string; ot_hours: number | string | null; days?: number }>(
  entries: readonly T[],
  ruleFor: (entry: T) => InvoiceCapRule | null | undefined,
  datesFor: (entry: T) => string[],
  presentFor: (entry: T) => number,
) {
  return allocateInvoicePresent(entries.map(entry => {
    const rule = ruleFor(entry);
    return {
      pool: invoiceCapPool(entry.unit_id ?? "", rule ?? {}),
      order: `${entry.candidate_id}|${entry.entry_date}|${entry.code}`,
      present: presentFor(entry), extraDuty: Number(entry.ot_hours) || 0,
      cap: invoicePresentLimit(rule, datesFor(entry)),
    };
  }));
}