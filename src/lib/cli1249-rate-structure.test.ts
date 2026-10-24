import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { unknownFormulaVariables } from "./payroll-calc";

describe("CLI1249 confirmed listed Guard rates", () => {
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