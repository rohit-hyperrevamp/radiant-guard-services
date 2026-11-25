import { describe, expect, it } from "vitest";
import { isOptionalAllowanceVar, unknownFormulaVariables } from "./payroll-calc";

// CON16235 (IDE Technologies): roles without a Technical Allowance, reliever "Not applicable".
const comps = ["Basic", "DA", "HRA 5% (Basic+DA)", "WA", "Uniform Allowance", "Additional 4 Hours Allowance 50% (Basic+DA)"];

describe("saved formula variables (hotfix 25 Nov)", () => {
  it("does not treat billing add-on variables as unknown", () => {
    expect(unknownFormulaVariables("(total_ctc + reliever_charges) * 0.10", comps)).toEqual([]);
  });
  it("flags a missing optional allowance only as optional (counted as 0)", () => {
    const unknown = unknownFormulaVariables("min(gross - hra - technical_allowance, 15000) * 0.13", comps);
    expect(unknown).toEqual(["technical_allowance"]);
    expect(unknown.every(isOptionalAllowanceVar)).toBe(true);
  });
  it("still treats real typos as blocking", () => {
    const unknown = unknownFormulaVariables("basic + d_a", ["Basic", "DA"]);
    expect(unknown).toEqual(["d_a"]);
    expect(unknown.some((v) => !isOptionalAllowanceVar(v))).toBe(true);
  });
});
