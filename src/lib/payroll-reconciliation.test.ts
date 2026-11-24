import { describe, expect, it } from "vitest";
import { isPayrollReconciliationItem } from "./payroll-reconciliation";
import { computePayrollUnitRows, type PayrollUnitSource } from "./payroll-engine";

describe("reconciliation balancing entries", () => {
  it("rejects reconciliation provenance even after a balancing entry is renamed", () => {
    expect(isPayrollReconciliationItem({ source_kind: "pages_sep_2026_recon", addition_name: "Miscellaneous" })).toBe(true);
    expect(isPayrollReconciliationItem({ source_kind: "pages_sep_2026_recon", deduction_name: "Recovery" })).toBe(true);
  });

  it("rejects posted copies and employee-prefixed Payroll Adjustment names", () => {
    expect(isPayrollReconciliationItem({ source_kind: "payroll_run", addition_name: "Payroll Adjustment" })).toBe(true);
    expect(isPayrollReconciliationItem({ deduction_name: "47363 - Payroll Adjustment - Sep 2026" })).toBe(true);
  });

  it("preserves documented employee allowances, statutory refunds and real payroll amendments", () => {
    expect(isPayrollReconciliationItem({ source_kind: "manual", addition_name: "Driver Allowance" })).toBe(false);
    expect(isPayrollReconciliationItem({ source_kind: "pages_sep_2026", deduction_name: "Professional Tax" })).toBe(false);
    expect(isPayrollReconciliationItem({ source_kind: "payroll_amendment", deduction_name: "Gross deduction" })).toBe(false);
    expect(isPayrollReconciliationItem({ name: "EPF refund", source_kind: "payroll_amendment" })).toBe(false);
  });

  it("calculates contract and actual attendance without either reconciliation additions or deductions", async () => {
    const employee = { id: "person", employee_code: "47363", full_name: "Test employee", designation_id: "guard", is_enabled: true, status: "active" };
    const source: PayrollUnitSource = {
      primary: [employee], linkIds: [], secondary: [], attendedIds: [],
      people: new Map([["person", employee]]), designations: new Map([["guard", "Security Guard"]]),
      entries: ["2026-09-01", "2026-09-02"].map((entry_date) => ({ candidate_id: "person", designation_id: "guard", entry_date, code: "P", ot_hours: 0, shift_hours: 8 })),
      codes: [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }],
      periodContract: { id: "contract" },
      resources: [{ id: "resource", designation_id: "guard", shift_hours: 8, components: [{ name: "Basic", amount: 26000 }], benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "fixed26" }],
      additions: [{ candidate_id: "person", addition_name: "Payroll Adjustment", amount: 1089, installments: 1, calculation_type: "fixed", source_kind: "pages_sep_2026_recon" }],
      deductions: [{ candidate_id: "person", deduction_name: "47363 - Payroll Adjustment - Sep 2026", amount: 583, installments: 1, calculation_type: "fixed", source_kind: "pages_sep_2026_recon", deduction_date: "2026-09-30" }],
      priorAttendance: async () => [], addTypes: [],
      pdbs: [{ id: "fixed26", method: "fixed_days", fixed_days: 26 }],
      hydrate: (rows) => rows, postingShifts: [], employeeWages: [], otherSitePt: new Map(), ptAllocated: new Map(),
    };
    const rows = await computePayrollUnitRows({
      unitId: "site", start: "2026-09-01", end: "2026-09-30",
      periodDates: Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`),
      ptState: null, ptPincode: null, epfCapEnabled: true, esiRoundUp: true,
      woAsPresent: false, unitPh: null, phConfig: null, ptSlabs: [], pincodeRanges: [], lwfRows: [],
    }, source);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.wages?.earnedGross).toBe(2000);
    expect(rows[0]?.wages?.totalDeductions).toBe(0);
    expect(rows[0]?.wages?.netPay).toBe(2000);
  });
});