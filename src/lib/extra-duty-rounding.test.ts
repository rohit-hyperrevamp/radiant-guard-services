import { describe, it, expect } from "vitest";
import { computeWages } from "./payroll-calc";

// ITC MTC Mumbai (CLI2) Security Supervisor, Pages register: Bonus excluded from ED,
// rounded lines count at whole rupees, day rate rounded to paise → 1,016.08 × 4.
const resource = {
  components: [
    { name: "Basic", amount: 14432, calcType: "fixed" },
    { name: "DA", amount: 3614, calcType: "fixed" },
    { name: "HRA", amount: 3609.2, calcType: "fixed" },
    { name: "CCA", amount: 2200, calcType: "fixed" },
    { name: "Washing Allowance", amount: 1200, calcType: "fixed" },
    { name: "Others", amount: 100, calcType: "fixed" },
    { name: "Leave Pay", amount: 1082.76, calcType: "fixed", roundOff: true },
    { name: "Paid Holiday", amount: 180.46, calcType: "fixed", roundOff: true },
    { name: "Bonus", amount: 1804.6, calcType: "fixed", roundOff: true, includeInOt: false },
  ],
  deductions: [],
  employerContributions: [],
} as never;

describe("Extra Duty day rate", () => {
  it("pays 4 ED days as ₹4,064.32", () => {
    const w = computeWages({ pDays: 25, otHours: 32, otDays: 4, phDays: 0, otherPaidDays: 0, tDays: 29 }, resource, 30);
    expect(w.components.find((c) => c.name === "Extra Duty")?.amount).toBe(4064.32);
  });
});
