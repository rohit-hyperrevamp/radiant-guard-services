import { describe, expect, it } from "vitest";
import { roundFinalGross, type WageComputation } from "./payroll-calc";

const w = (earnedGross: number, totalDeductions: number) =>
  ({ earnedGross, totalDeductions, netPay: earnedGross - totalDeductions, employerCost: earnedGross } as unknown as WageComputation);

describe("final gross rounds to whole rupees", () => {
  it("30013.26 becomes 30013 and net follows", () => {
    const r = roundFinalGross(w(30013.26, 2212));
    expect(r.earnedGross).toBe(30013);
    expect(r.netPay).toBe(27801);
  });
  it("2613.69 rounds up to 2614", () => {
    expect(roundFinalGross(w(2613.69, 0)).earnedGross).toBe(2614);
  });
  it("exactly 50 paise rounds up", () => {
    expect(roundFinalGross(w(100.5, 0)).earnedGross).toBe(101);
  });
});
