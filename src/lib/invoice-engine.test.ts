import { describe, expect, it } from "vitest";
import { computeInvoiceUnit, invoiceUnitTaxable, type InvoiceGlobals, type InvoiceUnitData } from "./invoice-engine";
import { additionsForPeriod, choosePeriodContract } from "./invoice-engine-bulk";
import { DEFAULT_SPLIT } from "./invoice-split";

const globals: InvoiceGlobals = {
  codes: [
    { code: "P", counts_as_present: true, is_paid: true, day_value: 1 },
    { code: "A", counts_as_present: false, is_paid: false, day_value: 0 },
  ],
  pdbs: [{ id: "pdb26", method: "fixed_days", fixed_days: 26 }],
  bdbs: [{ id: "bdb26", method: "fixed_days", fixed_days: 26 }],
  designationNames: new Map([["guard", "Security Guard"]]),
  masters: new Map(),
  publicHolidays: [],
  phTypeIds: new Set(),
  ptSlabs: [],
  pincodeRanges: [],
  lwfRows: [],
};

function site(start: string, end: string, presentDates: string[]): InvoiceUnitData {
  return {
    unitId: "u1", start, end, unitCode: "CLI1", customerName: "Client", epfCapEnabled: true,
    ptState: null, ptPincode: null, unitPh: null, woAsPresent: false, exactDayRate: false,
    primary: [{ id: "g1", employee_code: "1", full_name: "Guard", designation_id: "guard" }],
    links: [], secondary: [], leavers: [],
    entries: presentDates.map((d) => ({ candidate_id: "g1", designation_id: "guard", entry_date: d, code: "P", ot_hours: 0, shift_hours: 0, is_reliever: false })),
    periodContract: { id: "c1", billing_type_id: null, gst_option: "igst" },
    billingMode: "man_days",
    resources: [{ id: "r1", designation_id: "guard", quantity: 1, components: [{ name: "Basic", amount: 26000 }], benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "pdb26", billing_day_base_id: "bdb26", shift_hours: 8 }],
    revisions: null, additions: [], deductions: [],
  };
}
const taxable = (d: InvoiceUnitData) =>
  invoiceUnitTaxable(computeInvoiceUnit(d, globals), { unitId: "u1", unitCode: "CLI1", customerName: "Client", invoiceSplit: DEFAULT_SPLIT, exactDayRate: false }, []).taxable;

describe("invoice engine (shared by invoice page and dashboard)", () => {
  it("bills duties at contract monthly billing ÷ billing days: ₹26,000 ÷ 26 × 20 duties = ₹20,000", () => {
    const dates = Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 7, 21 + i)).toISOString().slice(0, 10));
    const d = site("2026-08-21", "2026-09-20", dates);
    expect(taxable(d)).toBe(20000);
  });

  it("only counts attendance inside the site's own period (21 Aug–20 Sep ignores 21–30 Sep)", () => {
    const own = site("2026-08-21", "2026-09-20", ["2026-08-25", "2026-09-10", "2026-09-25"]);
    own.entries = own.entries.filter((e) => e.entry_date <= "2026-09-20");
    expect(taxable(own)).toBe(2000);
  });

  it("ignores reconciliation cash and day adjustments without changing contract billing or genuine deductions", () => {
    const d = site("2026-09-01", "2026-09-30", ["2026-09-01", "2026-09-02"]);
    d.additions = [{ candidate_id: "g1", addition_name: "Payroll Adjustment", calculation_type: "fixed", amount: 1089, installments: 1, source_kind: "pages_sep_2026_recon", entry_mode: "days_x_per_day", include_in_total_days: true, days: 3, affects_days_for: ["present"] }];
    d.deductions = [
      { candidate_id: "g1", deduction_name: "Payroll Adjustment", calculation_type: "fixed", amount: 583, installments: 1, source_kind: "pages_sep_2026_recon" },
      { candidate_id: "g1", deduction_name: "Uniform recovery", calculation_type: "fixed", amount: 100, installments: 1, source_kind: "manual" },
    ];
    const { rows } = computeInvoiceUnit(d, globals);
    expect(rows[0]?.wages?.earnedGross).toBe(2000);
    expect(rows[0]?.wages?.totalDeductions).toBe(100);
    expect(rows[0]?.wages?.netPay).toBe(1900);
    expect(taxable(d)).toBe(2000);
  });
});

describe("bulk loader rules mirror the invoice page queries", () => {
  it("picks the overlapping contract with latest start, active before expired, then newest", () => {
    const c = choosePeriodContract([
      { id: "old", status: "active", start_date: "2025-01-01", end_date: null, created_at: "2025-01-01" },
      { id: "copy", status: "expired", start_date: "2026-04-01", end_date: "2027-03-31", created_at: "2026-05-01" },
      { id: "live", status: "active", start_date: "2026-04-01", end_date: "2027-03-31", created_at: "2026-04-01" },
    ], "2026-09-01", "2026-09-30");
    expect(c?.id).toBe("live");
  });

  it("keeps repeating additions that are still running and drops other sites' additions", () => {
    const rows = [
      { candidate_id: "g1", addition_name: "A", calculation_type: "fixed", amount: 100, installments: 1, status: "active", addition_date: "2026-06-01", repeat_monthly: true, end_date: null, unit_id: null },
      { candidate_id: "g1", addition_name: "B", calculation_type: "fixed", amount: 100, installments: 1, status: "active", addition_date: "2026-06-01", repeat_monthly: false, end_date: null, unit_id: null },
      { candidate_id: "g1", addition_name: "C", calculation_type: "fixed", amount: 100, installments: 1, status: "active", addition_date: "2026-09-05", repeat_monthly: false, end_date: null, unit_id: "other" },
    ];
    expect(additionsForPeriod(rows, new Set(["g1"]), "u1", "2026-09-01", "2026-09-30").map((a) => a.addition_name)).toEqual(["A"]);
  });
});
