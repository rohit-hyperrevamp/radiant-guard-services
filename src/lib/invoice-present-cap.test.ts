import { describe, expect, it } from "vitest";
import { allocateInvoicePresent, invoicePresentLimit, invoiceCapPool } from "./invoice-present-cap";
import { periodDateList } from "./mis-billing";
import { computeWages, type AttendanceTotals } from "./payroll-calc";
import { splitInvoiceDuties } from "./invoice-duty-rates";

const rows = (cap: number | null) => [24, 2, 6].map((present, i) => ({ pool: "guard", order: String(i), present, extraDuty: 0, cap }));
describe("optional invoice-only shared Present limit", () => {
  it("pools 24 + 2 + 6 as 26 Present and 6 Extra Duty", () => {
    expect(allocateInvoicePresent(rows(26))).toEqual([
      { present: 24, extraDuty: 0, moved: 0 }, { present: 2, extraDuty: 0, moved: 0 }, { present: 0, extraDuty: 6, moved: 6 },
    ]);
  });
  it("is disabled by default and changes no existing duties", () => {
    expect(invoicePresentLimit({ billingDayBase: { method: "fixed_days", fixedDays: 26 } }, periodDateList("2026-09-01", "2026-09-30"))).toBeNull();
    expect(allocateInvoicePresent(rows(null)).map(r => r.present)).toEqual([24, 2, 6]);
  });
  it("resolves actual minus four to 26, 27 and 24", () => {
    const rule = { invoicePresentCap: true, billingDayBase: { method: "actual_minus_days" as const, fixedDays: 4 } };
    expect(invoicePresentLimit(rule, periodDateList("2026-09-01", "2026-09-30"))).toBe(26);
    expect(invoicePresentLimit(rule, periodDateList("2026-10-01", "2026-10-31"))).toBe(27);
    expect(invoicePresentLimit(rule, periodDateList("2026-02-01", "2026-02-28"))).toBe(24);
  });
  it.each([26, 27, 28, 30.4])("uses fixed divisor %s without clamping", fixedDays => {
    expect(invoicePresentLimit({ invoicePresentCap: true, billingDayBase: { method: "fixed_days", fixedDays } }, periodDateList("2026-02-01", "2026-02-28"))).toBe(fixedDays);
  });
  it("keeps Guards and Supervisors in separate pools", () => {
    const guard = invoiceCapPool("unit", { designationId: "guard", shiftHours: 8 });
    const supervisor = invoiceCapPool("unit", { designationId: "supervisor", shiftHours: 8 });
    const result = allocateInvoicePresent([{ ...rows(26)[0], pool: guard, present: 28 }, { ...rows(26)[0], pool: supervisor, present: 28 }]);
    expect(result.map(r => [r.present, r.extraDuty])).toEqual([[26, 2], [26, 2]]);
  });
  it("preserves 17.5 hours at eight hours per duty with fractional overflow", () => {
    const result = allocateInvoicePresent([{ pool: "guard", order: "1", present: 26.5, extraDuty: 17.5 / 8, cap: 26 }]);
    expect(result[0]).toEqual({ present: 26, extraDuty: 2.6875, moved: .5 });
    expect(result[0].present + result[0].extraDuty).toBe(28.6875);
  });
  it("is independent of input paging/order and shares a cap across rate windows", () => {
    const source = rows(26);
    const reverse = allocateInvoicePresent([...source].reverse()).reverse();
    expect(reverse).toEqual(allocateInvoicePresent(source));
  });
  it("keeps payroll calculations and original attendance unchanged", () => {
    const totals: AttendanceTotals = { pDays: 28, otDays: 1.5, otHours: 1.5, phDays: 1, otherPaidDays: 0, tDays: 30.5 };
    const resource = { designationId: "guard", components: [{ name: "Basic", amount: 26000 }], payrollDayBase: { method: "fixed_days" as const, fixedDays: 26 } };
    const before = computeWages(totals, resource, 30);
    const allocation = allocateInvoicePresent([{ pool: "guard", order: "a", present: totals.pDays, extraDuty: totals.otDays, cap: 26 }])[0];
    const invoice = splitInvoiceDuties({ billedDays: totals.tDays, otDays: allocation.extraDuty, regularRate: 1000, extraDutyRate: 1500 });
    expect(invoice.regularDays).toBe(27); // 26 P + 1 PH, PH never consumes the cap
    expect(invoice.edDays).toBe(3.5);
    expect(invoice.actual).toBe(32250);
    expect(computeWages(totals, resource, 30)).toEqual(before);
    expect(totals.pDays).toBe(28);
    expect(totals.otDays).toBe(1.5);
  });
});