import { describe, expect, it } from "vitest";
import { unknownFormulaVariables, computeWages } from "./payroll-calc";
import { evaluateExpression } from "./formula-engine";

describe("formula variables payroll can't resolve", () => {
  const comps = ["Basic", "DA", "Leave Pay", "Bonus", "Bonus (Addition)", "4Hrs Duty", "Washing Allowance"];
  it("flags names that are not on the role", () => {
    expect(unknownFormulaVariables("(basic + d_a + leave_with_wages) * 0.0075", comps)).toEqual(["d_a", "leave_with_wages"]);
  });
  it("accepts real pay items, aliases and built-ins", () => {
    expect(unknownFormulaVariables("min(basic + da + leave_pay + bonus_addition + 4hrs_duty + wa + ed_amount + earned_gross, 15000) * 0.12", comps)).toEqual([]);
  });
  it("ignores preset (JSON) formulas", () => {
    expect(unknownFormulaVariables('{"base":{"kind":"basic"}}', comps)).toEqual([]);
  });
  it("reads a pay item whose name starts with a number", () => {
    expect(evaluateExpression("min(100 + 4hrs_duty, 15000) * 0.5", { "4hrs_duty": 50 })).toBe(75);
    expect(evaluateExpression("2.5 * 4", {})).toBe(10);
  });
});

describe("CLI1493 ESI includes Bonus (Addition) like Pages", () => {
  it("full month ESI = 0.75% of gross − WA = ₹152", () => {
    const resource = {
      designationId: "d",
      components: [["Basic", 11563], ["DA", 3540], ["Washing Allowance", 115], ["Paid Holiday", 151], ["Leave Pay", 604], ["Bonus", 2864], ["U/A", 231], ["Bonus (Addition)", 1258]].map(([name, amount]) => ({ name, amount })),
      benefits: [],
      deductions: [{ name: "EE ESI 0.75%", amount: 0, calcType: "percentage", percentage: 0.75, capAmount: 21000, roundMode: "up", formulaMode: "advanced", deductionCalcType: "earned_salary",
        formulaExpression: "(basic + bonus + da + ed_amount + leave_pay + paid_holiday + u_a + bonus_addition) * 0.0075" }],
      employerContributions: [],
      payrollDayBase: { method: "actual_days" },
    };
    const totals = { candidateId: "x", pDays: 31, otDays: 0, phDays: 0, otherPaidDays: 0, tDays: 31, absentDays: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = computeWages(totals as any, resource as any, 31, {} as any);
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(152);
  });
});
