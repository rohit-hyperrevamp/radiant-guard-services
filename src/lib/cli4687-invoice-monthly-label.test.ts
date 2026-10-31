import { describe, expect, it } from "vitest";
import { contractMonthlyBilling, invoiceMonthlyRateLabel } from "./contract-rate-display";

describe("CLI4687 Armed Guard invoice line rate", () => {
  const armedGuard = {
    components: [{ amount: 26208 }],
    employerContributions: [{ amount: 3000 }, { amount: 125 }, { amount: 125 }, { amount: 1472.9 }],
    roundOffFinal: false,
  };

  it("prints the contract's ₹30,930.90, not a rounded ₹30,931", () => {
    expect(invoiceMonthlyRateLabel(contractMonthlyBilling(armedGuard))).toBe("30930.90");
  });

  it("keeps whole-rupee contracts whole when the contract rounds off", () => {
    expect(invoiceMonthlyRateLabel(contractMonthlyBilling({ ...armedGuard, roundOffFinal: true }))).toBe("30931");
  });
});
