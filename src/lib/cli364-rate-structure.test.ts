import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { unknownFormulaVariables } from "./payroll-calc";

describe("CLI364 supplied Security Guard rates", () => {
  const context = { basic: 13266, da: 3614, gross: 23056, hra: 2532, washing_allowance: 1000, travelling_allowance: 1800 };
  it.each([
    ["(basic + da) * 0.15", 2532],
    ["(basic + da) * 0.01", 168.80],
    ["(basic + da) * 0.04", 675.20],
    ["min(gross - hra, 15000) * 0.12", 1800],
    ["min(gross - hra, 15000) * 0.13", 1950],
    ["(gross - washing_allowance - travelling_allowance) * 0.0075", 151.92],
    ["(gross - washing_allowance - travelling_allowance) * 0.0325", 658.32],
    ["(basic + da) * 0.03", 506.40],
    ["(basic + da) * 0.0833", 1406.10],
  ])("retains the supplied amount for %s", (expression, expected) => {
    expect(evaluateFormula({ mode: "advanced", expression }, context).amount).toBe(expected);
    expect(unknownFormulaVariables(expression, ["Basic", "DA", "HRA", "Washing Allowance", "Travelling Allowance"])).toEqual([]);
  });
  it("reconciles all totals without clothing being added to ESI", () => {
    const gross = 13266 + 3614 + 2532 + 168.80 + 675.20 + 0 + 1000 + 1800;
    expect(gross).toBe(23056);
    expect(gross - 1800 - 200 - 151.92).toBeCloseTo(20904.08, 2);
    const ctc = gross + 1950 + 658.32 + 506.40 + 1406.10 + 675.20 + 12.50;
    expect(ctc).toBeCloseTo(28264.52, 2);
    expect(ctc + 0 + 2372.70).toBeCloseTo(30637.22, 2);
  });
});