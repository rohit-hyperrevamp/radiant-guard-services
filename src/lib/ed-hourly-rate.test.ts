import { describe, expect, it } from "vitest";
import { edPerDutyFromHourly } from "./payroll-calc";
import { hourlyEdBillingRate, invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";

describe("custom per-hour Extra Duty (Poonawalla Gujarat Security Guard)", () => {
  it("pays ₹134 per ED hour: one 8-hour ED duty = ₹1,072", () => {
    expect(edPerDutyFromHourly(134, 8)).toBe(1072);
  });

  it("bills ₹134 + ₹5 ESIC = ₹139 per ED hour", () => {
    expect(hourlyEdBillingRate({ rate: 134, esic: 5 })).toBe(139);
  });

  it("invoices 12 ED hours at ₹139 = ₹1,668", () => {
    const perDuty = invoiceExtraDutyRate("any-unit", [], { hourlyEd: { rate: 134, esic: 5, shiftHours: 8 } });
    expect(perDuty).toBe(1112);
    const split = splitInvoiceDuties({
      billedDays: 27.5, otDays: 1.5, regularRate: 900, extraDutyRate: perDuty!,
      shiftHours: 8, extraDutyHourly: true, exactExtraDutyRate: true,
    });
    expect(split.edRate).toBe(139);
    expect(split.edQuantity).toBe(12);
    expect(split.edAmount).toBe(1668);
  });
});

import { computeWages } from "./payroll-calc";
describe("payroll Extra Duty on custom per-hour rate", () => {
  it("1.5 ED days on an 8-hour shift at ₹134/hour pays ₹1,608", () => {
    const w = computeWages(
      { pDays: 26, otHours: 1.5, otDays: 1.5, phDays: 0, otherPaidDays: 0, tDays: 27.5 },
      {
        designationId: "g",
        components: [{ name: "Basic", amount: 15000, calcType: "fixed" }],
        benefits: [], deductions: [], employerContributions: [],
        otBasis: "hourly", otHourlyRate: 134, otHourlyEsic: 5, otShiftHours: 8,
        payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
      } as never,
      30,
    );
    const ed = w.components.find((c) => c.name === "Extra Duty");
    expect(ed?.amount).toBe(1608);
  });
});
