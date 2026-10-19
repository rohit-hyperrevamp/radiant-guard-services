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

const ed = (components: object[]) =>
  computeWages({ pDays: 26, otHours: 16, otDays: 2, phDays: 0, otherPaidDays: 0, tDays: 28 },
    { components, deductions: [], employerContributions: [], otBasis: "components", otMultiplier: 1 } as never, 26)
    .components.find((c) => c.name === "Extra Duty")?.amount ?? 0;

describe("Extra Duty on selected components", () => {
  it("Basic 10,000 + DA 3,000 ticked, HRA unticked: 13,000 / 26 × 2 days = 1,000", () => {
    expect(ed([
      { name: "Basic", amount: 10000, calcType: "fixed", includeInOt: true },
      { name: "DA", amount: 3000, calcType: "fixed", includeInOt: true },
      { name: "HRA", amount: 2600, calcType: "fixed", includeInOt: false },
    ])).toBe(1000);
  });
  it("every component unticked gives no Extra Duty pay, never full gross", () => {
    expect(ed([{ name: "Basic", amount: 26000, calcType: "fixed", includeInOt: false }])).toBe(0);
  });
});
