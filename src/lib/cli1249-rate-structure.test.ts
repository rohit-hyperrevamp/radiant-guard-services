import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { unknownFormulaVariables } from "./payroll-calc";
import { contractDailyBilling, contractMonthlyBilling } from "./contract-rate-display";
import { periodDateList } from "./mis-billing";

describe("CLI1249 confirmed listed Guard rates", () => {
  it("includes allowances in the monthly billing total of 24896.42", () => {
    expect(contractMonthlyBilling({
      components: [{ amount: 10021 }, { amount: 3614 }],
      benefits: [681.75, 136.35, 409.05, 583.10, 818.10, 100].map((amount) => ({ amount })),
      employerContributions: [1950, 528.56, 545.40, 12.50, 3233.30, 2263.31].map((amount) => ({ amount })),
    })).toBe(24896.42);
  });
  it("shows 829.88 per day for monthly billing 24896.42 over 30 days", () => {
    expect(contractDailyBilling(24896.42, { billingDayBase: { method: "actual_days" } }, periodDateList("2026-09-01", "2026-09-30")))
      .toEqual({ billingDays: 30, perDay: 829.88 });
  });
  const context = { basic: 10021, da: 3614, gross: 16363.35, hra: 681.75, washing_allowance: 100, total_ctc: 19399.81, reliever_charges: 3233.30 };
  it.each([
    ["(basic + da) * 0.05", 681.75],
    ["(basic + da) * 0.01", 136.35],
    ["(basic + da) * 0.03", 409.05],
    ["7000 * 0.0833", 583.10],
    ["(basic + da) * 0.06", 818.10],
    ["min(gross - hra, 15000) * 0.12", 1800],
    ["min(gross - hra, 15000) * 0.13", 1950],
    ["(gross - washing_allowance) * 0.0325", 528.56],
    ["(basic + da) * 0.04", 545.40],
    ["total_ctc / 6", 3233.30],
    ["(total_ctc + reliever_charges) * 0.10", 2263.31],
  ])("calculates %s to the listed amount", (expression, expected) => {
    expect(evaluateFormula({ mode: "advanced", expression }, context).amount).toBe(expected);
    expect(unknownFormulaVariables(expression, ["Basic", "DA", "HRA", "Washing Allowance", "Reliever Charges"])).toEqual([]);
  });
  it("uses listed deductions and costs without balancing or rounding totals", () => {
    const gross = 10021 + 3614 + 681.75 + 136.35 + 409.05 + 583.10 + 818.10 + 100;
    expect(gross).toBeCloseTo(16363.35, 2);
    expect(gross - 1800 - 200 - 122).toBeCloseTo(14241.35, 2);
    const ctc = gross + 1950 + 528.56 + 545.40 + 12.50;
    expect(ctc).toBeCloseTo(19399.81, 2);
    expect(ctc + 3233.30).toBeCloseTo(22633.11, 2);
    expect(ctc + 3233.30 + 2263.31).toBeCloseTo(24896.42, 2);
  });
});
import { refreshBillingAddOns } from "./contract-billing-addons";

describe("CLI1249 management fee includes reliever charges", () => {
  it("refreshes management fee to 2263.31 and billing to 24896.42", () => {
    const line = (name: string, amount: number, formulaExpression: string | null = null) =>
      ({ name, amount, formulaMode: formulaExpression ? "advanced" : null, formulaExpression });
    const refreshed = refreshBillingAddOns({
      components: [line("Basic", 10021), line("DA", 3614), line("HRA 5% (Basic+DA)", 681.75), line("Paid Holiday", 136.35),
        line("Uniform", 409.05), line("Bonus", 583.10), line("Leave with Wages", 818.10), line("Washing Allowance", 100)],
      benefits: [],
      employerContributions: [line("ER EPF", 1950), line("ER ESI", 528.56), line("Gratuity", 545.40), line("ER LWF - MH", 12.50),
        line("Reliever Charges", 3233.30, "total_ctc / 6"),
        line("Management Fee", 1939.98, "(total_ctc + reliever_charges) * 0.10")],
    });
    const fee = refreshed.employerContributions!.find((l) => l.name === "Management Fee")!;
    expect(fee.amount).toBe(2263.31);
    const total = [...refreshed.components!, ...refreshed.employerContributions!].reduce((s, l) => s + Number(l.amount), 0);
    expect(Math.round(total * 100) / 100).toBe(24896.42);
  });
});
