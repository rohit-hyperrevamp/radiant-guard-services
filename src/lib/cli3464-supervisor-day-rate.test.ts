import { describe, expect, it } from "vitest";
import { refreshBillingAddOns } from "./contract-billing-addons";
import { contractMonthlyBilling } from "./contract-rate-display";

// CLI3464 Security Supervisor as saved after the 31 Oct 2026 correction.
// The invoice recalculates the reliever live (Total CTC includes the client
// billing adjustment); the saved lines must give the same monthly value.
const supervisor = {
  components: [
    { name: "Basic", amount: 16248 },
    { name: "HRA", amount: 6499.2 },
    { name: "Leave Pay", amount: 812.4 },
    { name: "Bonus", amount: 1353.46 },
    { name: "Supervisor Allowance", amount: 2000 },
  ],
  benefits: [],
  employerContributions: [
    { name: "ER EPF 13% (Basic+Supervisor Allowance, cap 25000)", amount: 2372.24 },
    { name: "ER LWF - AP", amount: 5.83 },
    { name: "Reliever Charges 1/6th (Total CTC)", amount: 4211.78, formulaMode: "advanced", formulaExpression: "total_ctc / 6" },
    { name: "Management Fee", amount: 991.35, calcType: "fixed" },
    { name: "Billing Rate Adjustment (as per client invoice MH-SEP26-27-2928)", amount: -4020.44 },
  ],
};

describe("CLI3464 Security Supervisor day rate", () => {
  it("contract page bills ₹30,473.82 a month, ₹1,172.07 a day on 26 days", () => {
    const monthly = contractMonthlyBilling(supervisor);
    expect(monthly).toBe(30473.82);
    expect(Math.round((monthly / 26) * 100) / 100).toBe(1172.07);
  });

  it("invoice recalculation gives the same monthly value as the contract", () => {
    expect(contractMonthlyBilling(refreshBillingAddOns(supervisor))).toBe(30473.82);
  });
});
