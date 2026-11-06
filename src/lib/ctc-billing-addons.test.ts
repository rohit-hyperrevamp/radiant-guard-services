import { describe, expect, it } from "vitest";
import { refreshBillingAddOns, formulaReferencesBillingBase } from "./contract-billing-addons";
import { contractMonthlyBilling } from "./contract-rate-display";

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
  const cli3082 = {
    components: [{ name: "Gross", amount: 21479.69 }],
    benefits: [],
    employerContributions: [
      { name: "Employer costs", amount: 2414.93 },
      { name: "Reliever Charges", amount: 3983.23 },
      { name: "Management Fee", amount: 1964.47 },
    ],
    roundOffTotals: { ctc: true },
    roundOffFinal: true,
  };

  it("keeps CLI3082 at the editor's 29843 after rounded CTC flows into billing", () => {
    expect(contractMonthlyBilling(cli3082)).toBe(29843);
    expect(contractMonthlyBilling({ ...cli3082, roundOffFinal: false })).toBe(29842.70);
    const normalized = refreshBillingAddOns(cli3082);
    expect(normalized.employerContributions[1]?.amount).toBe(3983.23);
    expect(normalized.employerContributions[2]?.amount).toBe(1964.47);
    expect(contractMonthlyBilling(normalized)).toBe(29843);
  });

  it("does not apply intermediate rounding when disabled", () => {
    expect(contractMonthlyBilling({ ...cli3082, roundOffTotals: {} })).toBe(29842);
    expect(contractMonthlyBilling({ ...cli3082, roundOffTotals: {}, roundOffFinal: false })).toBe(29842.32);
  });

  it("carries gross, employer and billing rounding forward without rounding fees", () => {
    expect(contractMonthlyBilling({
      components: [{ name: "Basic", amount: 100.6 }],
      benefits: [{ name: "Allowance", amount: 0.1 }, { name: "Reliever Charges", amount: 3.6 }],
      employerContributions: [{ name: "ER EPF", amount: 10.6 }, { name: "Management Fee", amount: 2.25 }],
      roundOffTotals: { gross: true, employer: true, billing: true },
    })).toBe(118.25);
  });

  it("evaluates billing-rate management fees after employer costs and relievers", () => {
    expect(formulaReferencesBillingBase("billing_rate * 0.07")).toBe(true);
    expect(formulaReferencesBillingBase("billingrate * 0.07")).toBe(true);
    expect(formulaReferencesBillingBase("gross * 0.07")).toBe(false);
  });

  it("keeps CLI325 at 30018 when moving from editor to staged and saved amounts", () => {
    const staged = refreshBillingAddOns({
      components: [{ name: "Gross", amount: 21320.18 }],
      employerContributions: [
        { name: "Employer costs", amount: 2993.55 },
        { name: "Reliever Charges", amount: 0, formulaMode: "advanced", formulaExpression: "round(ctc) / 26 * 4" },
        { name: "Management Fee 7% (Billing Rate)", amount: 1492.41, formulaMode: "advanced", formulaExpression: "billing_rate * 0.07" },
      ],
      roundOffFinal: true,
    });
    expect(staged.employerContributions[1]?.amount).toBe(3740.62);
    expect(staged.employerContributions[2]?.amount).toBe(1963.8);
    expect(contractMonthlyBilling(staged)).toBe(30018);
    expect(contractMonthlyBilling(refreshBillingAddOns(staged))).toBe(30018);
  });
  it("calculates the management fee as 7% of CTC, excluding reliever charges", () => {
    const result = refreshBillingAddOns(resource);
    expect(result.employerContributions.find((line) => line.name.startsWith("Management Fee"))?.amount).toBe(1750);
  });
  it("calculates reliever charges as 16.67% of CTC, not exact one-sixth", () => {
    const result = refreshBillingAddOns(resource);
    expect(result.employerContributions.find((line) => line.name.startsWith("Reliever Charges"))?.amount).toBe(4167.5);
  });
});