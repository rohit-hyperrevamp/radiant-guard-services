import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { computeAttendanceTotals } from "./payroll-calc";

const r2 = (value: number) => Math.round(value * 100) / 100;
const cases = [
  { code: "CLI2061", monthly: 19776.79, present: 27, ed: 1.625, supplement: 1186.71, taxable: 22157.33, tax: 3988.32, grand: 26146 },
  { code: "CLI2067", monthly: 23952.29, present: 27, ed: 0.25, supplement: 221.83, taxable: 24395.85, tax: 4391.25, grand: 28787 },
  { code: "CLI2068", monthly: 25384, present: 26, ed: 0.375, supplement: 347.8, taxable: 25148.96, tax: 4526.81, grand: 29676 },
  { code: "CLI2343", monthly: 28226.68, present: 27, ed: 0.375, supplement: 386.88, taxable: 29010.75, tax: 5221.93, grand: 34233 },
  { code: "CLI2537", monthly: 23627.44, present: 27, ed: 1, supplement: 875.1, taxable: 25377.62, tax: 4567.97, grand: 29946 },
];

describe("September BFSL issued invoices: double-rate Extra Duty supplement", () => {
  for (const row of cases) {
    it(`${row.code} reconciles taxable, GST and final amount without counting ED twice`, () => {
      const dates = Array.from({ length: row.present }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`);
      const entries = dates.map((entry_date, index) => ({ candidate_id: "employee", entry_date, code: "P", ot_hours: index === 0 ? row.ed : 0 }));
      const totals = computeAttendanceTotals("employee", dates, entries, [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }]);
      const taxable = r2(r2(r2(row.monthly / 27) * r2(totals.tDays)) + row.supplement);
      expect(totals.pDays).toBe(row.present);
      expect(totals.otDays).toBe(r2(row.ed));
      expect(taxable).toBe(row.taxable);
      expect(r2(taxable * 0.18)).toBe(row.tax);
      expect(Math.round(r2(taxable + r2(taxable * 0.18)))).toBe(row.grand);
    });
  }
});