import { describe, expect, it } from "vitest";
import { computeWages } from "./payroll-calc";

const totals = (pDays: number) => ({ pDays, otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0, tDays: pDays });
const sept = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, i + 1)));

describe("Pages Payroll contract rules", () => {
  it("'Actual days minus Sundays' counts the real Sundays (September 2026 = 26 days)", () => {
    const w = computeWages(totals(26) as never, {
      designationId: "d", components: [{ name: "Basic", amount: 13000 }], benefits: [], deductions: [], employerContributions: [],
      payrollDayBase: { method: "actual_minus_weekly_off", fixedDays: null, weeklyOffDay: 0 },
    } as never, 30, { periodDates: sept });
    expect(w.baseDays).toBe(26);
  });

  it("ESI is skipped when the chosen pay items on the contract rate exceed ₹21,000", () => {
    const esi = { name: "EE ESI 0.75%", amount: 0, calcType: "percentage", percentage: 0.75, capAmount: 21000, formulaMode: "advanced", formulaExpression: "(basic + da) * 0.0075", esiLimitOn: ["basic", "da", "hra"], esiLimitBasis: "payrate" };
    const w = computeWages(totals(26) as never, {
      designationId: "d", components: [{ name: "Basic", amount: 15000 }, { name: "DA", amount: 4000 }, { name: "HRA", amount: 2500 }], benefits: [], deductions: [esi], employerContributions: [],
      payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
    } as never, 30, {});
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(0);
  });

  it("ESI with round-up rounds to the next rupee (₹91.31 → ₹92)", () => {
    const esi = { name: "EE ESI 0.75%", amount: 0, calcType: "percentage", percentage: 0.75, capAmount: 21000, formulaMode: "advanced", formulaExpression: "basic * 0.0075", roundMode: "up" };
    const w = computeWages(totals(26) as never, {
      designationId: "d", components: [{ name: "Basic", amount: 12174.67 }], benefits: [], deductions: [esi], employerContributions: [],
      payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
    } as never, 30, {});
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(92);
  });

  it("an uncapped PF formula is not clipped to ₹1,800 (12% of ₹20,306 = ₹2,436.72)", () => {
    const pf = { name: "EE EPF 12% (Basic+DA)", amount: 0, calcType: "percentage", percentage: 12, capAmount: null, formulaMode: "advanced", formulaExpression: "(basic + da) * 0.12" };
    const w = computeWages(totals(26) as never, {
      designationId: "d", components: [{ name: "Basic", amount: 12844 }, { name: "DA", amount: 7462 }], benefits: [], deductions: [pf], employerContributions: [],
      payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
    } as never, 30, { epfCapEnabled: true });
    expect(w.deductions.find((d) => /epf/i.test(d.name))?.amount).toBe(2436.72);
  });
});
