import { describe, expect, it } from "vitest";
import { invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";
import { computeWages } from "./payroll-calc";

describe("CLI2989 caretaker separate Extra Duty invoice", () => {
  const context = { unitCode: "CLI2989", designationName: "Care Taker", monthlyBilling: 25445.63, billingDays: 27 };
  it("derives September ED from the saved Basic and DA selection and days-minus-four rule", () => {
    const wages = computeWages(
      { pDays: 27, phDays: 0, otDays: 1.5, otHours: 1.5, otherPaidDays: 0, tDays: 28.5 },
      {
        components: [
          { name: "Basic", amount: 12294.10, includeInOt: true },
          { name: "DA", amount: 2850.12, includeInOt: true },
          { name: "HRA", amount: 1514.42, includeInOt: false },
        ],
        designationId: "caretaker", benefits: [], deductions: [], employerContributions: [], otBasis: "components", otMultiplier: 2,
        payrollDayBase: { method: "actual_minus_days", fixedDays: 4, weeklyOffDay: null },
      },
      31,
    );
    expect(wages.perDutyOtAmount).toBe(1121.79);
    expect(wages.totalOtAmount).toBe(1682.69);
  });
  it("bills image-108's twelve ED hours at displayed 235.61 for 2827.29", () => {
    const rate = invoiceExtraDutyRate("site", [], context);
    expect(rate).toBeCloseTo(25445.63 / 27 * 2, 8);
    const extra = splitInvoiceDuties({ billedDays: 1.5, otDays: 1.5, regularRate: 942.43, extraDutyRate: rate ?? 0, shiftHours: 8, extraDutyHourly: true, exactExtraDutyRate: true });
    expect(extra.regularQuantity).toBe(0);
    expect(extra.edQuantity).toBe(12);
    expect(extra.edRate).toBe(235.61);
    expect(extra.edAmount).toBe(2827.29);
  });
  it("keeps 27 P Days separate from the twelve ED hours", () => {
    const extra = splitInvoiceDuties({ billedDays: 28.5, otDays: 1.5, regularRate: 942.43, extraDutyRate: 25445.63 / 27 * 2, shiftHours: 8, extraDutyHourly: true, exactExtraDutyRate: true });
    expect(extra.regularQuantity).toBe(27);
    expect(extra.edQuantity).toBe(12);
  });
  it("does not apply caretaker pricing to another role or client", () => {
    expect(invoiceExtraDutyRate("site", [], { ...context, designationName: "Security Guard" })).toBeNull();
    expect(invoiceExtraDutyRate("site", [], { ...context, unitCode: "CLI2990" })).toBeNull();
  });
});