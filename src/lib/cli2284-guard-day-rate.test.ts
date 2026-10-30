import { describe, expect, it } from "vitest";
import { periodDateList } from "./mis-billing";
import { contractDailyBilling, contractMonthlyBilling } from "./contract-rate-display";

// CLI2284 Security Guard: saved lines total ₹25,470.79, "round off final
// billing rate" is on, billing divisor is a fixed 30.40 days.
const guard = {
  components: [7722, 3089, 1250, 4000, 386, 750, 500, 643].map((amount) => ({ amount })),
  benefits: [],
  employerContributions: [1686.36, 555.43, 400, 3498, 991].map((amount) => ({ amount })),
  roundOffFinal: true,
};
const october = periodDateList("2026-09-21", "2026-10-20");
const bases = { billingDayBase: { method: "fixed_days" as const, fixedDays: 30.4 } };

describe("CLI2284 Security Guard day rate", () => {
  it("bills the rounded final monthly rate ₹25,471", () => {
    expect(contractMonthlyBilling(guard)).toBe(25471);
  });

  it("gives ₹837.86 per day on both contract and invoice", () => {
    expect(contractDailyBilling(contractMonthlyBilling(guard), bases, october).perDay).toBe(837.86);
  });

  it("without final round-off the rate would be ₹837.85", () => {
    expect(contractDailyBilling(contractMonthlyBilling({ ...guard, roundOffFinal: false }), bases, october).perDay).toBe(837.85);
  });
});
