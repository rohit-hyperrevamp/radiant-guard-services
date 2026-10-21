import { describe, expect, it } from "vitest";
import { billingRatePerDay, misBillingLine, periodDateList } from "./mis-billing";
import { CLI4096_UNIT_ID, invoiceExtraDutyRate, splitInvoiceDuties } from "./invoice-duty-rates";

const bases = {
  billingDayBase: { method: "fixed_days" as const, fixedDays: 27 },
  payrollDayBase: { method: "actual_minus_days" as const, fixedDays: 4 },
};
const monthly = 21753.58;

describe("CLI4096 fixed 27-day billing divisor", () => {
  it("keeps the same daily rate when the payroll period allows 26 or 27 days", () => {
    const september = periodDateList("2026-09-01", "2026-09-30");
    const october = periodDateList("2026-10-01", "2026-10-31");
    expect(billingRatePerDay(monthly, bases, september)).toBe(805.69);
    expect(billingRatePerDay(monthly, bases, october)).toBe(805.69);
  });

  it.each([{ duties: 26, amount: 20947.94 }, { duties: 27, amount: 21753.63 }])(
    "bills $duties duties at the fixed daily rate",
    ({ duties, amount }) => {
      const perDay = billingRatePerDay(monthly, bases, periodDateList("2026-09-01", "2026-09-30"));
      const line = misBillingLine({ perDay, billedDays: duties, otDays: 0, total: perDay * duties, intraState: true });
      expect(line.totalBilling).toBe(amount);
    },
  );
});

describe("CLI4096 separate Extra Duty invoice billing", () => {
  const components = [{ name: "Basic", amount: 12324 }, { name: "DA", amount: 1573 }, { name: "HRA", amount: 695 }];
  it("bills Extra Duty at Basic plus DA divided by 26 times two, excluding HRA", () => {
    expect(invoiceExtraDutyRate(CLI4096_UNIT_ID, components)).toBe(1069);
    expect(invoiceExtraDutyRate(CLI4096_UNIT_ID, [...components, { name: "HRA", amount: 9000 }])).toBe(1069);
  });
  it("leaves every other site's invoice billing unchanged", () => {
    expect(invoiceExtraDutyRate("another-site", components)).toBeNull();
    expect(misBillingLine({ perDay: 805.69, billedDays: 28, otDays: 2, total: 22559.32, intraState: true }).otRate).toBe(805.69);
  });
  it("bills 26 regular duties plus two Extra Duties without charging ED twice", () => {
    const split = splitInvoiceDuties({ billedDays: 28, otDays: 2, regularRate: 805.69, extraDutyRate: 1069 });
    expect(split.regularQuantity).toBe(26);
    expect(split.edQuantity).toBe(2);
    expect(split.regularAmount).toBe(20947.94);
    expect(split.edAmount).toBe(2138);
    expect(split.actual).toBe(23085.94);
    const mis = misBillingLine({ perDay: 805.69, billedDays: 28, otDays: 2, total: split.actual, intraState: true, extraDutyRate: 1069 });
    expect(mis.regularBilling).toBe(20947.94);
    expect(mis.otBilling).toBe(2138);
    expect(mis.totalBilling).toBe(23085.94);
  });
  it("prices a half-day Extra Duty proportionally", () => {
    expect(splitInvoiceDuties({ billedDays: 26.5, otDays: 0.5, regularRate: 805.69, extraDutyRate: 1069 }).edAmount).toBe(534.5);
  });
  it("bills ED-only attendance without a regular charge", () => {
    const split = splitInvoiceDuties({ billedDays: 2, otDays: 2, regularRate: 805.69, extraDutyRate: 1069 });
    expect(split.regularAmount).toBe(0);
    expect(split.actual).toBe(2138);
  });
});