import { describe, expect, it } from "vitest";
import { computeWages } from "./payroll-calc";

const resource = (otEsi: unknown) => ({
  designationId: "d",
  components: [
    { name: "Basic", amount: 10000, includeInOt: true },
    { name: "DA", amount: 3000, includeInOt: true },
    { name: "HRA", amount: 2000, includeInOt: false },
  ],
  benefits: [], deductions: [], employerContributions: [],
  otBasis: "components", otMultiplier: 2, otEsi,
  payrollDayBase: { method: "fixed_days", fixedDays: 26 },
});
const totals = { candidateId: "x", pDays: 26, otDays: 4, phDays: 0, otherPaidDays: 0, tDays: 26, absentDays: 0 };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (otEsi: unknown) => computeWages(totals as any, resource(otEsi) as any, 30, {} as any);

describe("ESI on Extra Duty", () => {
  it("charges ESI on ED Basic+DA when switched on (ED 4 days = ₹4,000)", () => {
    const w = run({ enabled: true, eeFormula: "(basic + da) * 0.0075", erFormula: "(basic + da) * 0.0325" });
    expect(w.totalOtAmount).toBe(4000);
    expect(w.deductions.find((d) => d.name === "EE ESI on Extra Duty")?.amount).toBe(30);
    expect(w.employerContributions.find((d) => d.name === "ER ESI on Extra Duty")?.amount).toBe(130);
  });
  it("charges nothing on ED when switched off", () => {
    const w = run(null);
    expect(w.deductions.some((d) => /extra duty/i.test(d.name))).toBe(false);
    expect(w.employerContributions.some((d) => /extra duty/i.test(d.name))).toBe(false);
  });
});
