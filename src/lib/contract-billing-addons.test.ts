import { describe, expect, it } from "vitest";
import { refreshBillingAddOns } from "./contract-billing-addons";

describe("billing add-ons use the invoice period (review I9)", () => {
  const resource = {
    components: [{ name: "Basic", amount: 26000 }],
    employerContributions: [
      { name: "Reliever Charges", amount: 0, formulaMode: "advanced", formulaExpression: "total_ctc / days_in_month * 4" },
    ],
  };
  it("evaluates days_in_month from the period length passed by the invoice, not today", () => {
    expect(refreshBillingAddOns(resource, { daysInMonth: 26 }).employerContributions[0]?.amount).toBe(4000);
    expect(refreshBillingAddOns(resource, { daysInMonth: 31 }).employerContributions[0]?.amount).toBe(3354.84);
  });
});
