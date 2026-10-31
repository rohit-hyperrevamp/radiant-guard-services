import { roundDutyDays } from "./duty-days";
/** Explicit site-only invoice exception; payroll and attendance rules are separate. */
export const CLI4096_UNIT_ID = "41887f48-31ea-48ef-9005-24c81a21fc93";
const r2 = (value: number) => Math.round(value * 100) / 100;
export const isCli2989Caretaker = (unitCode?: string | null, designationName?: string | null) =>
  unitCode?.trim().toUpperCase() === "CLI2989" && /care\s*takers?/i.test(designationName ?? "");

export function invoiceExtraDutyRate(
  unitId: string,
  components: { name?: unknown; amount?: unknown }[],
  contract?: { unitCode?: string | null; designationName?: string | null; monthlyBilling?: number; billingDays?: number; savedExtraDutyRate?: number },
): number | null {
  if (isCli2989Caretaker(contract?.unitCode, contract?.designationName)) {
    const monthly = contract?.monthlyBilling;
    const days = contract?.billingDays;
    return typeof monthly === "number" && Number.isFinite(monthly) && monthly >= 0 && typeof days === "number" && days > 0
      ? monthly / days * 2 : null;
  }
  if (contract?.unitCode?.trim().toUpperCase() === "CLI290" && /\bsupervisor\b/i.test(contract.designationName ?? "")) {
    const monthly = contract.monthlyBilling;
    return typeof monthly === "number" && Number.isFinite(monthly) && monthly > 0
      ? r2(monthly / 26 * 2)
      : null;
  }
  if (unitId !== CLI4096_UNIT_ID) return null;
  const base = components.reduce((sum, component) => {
    const name = String(component.name ?? "").toLowerCase().replace(/[^a-z]/g, "");
    return /^(basic|basicsalary|basicpay|da|vda|dearnessallowance)$/.test(name)
      ? sum + (Number(component.amount) || 0)
      : sum;
  }, 0);
  return r2(base / 26 * 2);
}

export function splitInvoiceDuties(args: {
  billedDays: number;
  otDays: number;
  regularRate: number;
  extraDutyRate: number;
  shiftHours?: number;
  hourly?: boolean;
  extraDutyHourly?: boolean;
  exactExtraDutyRate?: boolean;
}) {
  // Day quantities keep 4 decimals (57.5 h ÷ 8 = 7.1875 days, never 7.19).
  const edDays = Math.min(Math.max(0, roundDutyDays(args.otDays)), Math.max(0, roundDutyDays(args.billedDays)));
  const regularDays = Math.max(0, roundDutyDays(args.billedDays - edDays));
  const factor = args.hourly ? Math.max(1, args.shiftHours ?? 8) : 1;
  const edFactor = args.extraDutyHourly ? Math.max(1, args.shiftHours ?? 8) : factor;
  const exactEdRate = args.extraDutyRate / edFactor;
  const edRate = r2(exactEdRate);
  const regularQuantity = roundDutyDays(regularDays * factor);
  const edQuantity = roundDutyDays(edDays * edFactor);
  const regularAmount = r2(args.regularRate * regularQuantity);
  const edAmount = r2((args.exactExtraDutyRate ? exactEdRate : edRate) * edQuantity);
  return {
    regularDays, edDays, regularQuantity, edQuantity,
    regularRate: args.regularRate, edRate, regularAmount, edAmount,
    actual: r2(regularAmount + edAmount),
  };
}