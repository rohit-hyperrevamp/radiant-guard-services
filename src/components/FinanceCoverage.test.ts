import { describe, expect, it } from "vitest";
import { unitProfit } from "@/components/FinanceCoverage";

describe("unitProfit", () => {
  it("uses actual employer cost only, with fee and reliever already inside invoice revenue", () => {
    const profit = unitProfit({ actual_invoice: 30000, actual_payroll: 18000, actual_employer_contribution: 1800, actual_management_fee: 1500 });
    expect(profit).toBe(10200);
  });
});
