import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { unknownFormulaVariables } from "./payroll-calc";

describe("CLI336 New Balance supplied rates", () => {
  const context = { basic: 10021, da: 3900, gross: 24368.48, hra: 696.05 };
  const amount = (expression: string) => evaluateFormula({ mode: "advanced", expression }, context).amount;
  it.each([
    ["(basic + da) * 0.5", 6960.5],
    ["(basic + da) * 0.05", 696.05],
    ["(basic + da) * 0.01", 139.21],
    ["round((basic + da) * 0.0833 * 100) / 100", 1159.62],
    ["min(gross - hra, 15000) * 0.12", 1800],
    ["min(gross - hra, 15000) * 0.13", 1950],
    ["(basic + da) * 0.0075", 104.41],
    ["(basic + da) * 0.0325", 452.43],
    ["(basic + da) * 0.0481", 669.6],
  ])("evaluates %s to the listed amount", (expression, expected) => {
    expect(amount(expression)).toBe(expected);
    expect(unknownFormulaVariables(expression, ["Basic", "DA", "HRA"])).toEqual([]);
  });
  it("keeps exact gross, net, CTC and billing without balancing charges", () => {
    const gross = 10021 + 3900 + 6960.5 + 696.05 * 3 + 139.21 + 100 + 1159.62;
    expect(gross).toBeCloseTo(24368.48, 2);
    expect(gross - 1800 - 104.41 - 200).toBeCloseTo(22264.07, 2);
    const ctc = gross + 1950 + 452.43 + 669.6 + 12.5;
    expect(ctc).toBeCloseTo(27453.01, 2);
    expect(ctc + 4575.5).toBeCloseTo(32028.51, 2);
    expect(ctc + 4575.5 + 3202.86).toBeCloseTo(35231.37, 2);
  });
});