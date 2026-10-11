import { describe, expect, it } from "vitest";
import { applyPtToWageComputation } from "@/lib/payroll-calc";

const base = { earnedGross: 15000, deductions: [], totalDeductions: 0, netPay: 15000 } as never;

describe("PT follows the contract", () => {
  it("adds no PT when the contract has no PT line", () => {
    const w = applyPtToWageComputation(base, 200);
    expect(w.deductions).toHaveLength(0);
    expect(w.netPay).toBe(15000);
  });
  it("charges the slab PT when the contract has a PT line", () => {
    const w = applyPtToWageComputation(
      { ...(base as object), deductions: [{ name: "Professional Tax", amount: 0 }] } as never,
      200,
    );
    expect(w.deductions[0].amount).toBe(200);
    expect(w.netPay).toBe(14800);
  });
});
