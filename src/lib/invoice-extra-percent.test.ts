import { describe, expect, it } from "vitest";
import { resolveExtraCharges, type InvoiceExtraCharge } from "@/components/InvoiceExtraCharges";

const base: InvoiceExtraCharge = {
  id: "1", unitId: "u", contractId: null, periodStart: null, periodEnd: null,
  description: "Service Charge", hsnSac: "", quantity: 0, rate: 0, perLabel: "%",
  enabled: true, sortOrder: 0, calcMode: "percent", percent: 7, baseOverride: null, amount: 0,
};

describe("percentage additional charges", () => {
  it("7% of the designation lines total before GST", () => {
    expect(resolveExtraCharges([base], 30000)[0].amount).toBe(2100);
  });
  it("uses a custom base when entered", () => {
    expect(resolveExtraCharges([{ ...base, baseOverride: 10000 }], 30000)[0].amount).toBe(700);
  });
  it("leaves qty × rate charges unchanged", () => {
    const c = { ...base, calcMode: "amount" as const, quantity: 2, rate: 500, amount: 1000 };
    expect(resolveExtraCharges([c], 30000)[0].amount).toBe(1000);
  });
});
