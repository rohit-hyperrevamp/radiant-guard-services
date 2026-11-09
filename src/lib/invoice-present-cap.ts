import { roundDutyDays } from "./duty-days";
import { resolveBillingDivisor } from "./mis-billing";
import type { PayrollDayBaseLike } from "./payroll-days";

export type InvoiceCapRule = {
  invoicePresentCap?: boolean;
  /** Total saved contract strength in this role/duty-length pool. */
  invoiceCapQuantity?: number;
  quantity?: number;
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

/** Billing divisor × contracted strength, never the number of attending employees. */
export function invoicePresentLimit(rule: InvoiceCapRule | null | undefined, dates: string[]): number | null {
  return rule?.invoicePresentCap === true && rule.billingDayBase
    ? roundDutyDays(resolveBillingDivisor(rule, dates) * invoiceStrength(rule.invoiceCapQuantity ?? rule.quantity ?? 1))
    : null;
}

function invoiceStrength(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Invalid contracted invoice strength");
  return quantity;
}

/** Sum resource lines once, not once per employee, entry or rate segment. */
export function invoicePoolStrength(rules: readonly InvoiceCapRule[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const rule of rules) {
    const key = invoiceCapPool("", rule);
    totals.set(key, (totals.get(key) ?? 0) + invoiceStrength(rule.quantity ?? 0));
  }
  return totals;
}

export function invoiceCapPool(unitId: string, rule: InvoiceCapRule): string {
  return `${unitId}|${rule.designationId ?? ""}|${rule.shiftHours ?? 8}`;
}

/** Pure invoice allocation. Original attendance and payroll totals are never mutated.
 * Stable employee identity then date/window order makes paging and invoice tabs irrelevant.
 * Fill the allowance from Present first, then existing ED (including relievers).
 * Holidays do not consume the allowance; moved is signed (P to ED is positive).
 */
export function allocateInvoicePresent(inputs: readonly InvoiceCapInput[]) {
  const remaining = new Map<string, number>();
  for (const input of inputs) {
    if (input.cap == null) continue;
    if (!Number.isFinite(input.cap) || input.cap < 0) throw new Error("Invalid invoice Present limit");
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
  // Invoice duty classification is independent of payroll: replacement guards
  // and payroll cap ED can complete the unit's regular billing allowance.
  for (const { input, index } of ordered) {
    if (input.cap == null) continue;
    const left = remaining.get(input.pool) ?? 0;
    const promoted = Math.min(Math.max(0, output[index].extraDuty), left);
    if (promoted <= 0) continue;
    remaining.set(input.pool, roundDutyDays(left - promoted));
    output[index] = {
      present: roundDutyDays(output[index].present + promoted),
      extraDuty: roundDutyDays(output[index].extraDuty - promoted),
      moved: roundDutyDays(output[index].moved - promoted),
    };
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