import { describe, expect, it } from "vitest";
import { invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";
import { computeWages } from "./payroll-calc";

describe("CLI2989 caretaker separate Extra Duty invoice", () => {
  const context = { unitCode: "CLI2989", designationName: "Care Taker", savedExtraDutyRate: 1121.79 };
  it("derives September ED from the saved Basic and DA selection and days-minus-four rule", () => {
    const wages = computeWages(
      { pDays: 27, phDays: 0, otDays: 1.5, otHours: 1.5, otherPaidDays: 0, tDays: 28.5 },
      {
        components: [
          { name: "Basic", amount: 12294.10, includeInOt: true },
          { name: "DA", amount: 2850.12, includeInOt: true },
          { name: "HRA", amount: 1514.42, includeInOt: false },
        ],
        deductions: [], employerContributions: [], otBasis: "components", otMultiplier: 2,
        payrollDayBase: { method: "actual_minus_days", fixedDays: 4, weeklyOffDay: null },
      },
      31,
    );
    expect(wages.perDutyOtAmount).toBe(1121.79);
    expect(wages.totalOtAmount).toBe(1682.69);
  });
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