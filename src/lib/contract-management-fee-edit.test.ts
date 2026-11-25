import { describe, expect, it } from "vitest";
import { applyBillingAddOnRule } from "./contract-line-override";
import { hydrateFormulasWith } from "./contract-hydrate";
import { refreshBillingAddOns } from "./contract-billing-addons";
import { contractMonthlyBilling } from "./contract-rate-display";
import { computeBenefitAmount, type BenefitItem } from "@/routes/admin.contracts.client-contracts";

type FeeLine = Parameters<typeof applyBillingAddOnRule>[0] & {
  costComponentId: string;
  name: string;
};
const fee: FeeLine = {
  costComponentId: "fee-master",
  name: "Management Fee",
  calcType: "percentage" as const,
  percentage: 7,
  baseComponents: [{ label: "Total CTC", operator: "+" as const }],
  capAmount: null,
  amount: 1750,
  formulaMode: "advanced",
  formulaExpression: "total_ctc * 0.07",
};
const resource = {
  components: [{ name: "Basic", amount: 20000 }, { name: "DA", amount: 2000 }],
  benefits: [],
  employerContributions: [
    { name: "ER EPF", amount: 3000 },
    { name: "Reliever Charges", amount: 4000 },
    fee,
  ],
};

function savedResource(line: FeeLine) {
  return refreshBillingAddOns(JSON.parse(JSON.stringify({
    ...resource,
    employerContributions: [...resource.employerContributions.slice(0, 2), line],
  })) as typeof resource);
}

describe("Direct contract Management Fee editing", () => {
  it("saves an edited percentage and base without altering the master or other charges", () => {
    const edited = applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Gross"], cap: null });
    const saved = savedResource(edited);
    expect(saved.employerContributions[2]?.amount).toBe(2200);
    expect(contractMonthlyBilling(saved)).toBe(31200);
    expect(saved.employerContributions.slice(0, 2)).toEqual(resource.employerContributions.slice(0, 2));
    expect(fee.percentage).toBe(7);
    expect(fee.formulaExpression).toBe("total_ctc * 0.07");
  });

  it("keeps CTC and billing-rate bases distinct and excludes the fee from its own base", () => {
    const ctc = savedResource(applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Total CTC"], cap: null }));
    const billing = savedResource(applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Billing Rate"], cap: null }));
    expect(ctc.employerContributions[2]?.amount).toBe(2500);
    expect(billing.employerContributions[2]?.amount).toBe(2900);
    expect(refreshBillingAddOns(billing).employerContributions[2]?.amount).toBe(2900);
  });

  it("recalculates a custom fixed fee after changing it to a percentage", () => {
    const edited = applyBillingAddOnRule({ ...fee, costComponentId: "__custom_management_fee__", calcType: "fixed" as const, formulaMode: "", formulaExpression: "" }, {
      mode: "percentage", percentage: 10, bases: ["Basic", "DA"], cap: null,
    });
    expect(savedResource(edited).employerContributions[2]?.amount).toBe(2200);
  });

  it("preserves an explicitly edited fixed amount and formula", () => {
    const fixed = savedResource(applyBillingAddOnRule(fee, { mode: "fixed", amount: 1234.56 }));
    const formula = savedResource(applyBillingAddOnRule(fee, { mode: "formula", expression: "(total_ctc + reliever_charges) * 0.10" }));
    expect(fixed.employerContributions[2]?.amount).toBe(1234.56);
    expect(formula.employerContributions[2]?.amount).toBe(2900);
  });

  it("does not replace a saved contract percentage with a later shared master edit", () => {
    const edited = applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Gross"], cap: null });
    const saved = hydrateFormulasWith([{ ...resource, employerContributions: [edited] }], new Map([
      ["fee-master", { mode: "advanced", expr: "total_ctc * 0.50", version: 20 }],
    ]));
    expect(saved[0]?.employerContributions[0]?.formulaExpression).toBe(edited.formulaExpression);
    expect(saved[0]?.employerContributions[0]?.contractOverride).toBe(true);
    expect(savedResource(edited).employerContributions[2]?.amount).toBe(2200);
  });

  it("honours the chosen cap and existing round-off setting", () => {
    const capped = savedResource(applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Gross"], cap: 15000 }));
    const rounded = savedResource(applyBillingAddOnRule({ ...fee, roundOff: true }, { mode: "percentage", percentage: 7.333, bases: ["Gross"], cap: null }));
    expect(capped.employerContributions[2]?.amount).toBe(1500);
    expect(rounded.employerContributions[2]?.amount).toBe(1613);
  });

  it("shows the same reliever-based fee in the editor and the saved billing total", () => {
    const edited: BenefitItem = {
      ...applyBillingAddOnRule(fee, { mode: "percentage", percentage: 10, bases: ["Reliever Charges"], cap: null }),
      capFlatAmount: null,
      state: "N/A",
    };
    const wageComponents = resource.components.map((c) => ({ ...c, allowanceId: c.name }));
    const employerItems: BenefitItem[] = [
      { ...edited, name: "ER EPF", calcType: "fixed", formulaMode: null, formulaExpression: null, amount: 3000 },
      { ...edited, name: "Reliever Charges 16.67% of CTC", calcType: "fixed", formulaMode: null, formulaExpression: null, amount: 4000 },
    ];
    const editorAmount = computeBenefitAmount(edited, wageComponents, [], [], employerItems);
    const saved = refreshBillingAddOns({ components: wageComponents, employerContributions: [...employerItems, edited] });
    expect(editorAmount).toBe(400);
    expect(saved.employerContributions[2]?.amount).toBe(editorAmount);
  });
});