import { describe, it, expect } from "vitest";
import { computeWages } from "./payroll-calc";

const mk = (otBasis: string, otMultiplier = 2, otFormula?: string) => ({
  components: [
    { name: "Basic", amount: 13000, calcType: "fixed" },
    { name: "HRA", amount: 2600, calcType: "fixed", includeInOt: false },
  ],
  deductions: [], employerContributions: [], otBasis, otMultiplier, otFormula,
}) as never;

describe("Extra Duty basis", () => {
  it("full-month gross × 2: 15,600 / 26 × 2 = 1,200 per ED day", () => {
    const w = computeWages({ pDays: 26, otHours: 16, otDays: 2, phDays: 0, otherPaidDays: 0, tDays: 28 }, mk("gross"), 26);
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(2400);
  });
  it("earned gross × 2 at 13 present: 7,800 / 26 × 2 = 600 per ED day", () => {
    const w = computeWages({ pDays: 13, otHours: 8, otDays: 1, phDays: 0, otherPaidDays: 0, tDays: 14 }, mk("earned_gross"), 26);
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(600);
  });
  it("earned gross includes Paid Holiday: 13 P + 1 PH = 8,400 / 26 × 2 ≈ 646.15 per ED day", () => {
    const w = computeWages({ pDays: 13, otHours: 8, otDays: 1, phDays: 1, otherPaidDays: 0, tDays: 15 }, mk("earned_gross"), 26);
    // earned gross = 7,800 wages + 600 PH = 8,400; 8,400/26×2 = 646.1538… → 646.15
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(646.15);
  });
  it("custom formula basic / payroll_days * 2: 13,000 earned / 26 × 2 = 1,000 per ED day × 2 days", () => {
    const w = computeWages({ pDays: 26, otHours: 16, otDays: 2, phDays: 0, otherPaidDays: 0, tDays: 28 }, mk("formula", 1, "basic / payroll_days * 2"), 26);
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(2000);
  });
  it("custom formula earned_gross / payroll_days * 2 at 13 present = 600", () => {
    const w = computeWages({ pDays: 13, otHours: 8, otDays: 1, phDays: 0, otherPaidDays: 0, tDays: 14 }, mk("formula", 1, "earned_gross / payroll_days * 2"), 26);
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(600);
  });
});
