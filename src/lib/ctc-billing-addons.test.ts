import { describe, expect, it } from "vitest";
import { refreshBillingAddOns } from "./contract-billing-addons";

const resource = {
  components: [{ name: "Basic", amount: 20000 }],
  benefits: [{ name: "Allowance", amount: 2000 }],
  employerContributions: [
    { name: "ER EPF", amount: 3000 },
    { name: "Reliever Charges 16.67% (Total CTC)", amount: 0, formulaMode: "advanced", formulaExpression: "total_ctc * 0.1667" },
    { name: "Management Fee 7% (Total CTC)", amount: 0, formulaMode: "advanced", formulaExpression: "total_ctc * 0.07" },
  ],
};

describe("Selectable CTC billing add-ons", () => {
  it("calculates the management fee as 7% of CTC, excluding reliever charges", () => {
    const result = refreshBillingAddOns(resource);
    expect(result.employerContributions.find((line) => line.name.startsWith("Management Fee"))?.amount).toBe(1750);
  });
  it("calculates reliever charges as 16.67% of CTC, not exact one-sixth", () => {
    const result = refreshBillingAddOns(resource);
    expect(result.employerContributions.find((line) => line.name.startsWith("Reliever Charges"))?.amount).toBe(4167.5);
  });
});