import { describe, expect, it } from "vitest";
import { billingMarkupOf, employerCostOnly, isBillingMarkupLine } from "./contract-billing-addons";

describe("P&L employer cost", () => {
  it("treats management fee, reliever and service charges as revenue", () => {
    for (const n of ["Management Fee", "Reliever Charges 16.67%", "PFL Service Charge", "Admin Charges (Fixed)"])
      expect(isBillingMarkupLine({ name: n })).toBe(true);
  });
  it("keeps statutory costs", () => {
    for (const n of ["ER EPF 13% (cap 15000)", "ER ESI 3.25% (Basic+DA)", "PF Admin Charges 0.5% (cap 25000)", "EDLI 0.5%", "Gratuity 4.81%"])
      expect(isBillingMarkupLine({ name: n })).toBe(false);
  });
  it("sums only real employer cost", () => {
    expect(employerCostOnly([{ name: "ER EPF", amount: 1657 }, { name: "Management Fee", amount: 6938.45 }])).toBe(1657);
  });
  for (const name of ['Admin Fee', 'Administrative Fee', 'Administration Charges', 'Service Fee', 'Service Charges', 'Management Fee', 'Reliever Charges']) {
    it(`excludes ${name} from employer contribution`, () => {
      expect(employerCostOnly([{name:'ER EPF',amount:1800},{name,amount:900}])).toBe(1800);
      expect(billingMarkupOf([{name:'ER EPF',amount:1800},{name,amount:900}])).toBe(900);
    });
  }
  it('keeps statutory EPF Admin Fee as employer cost, despite the word fee', () => {
    expect(employerCostOnly([{name:'EPF Admin Fee 1%',amount:250}])).toBe(250);
  });
  it('keeps statutory contributions even when their formula base mentions reliever charges', () => {
    expect(employerCostOnly([{name:'ER ESI 3.25% (Basic+DA+Reliever Charges)',amount:670},{name:'ER EPF 13% (Basic+DA+Reliever, cap 15000)',amount:1950},{name:'ADM Charges 0.5% (Basic + DA, cap ₹25,000)',amount:125},{name:'Admin Charges 0.5%',amount:75}])).toBe(2820);
  });
});
