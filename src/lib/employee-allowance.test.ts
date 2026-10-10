import { describe, it, expect } from "vitest";
import { allowancePayable, applyAllowancePf, type WageComputation } from "./payroll-calc";

const base = (pfAmount: number, cap: number | null): WageComputation => ({
  contractGross: 20000, perDayRate: 0, baseDays: 26, earnedGross: 20000, ratio: 1, components: [], benefits: [],
  deductions: [{ name: "EPF Employee", amount: pfAmount, percentage: 12, capAmount: cap }],
  employerContributions: [{ name: "EPF Employer", amount: pfAmount * 13 / 12, percentage: 13, capAmount: cap }],
  totalDeductions: pfAmount, totalEmployerContributions: 0, netPay: 0, employerCost: 0,
  otBaseAmount: 0, perDutyOtAmount: 0, otDuties: 0, totalOtAmount: 0,
});

describe("per-guard allowance", () => {
  it("fixed ₹2,000 is paid in full regardless of days", () => {
    expect(allowancePayable({ name: "CCTV", amount: 2000 }, 13, 26)).toBe(2000);
  });
  it("pay-by-days ₹2,000 for 13 of 26 days is ₹1,000", () => {
    expect(allowancePayable({ name: "CCTV", amount: 2000, prorate: true }, 13, 26)).toBe(1000);
  });
  it("PF adds 12% of ₹2,000 when uncapped", () => {
    expect(applyAllowancePf(base(1200, null), 2000).deductions[0].amount).toBe(1440);
  });
  it("PF stays at ₹1,800 when already at the ₹15,000 ceiling", () => {
    expect(applyAllowancePf(base(1800, 15000), 2000).deductions[0].amount).toBe(1800);
  });
});
