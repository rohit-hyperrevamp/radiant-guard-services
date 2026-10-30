import { describe, expect, it } from "vitest";
import { invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";

describe("CLI2989 caretaker separate Extra Duty invoice", () => {
  const context = { unitCode: "CLI2989", designationName: "Care Taker", savedExtraDutyRate: 1121.79 };
  it("uses the saved contract ED rate, not the regular invoice rate", () => {
    expect(invoiceExtraDutyRate("site", [], context)).toBe(1121.79);
    const extra = splitInvoiceDuties({ billedDays: 1.5, otDays: 1.5, regularRate: 942.43, extraDutyRate: 1121.79 });
    expect(extra.regularQuantity).toBe(0);
    expect(extra.edQuantity).toBe(1.5);
    expect(extra.edAmount).toBe(1682.69);
  });
  it("does not apply caretaker pricing to another role or client", () => {
    expect(invoiceExtraDutyRate("site", [], { ...context, designationName: "Security Guard" })).toBeNull();
    expect(invoiceExtraDutyRate("site", [], { ...context, unitCode: "CLI2990" })).toBeNull();
  });
});