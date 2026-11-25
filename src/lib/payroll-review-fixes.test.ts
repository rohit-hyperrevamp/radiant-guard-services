import { describe, expect, it } from "vitest";
import { lwfPeriodMonth, ptGrossForLine } from "./payroll-engine";
import { applyPtToWageComputation, roundFinalGross, wageShortfall, type WageComputation } from "./payroll-calc";

describe("LWF uses the period end month (P7)", () => {
  it("26 May – 25 Jun is June", () => {
    expect(lwfPeriodMonth("2026-06-25")).toBe(6);
  });
  it("calendar December is December", () => {
    expect(lwfPeriodMonth("2026-12-31")).toBe(12);
  });
});

describe("PT gross per line follows final gross rounding (P6)", () => {
  it("rounds like roundFinalGross when the line's gross is rounded", () => {
    expect(ptGrossForLine(5000.4, true)).toBe(5000);
    expect(ptGrossForLine(5000.5, true)).toBe(5001);
    expect(ptGrossForLine(5000.4, false)).toBe(5000.4);
    const w = { earnedGross: 5000.5, totalDeductions: 0, netPay: 5000.5, employerCost: 5000.5 } as unknown as WageComputation;
    expect(roundFinalGross(w).earnedGross).toBe(ptGrossForLine(5000.5, true));
  });
});

describe("negative net exposes a shortfall (P13)", () => {
  it("net stays ₹0 but the shortfall is reported", () => {
    const w = { earnedGross: 1000, totalDeductions: 0, netPay: 1000, deductions: [{ name: "Salary advance", amount: 1500 }] } as unknown as WageComputation;
    const after = applyPtToWageComputation(w, 0);
    expect(after.netPay).toBe(0);
    expect(wageShortfall(after)).toBe(500);
  });
  it("no shortfall when gross covers deductions", () => {
    expect(wageShortfall({ earnedGross: 1000, totalDeductions: 999.99 })).toBe(0);
    expect(wageShortfall(null)).toBe(0);
  });
});
