/**
 * Regression guard for the per-site detail loaders (invoice + payroll).
 *
 * The loaders were restructured for speed (parallel reads, master tables from
 * the shared reference cache). This runs them against a deterministic fake
 * database and pins the full output with a snapshot recorded from the
 * ORIGINAL sequential loaders: same inputs must give byte-identical outputs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const calls: string[] = [];

const U = "u1";
const DB: Record<string, Row[]> = {
  units: [{ id: U, code: "UN-1", name: "Site One", customer_id: "cu1", epf_cap_enabled: true, billing_state: "Maharashtra", billing_pincode: "411001", pt_state: "Maharashtra", ph_enabled: true, ph_multiplier: 1, ph_day_value: null, ph_excluded_candidate_ids: [], ph_excluded_days: [], is_billable: true, customers: { name: "Acme" } }],
  candidates: [
    { id: "c1", employee_code: "E1", full_name: "Asha", designation_id: "d1", gender: "female", is_disabled: false, preferred_joining_date: "2026-01-01", unit_id: U, is_enabled: true, status: "active" },
    { id: "c2", employee_code: "E2", full_name: "Bala", designation_id: "d2", gender: "male", is_disabled: false, preferred_joining_date: "2026-01-01", unit_id: "u9", is_enabled: true, status: "active" },
    { id: "c3", employee_code: "E3", full_name: "Chet", designation_id: "d1", gender: "male", is_disabled: false, preferred_joining_date: "2026-01-01", unit_id: U, is_enabled: true, status: "approved" },
  ],
  candidate_units: [{ id: "cu-1", candidate_id: "c2", unit_id: U, shift_hours: 8 }],
  employee_scope_assignments: [],
  attendance_entries: [
    ...["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((d, i) => ({ id: `a1-${i}`, unit_id: U, candidate_id: "c1", designation_id: "d1", shift_hours: 8, is_reliever: false, entry_date: d, code: i === 3 ? "A" : "P", ot_hours: i === 0 ? 1 : 0 })),
    ...["2026-09-01", "2026-09-02"].map((d, i) => ({ id: `a2-${i}`, unit_id: U, candidate_id: "c2", designation_id: "d2", shift_hours: 8, is_reliever: false, entry_date: d, code: "P", ot_hours: 0 })),
    ...["2026-09-01", "2026-09-02", "2026-09-03"].map((d, i) => ({ id: `a3-${i}`, unit_id: U, candidate_id: "c3", designation_id: null, shift_hours: 8, is_reliever: false, entry_date: d, code: "P", ot_hours: 0 })),
  ],
  client_contracts: [{ id: "k1", unit_id: U, record_type: "client", status: "active", start_date: "2026-01-01", end_date: null, payroll_window_id: null, billing_type_id: "bt1", gst_option: "18", wo_as_present: false, exact_day_rate: false, is_internal: false, created_at: "2026-01-01" }],
  billing_types: [{ id: "bt1", code: "man_days" }, { id: "bt2", code: "lumpsum" }],
  contract_resources: [
    { id: "r1", contract_id: "k1", designation_id: "d1", quantity: 2, sort_order: 1, components: [{ name: "Basic", amount: 15000 }, { name: "HRA", amount: 3000, allowanceId: "al1" }], benefits: [], deductions: [{ name: "EPF", amount: 0, costComponentId: "cc1" }], employer_contributions: [], payroll_day_base_id: "pdb1", billing_day_base_id: null, invoice_present_cap: null, shift_hours: 8, ot_multiplier: 1, ot_basis: "components", ot_formula: null, ot_esi: null, ot_hourly_rate: null, ot_hourly_esic: null, round_off_final: null, round_off_totals: {} },
    { id: "r2", contract_id: "k1", designation_id: "d2", quantity: 1, sort_order: 2, components: [{ name: "Basic", amount: 18000 }], benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "pdb1", billing_day_base_id: null, invoice_present_cap: null, shift_hours: 8, ot_multiplier: 1, ot_basis: "components", ot_formula: null, ot_esi: null, ot_hourly_rate: null, ot_hourly_esic: null, round_off_final: null, round_off_totals: {} },
  ],
  contract_rate_revisions: [],
  additions: [{ id: "ad1", candidate_id: "c1", addition_type_id: null, addition_name: "Bonus", calculation_type: "fixed", amount: 500, installments: 1, status: "active", entry_mode: null, days: null, include_in_total_days: false, affects_days_for: null, repeat_monthly: false, prorate_by_days: false, counts_for_pf: false, counts_for_esi: false, formula_expression: null, per_day_amount: null, source_kind: null, addition_date: "2026-09-10", end_date: null, unit_id: null }],
  deductions: [{ id: "de1", candidate_id: "c2", deduction_name: "Uniform", calculation_type: "fixed", amount: 200, installments: 1, status: "active", entry_mode: null, days: null, include_in_total_days: false, affects_days_for: null, source_kind: null, deduction_date: "2026-09-12", unit_id: null }],
  attendance_codes: [
    { id: "ac1", code: "P", label: "Present", color: null, counts_as_present: true, is_paid: true, is_leave: false, day_value: 1, sort_order: 1, enabled: true },
    { id: "ac2", code: "A", label: "Absent", color: null, counts_as_present: false, is_paid: false, is_leave: false, day_value: 0, sort_order: 2, enabled: true },
    { id: "ac3", code: "X", label: "Old", color: null, counts_as_present: true, is_paid: true, is_leave: false, day_value: 5, sort_order: 3, enabled: false },
  ],
  payroll_day_bases: [{ id: "pdb1", method: "fixed_days", fixed_days: 26, weekly_off_day: null, included_weekdays: null, enabled: true, caps_present: true }],
  billing_day_bases: [],
  designations: [{ id: "d1", name: "Security Guard" }, { id: "d2", name: "Supervisor" }, { id: "d3", name: "Unused" }],
  public_holidays: [],
  addition_types: [{ id: "at1", code: "paid_holidays" }],
  professional_tax_slabs: [{ id: "pt1", state: "Maharashtra", region_label: "All", salary_min: 0, salary_max: 7500, tax_per_month: 0, gender: "all" }, { id: "pt2", state: "Maharashtra", region_label: "All", salary_min: 7501, salary_max: null, tax_per_month: 200, gender: "all" }],
  pincode_ranges: [],
  labour_welfare_funds: [],
  allowance_types: [{ id: "al1", formula_mode: null, formula_expression: null, formula_version: null, fixed_calc_method: null, fixed_duty_components: null, fixed_duty_divisor: null }],
  cost_components: [{ id: "cc1", formula_mode: "formula", formula_expression: "Basic * 0.12", formula_version: 1, fixed_calc_method: null, fixed_duty_components: null, fixed_duty_divisor: null }],
  employee_wages: [{ candidate_id: "c2", designation_id: "d2", components: [{ name: "Basic", amount: 20000 }], benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "pdb1" }],
  payroll_run_snapshots: [],
  pt_site_allocations: [],
};

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const eqs: [string, unknown][] = [];
    const ins: [string, unknown[]][] = [];
    let single = false;
    let limit: number | null = null;
    let range: [number, number] | null = null;
    let cols: string[] | null = null;
    const b: Record<string, unknown> = {};
    const self = () => b;
    Object.assign(b, {
      select: (spec = "*") => {
        // Top-level columns only; an embed "rel(...)" / "rel!inner(...)" keeps "rel".
        let depth = 0, cur = "";
        const out: string[] = [];
        for (const ch of String(spec)) {
          if (ch === "(") depth++;
          if (ch === ")") depth--;
          if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
        }
        out.push(cur);
        const names = out.map((c) => c.trim().replace(/[!(].*$/s, "")).filter(Boolean);
        cols = names.includes("*") ? null : names;
        return b;
      },
      lte: self, gte: self, lt: self, or: self, order: self, not: self, neq: self,
      eq: (c: string, v: unknown) => { eqs.push([c, v]); return b; },
      in: (c: string, v: unknown[]) => { ins.push([c, v]); return b; },
      limit: (n: number) => { limit = n; return b; },
      range: (a: number, z: number) => { range = [a, z]; return b; },
      maybeSingle: () => { single = true; return b; },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        calls.push(table);
        let rows = (DB[table] ?? []).filter((r) =>
          eqs.every(([c, v]) => c.includes(".") || !(c in r) || r[c] === v) &&
          ins.every(([c, v]) => c.includes(".") || !(c in r) || v.includes(r[c])));
        if (range) rows = rows.slice(range[0], range[1] + 1);
        if (limit != null) rows = rows.slice(0, limit);
        const project = (r: Row) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r });
        const data = single ? (rows[0] ? project(rows[0]) : null) : rows.map(project);
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    });
    return b;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

import { clearReferenceCache } from "./reference-data";
import { computeInvoiceUnit, loadFormulaMastersFor, loadInvoiceGlobals, loadInvoiceUnitData } from "./invoice-engine";
import { computePayrollUnitRows, type PayrollUnitInput } from "./payroll-engine";

const START = "2026-09-01";
const END = "2026-09-30";
const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
const stable = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: [...x.entries()] } : x instanceof Set ? { __set: [...x] } : x)));

beforeEach(() => {
  calls.length = 0;
  clearReferenceCache();
});

describe("invoice detail loader", () => {
  it("produces the same invoice as the original sequential loader", async () => {
    const source = await loadInvoiceUnitData(U, START, END);
    const globals = await loadInvoiceGlobals(source.resources, source.revisions);
    const result = computeInvoiceUnit(source, globals);
    expect(stable({ source, globals, result })).toMatchSnapshot();
  });

  it("gives the same result when globals load alongside the site data (page path)", async () => {
    const sourceP = loadInvoiceUnitData(U, START, END);
    const globals = await loadInvoiceGlobals([], null, sourceP.then((s) => loadFormulaMastersFor(s.resources, s.revisions)));
    const viaPage = computeInvoiceUnit(await sourceP, globals);
    clearReferenceCache();
    const source = await loadInvoiceUnitData(U, START, END);
    const direct = computeInvoiceUnit(source, await loadInvoiceGlobals(source.resources, source.revisions));
    expect(stable(viaPage)).toEqual(stable(direct));
  });
});

describe("payroll detail loader", () => {
  const input = (isBillable: boolean): PayrollUnitInput => ({
    unitId: U, isBillable, start: START, end: END, periodDates: dates, ptState: "Maharashtra", ptPincode: null, epfCapEnabled: true, esiRoundUp: true, woAsPresent: false,
    unitPh: { enabled: true, multiplier: 1, excluded: [], excludedDays: [], dayValue: null }, phConfig: null,
    ptSlabs: DB.professional_tax_slabs as never, pincodeRanges: [], lwfRows: [],
  });
  it("contract payroll rows are unchanged", async () => {
    expect(stable(await computePayrollUnitRows(input(true)))).toMatchSnapshot();
  });
  it("own-wage (non-billable) payroll rows are unchanged", async () => {
    expect(stable(await computePayrollUnitRows(input(false)))).toMatchSnapshot();
  });
});

describe("master tables are shared, not re-fetched per screen", () => {
  const MASTERS = ["attendance_codes", "payroll_day_bases", "designations", "addition_types", "professional_tax_slabs", "pincode_ranges", "labour_welfare_funds", "billing_types"];
  it("a second detail screen reads no master table again", async () => {
    const source = await loadInvoiceUnitData(U, START, END);
    await loadInvoiceGlobals(source.resources, source.revisions);
    calls.length = 0;
    await computePayrollUnitRows({
      unitId: U, isBillable: false, start: START, end: END, periodDates: dates, ptState: null, ptPincode: null, epfCapEnabled: true, esiRoundUp: true, woAsPresent: false,
      unitPh: null, phConfig: null, ptSlabs: [], pincodeRanges: [], lwfRows: [],
    });
    const again = await loadInvoiceUnitData(U, START, END);
    await loadInvoiceGlobals(again.resources, again.revisions);
    expect(calls.filter((t) => MASTERS.includes(t))).toEqual([]);
  });
});
