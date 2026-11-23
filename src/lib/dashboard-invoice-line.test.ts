import { describe, expect, it } from "vitest";
import { invoiceLineAmount } from "./dashboard-invoice-line";
import type { ContractResourceLike } from "./payroll-calc";

const resource = (extra: Partial<ContractResourceLike> = {}): ContractResourceLike => ({
  designationId: "guard",
  components: [{ name: "Basic", amount: 20656.03 }],
  benefits: [],
  deductions: [],
  employerContributions: [{ name: "ER PF", amount: 8324.47 }],
  ...extra,
});
const base = { mode: "man_days" as const, billingDays: 30, shiftHours: 8, invoicePresentCap: false, unitId: "u", unitCode: "CLI3246" };

describe("dashboard invoice line matches invoice detail pricing", () => {
  it("bills hourly Extra Duty at the contract ED rate even without a Present cap", () => {
    const amount = invoiceLineAmount({ ...base, resource: resource({ otBasis: "hourly", otHourlyRate: 154.166 }), tDays: 155, otDays: 12 });
    // 143 regular duties × ₹966.02 + 96 ED hours × ₹154.17
    expect(amount).toBe(152941.18);
  });
  it("bills plain duties at the monthly billing ÷ billing days rate", () => {
    expect(invoiceLineAmount({ ...base, resource: resource(), tDays: 30, otDays: 0 })).toBe(28980.6);
  });
  it("honours the contract's round-off-final setting", () => {
    const r = resource({ components: [{ name: "Basic", amount: 17903 }], employerContributions: [{ name: "ER", amount: 7606.19 }], roundOffFinal: true });
    expect(invoiceLineAmount({ ...base, mode: "man_months", resource: r, tDays: 26, otDays: 0 })).toBe(25509);
  });
  it("keeps four-decimal Extra Duty quantities", () => {
    const r = resource({ otBasis: "hourly", otHourlyRate: 161, otHourlyEsic: 6 });
    // 1.375 ED days = 11 hours × ₹167 = ₹1,837 (not 1.38 days)
    const amount = invoiceLineAmount({ ...base, resource: r, tDays: 1.375, otDays: 1.375 });
    expect(amount).toBe(1837);
  });
});
