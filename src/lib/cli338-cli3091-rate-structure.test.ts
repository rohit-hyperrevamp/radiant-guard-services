import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { unknownFormulaVariables } from "./payroll-calc";

describe("CLI338 and CLI3091 supplied Security Guard rates", () => {
  const context = { basic: 10021, da: 3068, gross: 17970.90, hra: 654.45 };
  it.each([
    ["(basic + da) * 0.05", 654.45],
    ["(basic + da) * 0.04", 523.56],
    ["(basic + da) * 0.01", 130.89],
    ["(basic + da) * 0.0833", 1090.31],
    ["min(gross - hra, 15000) * 0.12", 1800],
    ["min(gross - hra, 15000) * 0.13", 1950],
  ])("keeps the sheet amount for %s", (expression, expected) => {
    expect(evaluateFormula({ mode: "advanced", expression }, context).amount).toBe(expected);
    expect(unknownFormulaVariables(expression, ["Basic", "DA", "HRA"])).toEqual([]);
  });
  it("calculates totals from the listed amounts without balancing charges", () => {
    const gross = 10021 + 3068 + 500 + 654.45 + 200 + 0 + 523.56 + 130.89 + 2873;
    expect(gross).toBeCloseTo(17970.90, 2);
    expect(gross - 1800 - 200 - 113.23).toBeCloseTo(15857.67, 2);
    const ctc = gross + 1950 + 491 + 12.50 + 1090.31 + 0;
    expect(ctc).toBeCloseTo(21514.71, 2);
    expect(ctc + 2191).toBeCloseTo(23705.71, 2);
  });
});