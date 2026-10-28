import { describe, expect, it } from "vitest";
import { invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";

describe("CLI290 Supervisor Extra Duty invoice", () => {
  const context = { unitCode: "CLI290", designationName: "Security Supervisor", monthlyBilling: 26000 };
  it("uses monthly contract billing divided by 26 times two, not salary", () => {
    expect(invoiceExtraDutyRate("site", [{ name: "Basic", amount: 13000 }], context)).toBe(2000);
    expect(invoiceExtraDutyRate("site", [], { ...context, monthlyBilling: 29025.46 })).toBe(2232.73);
  });
  it("keeps regular quantities and Extra Duty quantities separate without double billing", () => {
    const rate = invoiceExtraDutyRate("site", [], context);
    expect(rate).toBe(2000);
    const line = splitInvoiceDuties({ billedDays: 28, otDays: 2, regularRate: 1000, extraDutyRate: rate ?? 0 });
    expect(line.regularQuantity).toBe(26);
    expect(line.edQuantity).toBe(2);
    expect(line.regularAmount).toBe(26000);
    expect(line.edAmount).toBe(4000);
    expect(line.actual).toBe(30000);
  });
  it("preserves other clients and non-Supervisor roles", () => {
    expect(invoiceExtraDutyRate("site", [], { ...context, unitCode: "CLI291" })).toBeNull();
    expect(invoiceExtraDutyRate("site", [], { ...context, designationName: "Security Guard" })).toBeNull();
    expect(invoiceExtraDutyRate("site", [], { ...context, monthlyBilling: undefined })).toBeNull();
  });
});