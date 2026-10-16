import { describe, expect, it } from "vitest";
import { employerCostOnly, isBillingMarkupLine } from "./contract-billing-addons";

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
});
