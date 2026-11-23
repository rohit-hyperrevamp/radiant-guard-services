import { describe, expect, it } from "vitest";
import { unitProfit } from "@/components/FinanceCoverage";

describe("unitProfit", () => {
  it("keeps the management fee as profit but deducts reliever charges", () => {
    // Employer contribution 4,200 = ER EPF 1,800 + Management Fee 1,500 + Reliever 900.
    const profit = unitProfit({ actual_invoice: 30000, actual_payroll: 18000, actual_employer_contribution: 4200, actual_management_fee: 1500 });
    expect(profit).toBe(30000 - 18000 - (4200 - 1500));
  });
});
