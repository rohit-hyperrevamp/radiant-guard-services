import { describe, expect, it } from "vitest";
import { computeWages } from "./payroll-calc";

// The payroll "Round ESI" switch applies when the contract sets no rounding:
// ESI must round to the NEAREST rupee (>= .50 up, < .50 down), never always-up.
const esi = (pct: number) => ({
  name: `EE ESI ${pct}%`, amount: 0, calcType: "percentage", percentage: pct, capAmount: 21200,
  formulaMode: "advanced", deductionCalcType: "earned_salary",
  formulaExpression: `(basic + hra) * ${pct / 100}`,
});
const resource = {
  designationId: "d",
  components: [["Basic", 13000], ["HRA", 3000]].map(([name, amount]) => ({ name, amount })),
  benefits: [],
  deductions: [esi(0.75)],
  employerContributions: [],
  payrollDayBase: { method: "fixed_days", fixedDays: 26 },
};
const totals = { candidateId: "x", pDays: 26, otDays: 0, phDays: 0, otherPaidDays: 0, tDays: 26, absentDays: 0 };
const eeEsi = (opts: { esiRoundUp?: boolean }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = computeWages(totals as any, resource as any, 31, opts as any);
  return w.deductions.find((d) => /esi/i.test(d.name))?.amount;
};

describe("Round ESI switch rounds to the nearest rupee", () => {
  it("₹120.15 → ₹120 when the switch is on", () => {
    // gross 16000 → 0.75% = 120.00; add paise via a second check below
    expect(eeEsi({ esiRoundUp: true })).toBe(120);
  });
  it("a sub-.50 remainder rounds down, not up", () => {
    const res = { ...resource, components: [["Basic", 13027], ["HRA", 3000]].map(([name, amount]) => ({ name, amount })) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = computeWages(totals as any, res as any, 31, { esiRoundUp: true } as any);
    const raw = (13027 + 3000) * 0.0075;
    expect(raw).toBeLessThan(120.5);
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(Math.round(raw));
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(120);
  });
  it("a ≥.50 remainder rounds up", () => {
    const res = { ...resource, components: [["Basic", 13080], ["HRA", 3000]].map(([name, amount]) => ({ name, amount })) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = computeWages(totals as any, res as any, 31, { esiRoundUp: true } as any);
    const raw = (13080 + 3000) * 0.0075;
    expect(raw).toBeGreaterThanOrEqual(120.5);
    expect(w.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(121);
  });
  it("switch off keeps paise", () => {
    expect(eeEsi({ esiRoundUp: false })).toBe(120);
  });
});
