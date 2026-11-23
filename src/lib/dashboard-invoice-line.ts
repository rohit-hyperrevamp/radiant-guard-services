import { contractMonthlyBilling } from "./contract-rate-display";
import { roundDutyDays } from "./duty-days";
import {
  exactDayRateFor,
  invoiceExtraDutyRate,
  isCli2989Caretaker,
  showsHourlyEdAsDays,
  splitInvoiceDuties,
} from "./invoice-duty-rates";
import type { ContractResourceLike } from "./payroll-calc";

export type BillingMode = "man_days" | "man_hours" | "man_months" | "lumpsum";
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One employee line of an invoice, priced exactly as the invoice detail page
 * (invoiceMathFor): saved monthly billing with its rounding flags, regular and
 * Extra Duty priced separately whenever an ED rate exists, 4-dp duty quantities.
 */
export function invoiceLineAmount(args: {
  resource: ContractResourceLike;
  mode: BillingMode;
  billingDays: number;
  shiftHours: number;
  tDays: number;
  /** ED days after any Present cap allocation. */
  otDays: number;
  invoicePresentCap: boolean;
  unitId: string;
  unitCode?: string | null;
  customerName?: string | null;
  designationName?: string | null;
  savedExtraDutyRate?: number;
  exactDayRate?: boolean;
}): number {
  const { resource, mode, billingDays, shiftHours } = args;
  const contracted = contractMonthlyBilling(resource);
  if (mode === "lumpsum" || mode === "man_months") return contracted;
  const billedDays = roundDutyDays(args.tDays);
  const hourly = mode === "man_hours";
  const perHour = billingDays > 0 && shiftHours > 0 ? r2(contracted / billingDays / shiftHours) : 0;
  const perDay = billingDays > 0 ? r2(contracted / billingDays) : 0;
  const unitRate = hourly ? perHour : perDay;
  const extraDutyRate = invoiceExtraDutyRate(args.unitId, resource.components, {
    unitCode: args.unitCode,
    designationName: args.designationName,
    monthlyBilling: contracted,
    billingDays,
    savedExtraDutyRate: args.savedExtraDutyRate,
    hourlyEd:
      resource.otBasis === "hourly"
        ? { rate: resource.otHourlyRate, esic: resource.otHourlyEsic, shiftHours }
        : null,
  });
  const contractEdLines = args.invoicePresentCap && extraDutyRate == null && args.otDays > 0;
  const edRate = extraDutyRate ?? (contractEdLines ? exactDayRateFor(contracted, billingDays) : null);
  if (edRate != null) {
    const caretaker =
      isCli2989Caretaker(args.unitCode, args.designationName) ||
      (resource.otBasis === "hourly" && extraDutyRate != null && !showsHourlyEdAsDays(args.customerName));
    return splitInvoiceDuties({
      billedDays,
      otDays: args.otDays,
      regularRate: unitRate,
      extraDutyRate: edRate,
      shiftHours,
      hourly,
      extraDutyHourly: caretaker,
      exactExtraDutyRate: caretaker,
    }).actual;
  }
  if (args.exactDayRate) {
    const exact = hourly
      ? billingDays > 0 && shiftHours > 0 ? contracted / billingDays / shiftHours : 0
      : billingDays > 0 ? contracted / billingDays : 0;
    return r2(exact * (hourly ? args.tDays * shiftHours : args.tDays));
  }
  const quantity = hourly ? r2(billedDays * shiftHours) : billedDays;
  return r2(unitRate * quantity);
}
