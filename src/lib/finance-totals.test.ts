import { describe, expect, it } from "vitest";
import { financeLossReason, financeProfit, financeRowIsCurrent, type SavedFinanceRow } from "./finance-totals";
import { checkedQueryData } from "./finance-source";

describe("authoritative finance totals", () => {
  it("keeps FPL management fee in profit without removing it from the employer display total", () => {
    expect(financeProfit({ invoice: 1623569.26, gross: 1219126, employer: 372768.62, managementFee: 98539.30 })).toBe(130213.94);
  });
  it("always deducts reliever charges as cost", () => {
    expect(financeProfit({ invoice: 25000, gross: 18000, employer: 4200, managementFee: 1500 })).toBe(4300);
  });
  it("does not manufacture profit when accurate costs exceed billing", () => {
    const values = { invoice: 10000, gross: 9500, employer: 2000, managementFee: 500 };
    expect(financeProfit(values)).toBe(-1000);
    expect(financeLossReason(values)).toBe("Earned wages plus employer costs, excluding management fee, exceed the invoice value");
  });
  it("never turns a failed finance source read into zero", () => {
    expect(() => checkedQueryData({ data: null, error: { message: "Source unavailable" } })).toThrow("Source unavailable");
  });
  it("rejects saved totals when any source changed after calculation", () => {
    const row = { generation: 5, calculated_generation: 4, calculation_version: 1, computed_at: "2026-11-24T00:00:00Z", totals: {} } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
    expect(financeRowIsCurrent({ ...row, calculated_generation: 5 })).toBe(true);
  });
  it("does not equate an incomplete saved result with an actual zero", () => {
    const row = { generation: 1, calculated_generation: 1, calculation_version: 1, computed_at: null, totals: null } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
  });
});