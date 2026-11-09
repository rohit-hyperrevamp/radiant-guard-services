import { describe, expect, it } from "vitest";
import { allocateInvoicePresent, invoicePresentLimit, invoiceCapPool, invoicePoolStrength } from "./invoice-present-cap";
import { periodDateList } from "./mis-billing";
import { computeWages, type AttendanceTotals } from "./payroll-calc";
import { splitInvoiceDuties } from "./invoice-duty-rates";
import { allocateInvoiceEntries } from "./invoice-present-cap";
import { applyInvoiceEdMode, DEFAULT_SPLIT, totalsForPart } from "./invoice-split";

const rows = (cap: number | null) => [24, 2, 6].map((present, i) => ({ pool: "guard", order: String(i), present, extraDuty: 0, cap }));
describe("optional invoice-only shared Present limit", () => {
  it("uses two contracted Guards to bill 52 Present across five replacement employees, with overflow as ED", () => {
    const dates = periodDateList("2026-09-01", "2026-09-30");
    const cap = invoicePresentLimit({ invoicePresentCap: true, quantity: 2, billingDayBase: { method: "actual_minus_days", fixedDays: 4 } }, dates);
    expect(cap).toBe(52);
    const source = [24, 2, 6, 20, 8].map((present, i) => ({ pool: "guard", order: String(i), present, extraDuty: 0, cap }));
    const before = structuredClone(source);
    const result = allocateInvoicePresent(source);
    expect(result.reduce((s, r) => s + r.present, 0)).toBe(52);
    expect(result.reduce((s, r) => s + r.extraDuty, 0)).toBe(8);
    expect(source).toEqual(before);
  });
  it("keeps two Guards and two Supervisors at independent 52-day allowances", () => {
    const rules = ["guard", "supervisor"].map(designationId => ({ designationId, shiftHours: 8, quantity: 2, invoicePresentCap: true, billingDayBase: { method: "fixed_days" as const, fixedDays: 26 } }));
    const strengths = invoicePoolStrength(rules);
    const result = allocateInvoicePresent(rules.map(rule => ({ pool: invoiceCapPool("unit", rule), order: rule.designationId, present: 60, extraDuty: 0, cap: invoicePresentLimit({ ...rule, invoiceCapQuantity: strengths.get(invoiceCapPool("", rule)) }, []) })));
    expect(result.map(r => [r.present, r.extraDuty])).toEqual([[52, 8], [52, 8]]);
  });
  it("uses 54 Present for two contracted heads in a 27-day billing month", () => {
    expect(invoicePresentLimit({ invoicePresentCap: true, quantity: 2, billingDayBase: { method: "actual_minus_days", fixedDays: 4 } }, periodDateList("2026-10-01", "2026-10-31"))).toBe(54);
  });
  it("sums duplicate resource strength once and shares it across raw export entries", () => {
    const rule = { designationId: "guard", shiftHours: 8, quantity: 1, invoicePresentCap: true, billingDayBase: { method: "fixed_days" as const, fixedDays: 26 } };
    const strengths = invoicePoolStrength([rule, rule, { ...rule, shiftHours: 12, quantity: 3 }]);
    expect(strengths.get(invoiceCapPool("", rule))).toBe(2);
    expect(strengths.get(invoiceCapPool("", { ...rule, shiftHours: 12 }))).toBe(3);
    const entries = [24, 2, 6, 20, 8].map((days, i) => ({ unit_id: "unit", candidate_id: String(i), entry_date: "2026-09-01", code: "P", days, ot_hours: 0 }));
    const result = allocateInvoiceEntries(entries, () => ({ ...rule, invoiceCapQuantity: strengths.get(invoiceCapPool("", rule)) }), () => [], e => e.days);
    expect(result.reduce((s, r) => s + r.present, 0)).toBe(52);
    expect(result.reduce((s, r) => s + r.extraDuty, 0)).toBe(8);
  });
  it("fills a strength-based allowance from ED without inventing missing worked days", () => {
    const cap = invoicePresentLimit({ invoicePresentCap: true, quantity: 2, billingDayBase: { method: "fixed_days", fixedDays: 26 } }, []);
    expect(allocateInvoicePresent([{ pool: "guard", order: "a", present: 24, extraDuty: 8, cap }])).toEqual([{ present: 32, extraDuty: 0, moved: -8 }]);
  });
  it("zero contracted strength bills worked duties as ED and rejects invalid strength", () => {
    const rule = { invoicePresentCap: true, quantity: 0, billingDayBase: { method: "fixed_days" as const, fixedDays: 26 } };
    expect(allocateInvoicePresent([{ pool: "guard", order: "a", present: 4, extraDuty: 1, cap: invoicePresentLimit(rule, []) }])).toEqual([{ present: 0, extraDuty: 5, moved: 4 }]);
    expect(() => invoicePresentLimit({ ...rule, quantity: -2 }, [])).toThrow("Invalid contracted invoice strength");
  });
  it("fills CLI3542's 26 invoice duties from 24 P and 4.25 ED without changing payroll", () => {
    const source = [
      { pool: "guard", order: "43299", present: 24, extraDuty: 1.25, cap: 26 },
      ...["31599", "47216", "35595"].map(order => ({ pool: "guard", order, present: 0, extraDuty: 1, cap: 26 })),
    ];
    const before = structuredClone(source);
    const result = allocateInvoicePresent(source);
    expect(result.reduce((s, r) => s + r.present, 0)).toBe(26);
    expect(result.reduce((s, r) => s + r.extraDuty, 0)).toBe(2.25);
    expect(source).toEqual(before);
    const split = applyInvoiceEdMode(DEFAULT_SPLIT, "separate_invoice");
    const main = result.map(r => totalsForPart({ pDays: r.present, otDays: r.extraDuty, otHours: r.extraDuty, phDays: 0, tDays: r.present + r.extraDuty }, true, split, "main"));
    expect(main.reduce((s, r) => s + r.tDays, 0)).toBe(26);
  });
  it("fills the first 27 duties when the billing divisor is 27", () => {
    const result = allocateInvoicePresent([{ pool: "guard", order: "1", present: 24, extraDuty: 8, cap: 27 }]);
    expect(result).toEqual([{ present: 27, extraDuty: 5, moved: -3 }]);
  });
  it("does not invent duties when the total is below the limit", () => {
    expect(allocateInvoicePresent([{ pool: "guard", order: "1", present: 20, extraDuty: 2, cap: 26 }])).toEqual([{ present: 22, extraDuty: 0, moved: -2 }]);
  });
  it("fills raw-entry reliever duties consistently regardless of paging", () => {
    const dates = periodDateList("2026-09-01", "2026-09-30");
    const entries = [{ unit_id: "unit", candidate_id: "a", entry_date: dates[0], code: "P", days: 24, ot_hours: 1.25 }, { unit_id: "unit", candidate_id: "b", entry_date: dates[0], code: "", days: 0, ot_hours: 3 }];
    const rule = { invoicePresentCap: true, billingDayBase: { method: "fixed_days" as const, fixedDays: 26 } };
    const allocate = (values: typeof entries) => allocateInvoiceEntries(values, () => rule, () => dates, e => e.days);
    expect(allocate(entries).map(r => [r.present, r.extraDuty])).toEqual([[25.25, 0], [.75, 2.25]]);
    expect(allocate([...entries].reverse()).reverse()).toEqual(allocate(entries));
  });
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
    const resource = { designationId: "guard", components: [{ name: "Basic", amount: 26000 }], benefits: [], deductions: [], employerContributions: [], payrollDayBase: { method: "fixed_days" as const, fixedDays: 26, weeklyOffDay: null } };
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
  it("matches raw-entry exports to the invoice allocation and preserves holidays", () => {
    const dates = periodDateList("2026-09-01", "2026-09-30");
    const entries = [24, 2, 6].map((days, index) => ({ unit_id: "unit", candidate_id: String(index), entry_date: dates[0], code: "P", days, ot_hours: 0 }));
    const result = allocateInvoiceEntries(entries, () => ({ designationId: "guard", shiftHours: 8, invoicePresentCap: true, billingDayBase: { method: "fixed_days", fixedDays: 26 } }), () => dates, e => e.days);
    expect(result).toEqual(allocateInvoicePresent(rows(26)));
  });
  it("allocates before separate invoice tabs and preserves the complete duty count", () => {
    const allocated = allocateInvoicePresent([{ pool: "guard", order: "1", present: 28, extraDuty: 1.5, cap: 26 }])[0];
    const totals = { pDays: allocated.present, phDays: 0, otDays: allocated.extraDuty, otHours: allocated.extraDuty, tDays: 29.5 };
    const split = applyInvoiceEdMode(DEFAULT_SPLIT, "separate_invoice");
    const parts = split.parts.map(part => totalsForPart(totals, true, split, part.key));
    expect(parts.reduce((sum, p) => sum + p.pDays, 0)).toBe(26);
    expect(parts.reduce((sum, p) => sum + p.otDays, 0)).toBe(3.5);
    expect(parts.reduce((sum, p) => sum + p.tDays, 0)).toBe(29.5);
  });
  it("refuses conflicting role divisors instead of silently guessing", () => {
    expect(() => allocateInvoicePresent([{ ...rows(26)[0] }, { ...rows(27)[1] }])).toThrow("Conflicting Billing Days");
  });
});