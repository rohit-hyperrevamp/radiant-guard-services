import { describe, expect, it } from "vitest";
import { computePayrollUnitRows, type PayrollUnitSource } from "./payroll-engine";
import { computeWages, type ContractResourceLike } from "./payroll-calc";
import { prepareContractPayrollResource } from "./payroll-contract-rules";

const base: ContractResourceLike = {
  designationId: "guard",
  components: [{ name: "Basic", amount: 26000, includeInOt: true }],
  benefits: [], deductions: [], employerContributions: [],
  payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
};
const totals = { pDays: 13, otDays: 1, otHours: 1, phDays: 0, otherPaidDays: 0, tDays: 14 };
const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

function fixture(): PayrollUnitSource {
  return {
    primary: [{ id: "person", employee_code: "TEST", full_name: "Payroll test", designation_id: "guard" }],
    secondary: [], linkIds: [], attendedIds: [], people: new Map(), designations: new Map([["guard", "Security Guard"]]),
    entries: dates.slice(0, 13).map((entry_date, i) => ({ candidate_id: "person", designation_id: "guard", entry_date, code: "P", ot_hours: i === 0 ? 1 : 0, shift_hours: 8 })),
    codes: [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }],
    periodContract: { id: "contract", is_internal: false },
    resources: [{ id: "rate", designation_id: "guard", shift_hours: 8, components: base.components, benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "days", ot_basis: "components", ot_multiplier: 1 }],
    additions: [{ candidate_id: "person", addition_name: "Pages PH", addition_type_id: "ph", source_kind: "pages_import", amount: 5000, days: 5, installments: 1 }],
    deductions: [{ candidate_id: "person", deduction_name: "Balancing", source_kind: "manual", amount: 999, deduction_date: "2026-09-30" }],
    priorAttendance: async () => { throw new Error("Client payroll must not read adjustment carry-forward"); },
    addTypes: [{ id: "ph", code: "paid_holidays" }],
    pdbs: [{ id: "days", method: "fixed_days", fixed_days: 26 }],
    hydrate: () => { throw new Error("Client payroll must use the saved formula, not the latest master"); },
    postingShifts: [],
    employeeWages: [{ candidate_id: "person", designation_id: "guard", components: [{ name: "Basic", amount: 99999 }] }],
    otherSitePt: new Map(), ptAllocated: new Map([["person", 999]]),
  };
}
const input = { unitId: "site", start: "2026-09-01", end: "2026-09-30", periodDates: dates, ptState: null, ptPincode: null, epfCapEnabled: true, esiRoundUp: true, woAsPresent: false, unitPh: null, phConfig: null, ptSlabs: [], pincodeRanges: [], lwfRows: [] };

describe("contract-only client payroll", () => {
  it("ignores ledger cash/day adjustments, personal salary and imported PT allocations", async () => {
    const rows = await computePayrollUnitRows(input, fixture());
    const row = rows[0];
    expect(rows).toHaveLength(1);
    expect(row?.wages?.earnedGross).toBe(14000);
    expect(row?.wages?.totalDeductions).toBe(0);
    expect(row?.wages?.netPay).toBe(14000);
    expect(row?.totals.phDays).toBe(0);
    expect(row?.totals.pDays).toBe(13);
  });

  it("applies an identical saved employee PF formula once without modifying the source", async () => {
    const src = fixture();
    const line = { name: "EE EPF", amount: 1800, formulaMode: "advanced", formulaExpression: "min(basic,15000)*0.12", percentage: 12, capAmount: 15000 };
    const raw = src.resources[0];
    if (!raw) throw new Error("Missing fixture");
    raw["deductions"] = [line, { ...line, name: "PF 12%" }];
    const rows = await computePayrollUnitRows(input, src);
    expect(rows[0]?.wages?.totalDeductions).toBe(1560);
    expect(rows[0]?.calculationIssues.some((i) => i.kind === "exact_duplicate")).toBe(true);
    expect(raw["deductions"]).toHaveLength(2);
  });

  it("uses the selected PT slab without importing Pages allocations or replacing explicit contract PT", async () => {
    const src = fixture();
    const raw = src.resources[0];
    if (!raw) throw new Error("Missing fixture");
    raw["deductions"] = [{ name: "Professional Tax", amount: 0 }];
    const ptInput = { ...input, ptState: "Maharashtra", ptSlabs: [{ state: "Maharashtra", region_label: "All Pincodes", salary_min: 10000, salary_max: null, tax_per_month: 200, gender: "all" }] };
    const rows = await computePayrollUnitRows(ptInput, src);
    expect(rows[0]?.wages?.totalDeductions).toBe(200);
    raw["deductions"] = [{ name: "Professional Tax", amount: 150, calcType: "fixed", deductionCalcType: "fixed_amount" }];
    const fixed = await computePayrollUnitRows(ptInput, src);
    expect(fixed[0]?.wages?.totalDeductions).toBe(150);
  });

  it("blocks ambiguous repeated PF instead of choosing a formula by assumption", () => {
    const prepared = prepareContractPayrollResource({ ...base, deductions: [
      { name: "EE PF", amount: 1800, formulaExpression: "basic*0.12" },
      { name: "Employee EPF", amount: 1800, formulaExpression: "(basic+da)*0.12" },
    ] });
    expect(prepared.issues.some((i) => i.kind === "possible_duplicate" && i.blocking)).toBe(true);
  });

  it("never substitutes a hidden 26-day divisor when the contract has none", async () => {
    const src = fixture();
    const raw = src.resources[0];
    if (!raw) throw new Error("Missing fixture");
    raw["payroll_day_base_id"] = null;
    const rows = await computePayrollUnitRows(input, src);
    expect(rows[0]?.wages).toBeNull();
    expect(rows[0]?.calculationIssues.some((i) => i.kind === "missing_setting" && i.blocking)).toBe(true);
  });

  it("preserves uncapped saved PF and fixed contract ESI rather than injecting statutory amounts", () => {
    const wages = computeWages(totals, { ...base,
      deductions: [{ name: "EE PF", amount: 3120, formulaMode: "advanced", formulaExpression: "basic*0.12" }],
      employerContributions: [{ name: "ER ESIC", amount: 100, calcType: "fixed", deductionCalcType: "earned_salary" }],
    }, 30, { savedContractOnly: true, epfCapEnabled: true, esiRoundUp: true });
    expect(wages.totalDeductions).toBe(1560);
    expect(wages.totalEmployerContributions).toBe(50);
    const full = computeWages({ ...totals, pDays: 26, otDays: 0, tDays: 26 }, { ...base, deductions: [{ name: "EE PF", amount: 3120, formulaMode: "advanced", formulaExpression: "basic*0.12" }] }, 30, { savedContractOnly: true, epfCapEnabled: true });
    expect(full.totalDeductions).toBe(3120);
  });

  it("uses unique shift rows and one explicit saved PF cap across a person's roles", async () => {
    const src = fixture();
    const raw = src.resources[0];
    if (!raw) throw new Error("Missing fixture");
    const pf = { name: "EE PF", amount: 1800, formulaMode: "advanced", formulaExpression: "min(basic,15000)*0.12", capAmount: 15000, percentage: 12 };
    raw["deductions"] = [pf];
    src.resources.push({ ...raw, id: "second-shift", shift_hours: 12 });
    src.entries.push(...dates.slice(13, 26).map((entry_date) => ({ candidate_id: "person", designation_id: "guard", entry_date, code: "P", ot_hours: 0, shift_hours: 12 })));
    const rows = await computePayrollUnitRows(input, src);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.rowKey)).size).toBe(2);
    expect(rows.reduce((n, r) => n + (r.wages?.totalDeductions ?? 0), 0)).toBe(1800);
  });

  it("does not mistake employer PF administration or employee/employer sides for duplicate PF", () => {
    const prepared = prepareContractPayrollResource({ ...base,
      deductions: [{ name: "EE PF", amount: 1800 }],
      employerContributions: [{ name: "ER PF", amount: 1950 }, { name: "EPF Admin", amount: 150 }],
    });
    expect(prepared.issues.filter((i) => i.kind.includes("duplicate"))).toHaveLength(0);
  });
});