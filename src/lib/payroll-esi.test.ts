import { describe, expect, it } from "vitest";
import { applyEsiToWageComputation, computeWages } from "./payroll-calc";

// Astemo (CON14290)-style line: ESI = 0.75% × (Basic + DA + HRA), cap 21,000.
const resource = {
  designationId: "d",
  components: [
    { name: "Basic", amount: 12795.12 },
    { name: "DA", amount: 2511.08 },
    { name: "HRA 5% (Basic+DA)", amount: 765.31 },
  ],
  benefits: [],
  deductions: [
    {
      name: "EE ESI 0.75% (Basic+DA+HRA, cap 21000)",
      amount: 0,
      calcType: "percentage",
      percentage: 0.75,
      capAmount: 21000,
      formulaMode: "advanced",
      formulaExpression: "(basic + da + hra) * 0.0075",
      deductionCalcType: "earned_salary",
    },
    {
      name: "EE EPF 12% (Earned Gross - HRA, cap 15000)",
      amount: 0,
      calcType: "percentage",
      percentage: 12,
      formulaMode: "advanced",
      formulaExpression: "min(earned_gross - hra, 15000) * 0.12",
      deductionCalcType: "earned_salary",
    },
  ],
  employerContributions: [],
  payrollDayBase: { method: "fixed_days", fixedDays: 26 },
};

const run = (pDays: number, otDays: number) => {
  const totals = { candidateId: "x", pDays, otDays, phDays: 0, otherPaidDays: 0, totalPaidDays: pDays, absentDays: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = applyEsiToWageComputation(computeWages(totals as any, resource as any, 31, {} as any));
  const amt = (re: RegExp) => w.deductions.find((d) => re.test(d.name))?.amount;
  return { esi: amt(/esi/i), pf: amt(/epf/i), gross: w.earnedGross };
};

describe("ESI on Basic + DA + HRA", () => {
  it("is not zeroed when Extra Duty pushes earned gross above 21,000", () => {
    const r = run(26, 13.5);
    expect(r.gross).toBeGreaterThan(21000);
    expect(r.esi).toBe(120.54);
  });

  it("uses each component once (no doubling) for a 2-day guard", () => {
    const r = run(2, 0);
    expect(r.esi).toBe(9.27);
    expect(r.pf).toBe(141.29);
  });
});
