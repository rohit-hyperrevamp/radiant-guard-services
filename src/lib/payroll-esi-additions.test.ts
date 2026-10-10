import { describe, expect, it } from "vitest";
import { applyEmployeeAdditions, computeWages } from "./payroll-calc";

// CLI2285 / CON13044 Security Guard: ESI formula on contract items, rounded up.
const esi = (pct: number) => ({
  name: `EE ESI ${pct}%`, amount: 0, calcType: "percentage", percentage: pct, capAmount: 21200, roundMode: "up",
  formulaMode: "advanced", deductionCalcType: "earned_salary",
  formulaExpression: `(basic + hra + bonus + leave_pay + transportation_allowance + hardship_allowance + other_allowance) * ${pct / 100}`,
});
const resource = {
  designationId: "d",
  components: [
    ["Basic", 7722], ["HRA", 3089], ["Washing Allowance", 1250], ["Leave Pay", 386],
    ["Transportation Allowance", 750], ["Hardship Allowance", 500], ["Other Allowance", 4000], ["Bonus", 643],
  ].map(([name, amount]) => ({ name, amount })),
  benefits: [],
  deductions: [esi(0.75)],
  employerContributions: [{ ...esi(3.25), name: "ER ESI 3.25%" }],
  payrollDayBase: { method: "fixed_days", fixedDays: 26 },
};
const run = (adds: { name: string; amount: number; countsForEsi?: boolean }[]) => {
  const totals = { candidateId: "x", pDays: 20, otDays: 0, phDays: 0, otherPaidDays: 0, tDays: 20, absentDays: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = computeWages(totals as any, resource as any, 31, {} as any);
  const r = applyEmployeeAdditions(w, adds, 20).wages;
  return {
    gross: r.earnedGross,
    ee: r.deductions.find((d) => /esi/i.test(d.name))?.amount,
    er: r.employerContributions.find((d) => /esi/i.test(d.name))?.amount,
  };
};

describe("ESI includes ESI-eligible additions", () => {
  it("Mahendra Kumar Meena: 20 days + ₹500 allowance → ESI ₹103", () => {
    const r = run([{ name: "Additional Allowance", amount: 500, countsForEsi: true }]);
    expect(r.gross).toBe(14607.69);
    expect(r.ee).toBe(103);
    expect(r.er).toBe(444);
  });
  it("without the allowance ESI stays ₹99", () => {
    expect(run([]).ee).toBe(99);
  });
  it("an addition not counted for ESI leaves ESI at ₹99", () => {
    expect(run([{ name: "Reimbursement", amount: 500, countsForEsi: false }]).ee).toBe(99);
  });
});
