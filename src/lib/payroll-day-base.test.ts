import { describe, expect, it } from "vitest";
import { computeWages } from "./payroll-calc";

// Ventive (CON16020) Basic ₹13,266/month; 26 Aug – 25 Sep window = 31 days.
const basicFor = (payrollDayBase: unknown, pDays: number) => {
  const resource = {
    designationId: "d",
    components: [{ name: "Basic", amount: 13266 }],
    benefits: [],
    deductions: [],
    employerContributions: [],
    payrollDayBase,
  };
  const totals = { candidateId: "x", pDays, otDays: 0, phDays: 0, otherPaidDays: 0, totalPaidDays: pDays, absentDays: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = computeWages(totals as any, resource as any, 31, {} as any);
  return Math.round((w.earnedGross ?? 0) * 100) / 100;
};

describe("payroll day rule from the contract", () => {
  it("Days Minus Four divides a 31-day window by 27", () => {
    expect(basicFor({ method: "actual_minus_days", fixedDays: 4 }, 10)).toBe(4913.33);
  });

  it("Fixed 26 divides by 26", () => {
    expect(basicFor({ method: "fixed_days", fixedDays: 26 }, 10)).toBe(5102.31);
  });
});

describe("Days Minus Four full month", () => {
  it("27 present days in a 31-day window pay the full ₹13,266 Basic", () => {
    expect(basicFor({ method: "actual_minus_days", fixedDays: 4 }, 27)).toBe(13266);
  });
});
