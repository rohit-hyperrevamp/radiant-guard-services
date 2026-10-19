import { describe, expect, it } from "vitest";
import { withContractEdRule } from "./ed-rule";
import { computeWages } from "./payroll-calc";

describe("Extra Duty uses only the contract's selected components", () => {
  const contract = {
    components: [
      { name: "Basic", allowanceId: "b", includeInOt: true },
      { name: "DA", allowanceId: "d", includeInOt: true },
      { name: "HRA", allowanceId: "h", includeInOt: false },
    ],
    otBasis: "components",
    otMultiplier: 1,
  };
  it("employee salary setup inherits the contract's Basic + DA selection", () => {
    const emp = { components: [
      { name: "Basic", allowanceId: "b", amount: 10000, includeInOt: true },
      { name: "DA", allowanceId: "d", amount: 3000, includeInOt: true },
      { name: "HRA", allowanceId: "h", amount: 2000, includeInOt: true },
    ] };
    const r = withContractEdRule(emp, contract)!;
    expect(r.components.map((c) => c.includeInOt)).toEqual([true, true, false]);
  });
});

describe("explicitly unticking every component", () => {
  it("gives zero Extra Duty pay instead of falling back to full gross", () => {
    const resource = {
      designationId: "x",
      components: [{ name: "Basic", amount: 26000, calcType: "fixed", includeInOt: false }],
      benefits: [], deductions: [], employerContributions: [],
      otBasis: "components" as const, otMultiplier: 1,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = computeWages({ presentDays: 26, otDays: 2 } as any, resource as any, 30) as any;
    expect(Number(w.otAmount ?? w.ot ?? 0)).toBe(0);
  });
});
