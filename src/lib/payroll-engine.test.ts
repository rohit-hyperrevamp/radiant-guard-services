import { describe, expect, it } from "vitest";
import { payrollUnitTotals, type PayrollUnitRow } from "@/lib/payroll-engine";

const row = (id: string, gross: number, deductions: number, employer: { name: string; amount: number }[]) =>
  ({ id, wages: { earnedGross: gross, totalDeductions: deductions, netPay: gross - deductions, employerContributions: employer } }) as unknown as PayrollUnitRow;

describe("payrollUnitTotals", () => {
  it("adds every line of a person and the site, as the payroll page totals them", () => {
    const t = payrollUnitTotals([
      row("a", 18000, 2160, [{ name: "ER EPF", amount: 1800 }]),
      row("a", 2400, 0, []),
      row("b", 15000, 1800, [{ name: "ER ESIC", amount: 487.5 }]),
    ]);
    expect(t.gross).toBe(35400);
    expect(t.deductions).toBe(3960);
    expect(t.net).toBe(31440);
    expect(t.byPerson.get("a")).toEqual({ gross: 20400, deductions: 2160 });
  });

  it("leaves billed margin out of employer cost", () => {
    const t = payrollUnitTotals([row("a", 18000, 0, [{ name: "ER EPF", amount: 1800 }, { name: "Management Fee", amount: 1500 }])]);
    expect(t.employer).toBe(1800);
  });
});
