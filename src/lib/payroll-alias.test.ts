import { describe, expect, it } from "vitest";
import { computeWages } from "./payroll-calc";

describe("formula name matching", () => {
  it("'bonus' does not also pick up a separate 'Bonus (Addition)' line", () => {
    const esi = { name: "EE ESI 0.75%", amount: 0, calcType: "percentage", percentage: 0.75, capAmount: 21000, formulaMode: "advanced", formulaExpression: "(basic + bonus + bonus_addition) * 0.0075" };
    const w = computeWages({ pDays: 26, otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0, tDays: 26 } as never, {
      designationId: "d",
      components: [{ name: "Basic", amount: 10000 }, { name: "Bonus", amount: 1000 }, { name: "Bonus (Addition)", amount: 1000 }],
      benefits: [], deductions: [esi], employerContributions: [],
      payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
    } as never, 30, {});
    // (10000 + 1000 + 1000) × 0.75% = 90
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(90);
  });
});
