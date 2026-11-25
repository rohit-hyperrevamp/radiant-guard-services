/**
 * The register's shared finance context must feed both bulk engines exactly
 * the rows their own per-batch reads returned: same invoice and payroll money
 * for every site, with the period-wide inputs read once instead of per batch.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, channel: () => ({}) },
}));

import { computeDashboardUnitFinance } from "./dashboard-finance";
import { computePayrollUnitsTotals } from "./payroll-engine";
import { additionsForPeriod, deductionsForPeriod } from "./invoice-engine-bulk";
import {
  contextAdditions,
  contextDeductions,
  INVOICE_ADDITION_FIELDS,
  INVOICE_DEDUCTION_FIELDS,
  loadFinanceSharedContext,
  payrollDeductionFrom,
} from "./finance-shared-context";
import { realtimeKeyMatches } from "./period-status";
import type { RawAddition, RawDeduction } from "./invoice-engine";

type Row = Record<string, unknown>;

const res = (id: string, contract: string, desig: string, basic: number) => ({
  id, contract_id: contract, designation_id: desig, quantity: 2,
  components: [{ name: "Basic", amount: basic }, { name: "HRA", amount: 2000, allowanceId: "al1" }], benefits: [],
  deductions: [{ name: "EPF", amount: 0, costComponentId: "cc1" }], employer_contributions: [{ name: "EPF Employer", amount: 0, costComponentId: "cc1" }],
  payroll_day_base_id: "pdb1", billing_day_base_id: null, invoice_present_cap: null, shift_hours: 8, ot_multiplier: 1, ot_basis: "components",
  ot_formula: null, ot_esi: null, ot_hourly_rate: null, ot_hourly_esic: null, round_off_final: null, round_off_totals: {},
});
const add = (id: string, candidate: string, date: string, over: Row = {}) => ({
  id, candidate_id: candidate, addition_type_id: null, addition_name: `Add ${id}`, calculation_type: "fixed", amount: 300, installments: 1,
  status: "active", entry_mode: null, days: null, include_in_total_days: false, affects_days_for: null, repeat_monthly: false,
  prorate_by_days: false, counts_for_pf: false, counts_for_esi: false, formula_expression: null, per_day_amount: null, source_kind: null,
  addition_date: date, end_date: null, unit_id: null, ...over,
});
const ded = (id: string, candidate: string, date: string, over: Row = {}) => ({
  id, candidate_id: candidate, deduction_name: `Ded ${id}`, calculation_type: "fixed", amount: 150, installments: 1, status: "active",
  entry_mode: null, days: null, include_in_total_days: false, affects_days_for: null, source_kind: null, deduction_date: date, unit_id: null, ...over,
});

const DB: Record<string, Row[]> = {
  attendance_codes: [
    { code: "P", counts_as_present: true, is_paid: true, day_value: 1, enabled: true },
    { code: "A", counts_as_present: false, is_paid: false, day_value: 0, enabled: true },
  ],
  payroll_day_bases: [{ id: "pdb1", method: "fixed_days", fixed_days: 26, weekly_off_day: null, included_weekdays: null, enabled: true }],
  billing_day_bases: [],
  designations: [{ id: "d1", name: "Security Guard" }, { id: "d2", name: "Supervisor" }],
  public_holidays: [
    { id: "h2", name: "Gandhi Jayanti", holiday_month: 10, holiday_day: 2, enabled: true, sort_order: 0 },
    { id: "h1", name: "Onam", holiday_month: 9, holiday_day: 15, enabled: true, sort_order: 0 },
  ],
  addition_types: [{ id: "at1", code: "paid_holidays" }],
  professional_tax_slabs: [
    { id: "pt1", state: "Maharashtra", region_label: "All", salary_min: 0, salary_max: 7500, tax_per_month: 0, gender: "all" },
    { id: "pt2", state: "Maharashtra", region_label: "All", salary_min: 7501, salary_max: null, tax_per_month: 200, gender: "all" },
  ],
  pincode_ranges: [],
  labour_welfare_funds: [],
  allowance_types: [{ id: "al1", formula_mode: null, formula_expression: null, formula_version: null, fixed_calc_method: null, fixed_duty_components: null, fixed_duty_divisor: null }],
  cost_components: [{ id: "cc1", formula_mode: "formula", formula_expression: "Basic * 0.12", formula_version: 1, fixed_calc_method: null, fixed_duty_components: null, fixed_duty_divisor: null }],
  billing_types: [{ id: "bt1", code: "man_days" }],
  contract_rate_revisions: [],
  inv_settings: [{ key: "payroll_esi_round_up", value: { enabled: false } }],
  additions: [
    add("a01", "c1", "2026-09-10"),                                             // in u1's window
    add("a02", "c2", "2026-08-28"),                                             // in u2's window only
    add("a03", "c1", "2026-03-01"),                                             // old one-off: never applies
    add("a04", "c3", "2026-05-01", { repeat_monthly: true }),                   // repeating, still running
    add("a05", "c3", "2026-05-01", { repeat_monthly: true, end_date: "2026-07-31" }), // repeating, ended
    add("a06", "c1", "2026-10-05"),                                             // after every window
    add("a07", "c2", "2026-09-20", { unit_id: "u1" }),                          // site-scoped
    add("a08", "c1", "2026-09-12", { status: "inactive" }),
  ],
  deductions: [
    ded("d01", "c1", "2026-09-05"),
    ded("d02", "c2", "2026-08-27"),
    ded("d03", "c1", "2026-07-20", { source_kind: "unit_fee" }),                // payroll lead-in only
    ded("d04", "c2", "2026-05-01"),                                             // before every lead-in
    ded("d05", "c3", "2026-09-28", { unit_id: "u2" }),
    ded("d06", "c1", "2026-10-02"),
  ],
  employee_wages: [{ candidate_id: "c3", designation_id: "d1", components: [{ name: "Basic", amount: 16000 }], benefits: [], deductions: [], employer_contributions: [], payroll_day_base_id: "pdb1" }],
  payroll_run_snapshots: [],
  pt_site_allocations: [],
  attendance_entries: [],
};

const PERIODS: Record<string, { start: string; end: string }> = {
  u1: { start: "2026-09-01", end: "2026-09-30" },
  u2: { start: "2026-08-26", end: "2026-09-25" },
};
const SITES: Row[] = ["u1", "u2"].map((id) => ({
  id, code: `CLI-${id}`, name: `Site ${id}`, billing_state: "Maharashtra", billing_pincode: "411001", pt_state: "Maharashtra", epf_cap_enabled: true,
  ph_enabled: true, ph_multiplier: 1, ph_day_value: null, ph_excluded_candidate_ids: [], ph_excluded_days: [], customer_name: "Acme", customer_invoice_split: null,
}));
const CONTRACTS: Row[] = [
  { id: "k1", unit_id: "u1", status: "active", start_date: "2026-01-01", end_date: null, created_at: "2026-01-01", billing_type_id: "bt1", wo_as_present: false, exact_day_rate: false, is_internal: false, gst_option: "18" },
  // Internal cost centre: own wages, per-person additions / deductions and the joining-fee lead-in apply.
  { id: "k2", unit_id: "u2", status: "active", start_date: "2026-01-01", end_date: null, created_at: "2026-01-01", billing_type_id: "bt1", wo_as_present: false, exact_day_rate: false, is_internal: true, gst_option: "18" },
];
const RESOURCES = [res("r1", "k1", "d1", 15000), res("r2", "k1", "d2", 18000), res("r3", "k2", "d1", 14000), res("r4", "k2", "d2", 17000)];
const PEOPLE: Record<string, unknown[]> = {
  c1: ["c1", "u1", true, "active", "E1", "Asha", "d1", "female", false, "2026-01-01"],
  c2: ["c2", "u2", true, "active", "E2", "Bala", "d2", "male", false, "2026-01-01"],
  c3: ["c3", "u2", true, "active", "E3", "Chet", "d1", "male", false, "2026-01-01"],
};
const ROSTER: Record<string, string[]> = { u1: ["c1"], u2: ["c2", "c3"] };
const LINKS: Record<string, unknown[][]> = { u1: [["u1", "c2", 8]], u2: [] };
const ATT: Record<string, [string, string, number, string, number][]> = {
  u1: [["c1", "d1", 0, "P", 1], ["c1", "d1", 1, "P", 0], ["c1", "d1", 2, "A", 0], ["c2", "d2", 3, "P", 0], ["c2", "d2", 14, "P", 0]],
  u2: [["c2", "d2", 0, "P", 0], ["c2", "d2", 1, "P", 2], ["c3", "d1", 2, "P", 0], ["c3", "d1", 3, "P", 0]],
};

function periodPayload(units: { u: string; s: string; e: string }[]) {
  const c: string[] = [];
  const d: string[] = [];
  const idx = (list: string[], v: string) => { let i = list.indexOf(v); if (i < 0) { list.push(v); i = list.length - 1; } return i; };
  const ids = units.map((x) => x.u);
  return {
    site: SITES.filter((s) => ids.includes(String(s.id))),
    contracts: CONTRACTS.filter((k) => ids.includes(String(k.unit_id))),
    primary: ids.flatMap((u) => ROSTER[u].map((cid) => { const p = PEOPLE[cid]; return [p[0], p[1], p[4], p[5], p[6], p[7], p[8], p[9]]; })),
    scopes: [], extras: [],
    links: ids.flatMap((u) => LINKS[u]),
    people: Object.values(PEOPLE),
    units: units.map((x) => ({ u: x.u, s: x.s, r: ATT[x.u].map(([cid, did, off, code, ot]) => [idx(c, cid), idx(d, did), off, code, ot, 8, 0]) })),
    c, d,
  };
}

const ors: string[] = [];
/** Fake client: records reads and applies eq / gte / lte / in (an `.or` is ignored, i.e. a superset). */
function fakeDb() {
  const reads: string[] = [];
  const builder = (table: string) => {
    const f: ((r: Row) => boolean)[] = [];
    let cols: string[] | null = null;
    let range: [number, number] | null = null;
    let single = false;
    const key = (c: string) => !c.includes(".");
    const b: Record<string, unknown> = {
      select: (spec = "*") => { const names = String(spec).split(",").map((x) => x.trim().replace(/[!(].*$/s, "")).filter(Boolean); cols = names.includes("*") ? null : names; return b; },
      eq: (c: string, v: unknown) => { if (key(c)) f.push((r) => r[c] === v); return b; },
      gte: (c: string, v: string) => { if (key(c)) f.push((r) => r[c] != null && String(r[c]) >= v); return b; },
      lte: (c: string, v: string) => { if (key(c)) f.push((r) => r[c] != null && String(r[c]) <= v); return b; },
      in: (c: string, v: unknown[]) => { if (key(c)) f.push((r) => v.includes(r[c])); return b; },
      or: (filter: string) => { ors.push(`${table}:${filter}`); return b; }, order: () => b, limit: () => b,
      range: (a: number, z: number) => { range = [a, z]; return b; },
      maybeSingle: () => { single = true; return b; },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
        reads.push(table);
        let rows = (DB[table] ?? []).filter((r) => f.every((fn) => fn(r)));
        if (range) rows = rows.slice(range[0], range[1] + 1);
        const pick = (r: Row) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])) : { ...r });
        return Promise.resolve({ data: single ? (rows[0] ? pick(rows[0]) : null) : rows.map(pick), error: null }).then(ok, bad);
      },
    };
    return b;
  };
  const db = {
    from: (t: string) => builder(t),
    rpc: (fn: string, args: Row) => {
      reads.push(`rpc:${fn}`);
      if (fn === "invoice_period_entries") return Promise.resolve({ data: structuredClone(periodPayload(args.p_units as never)), error: null });
      if (fn === "invoice_contract_resources") return Promise.resolve({ data: structuredClone(RESOURCES.filter((r) => (args.p_contract_ids as string[]).includes(r.contract_id))), error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { db, reads };
}

const stable = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: [...x.entries()] } : x instanceof Set ? { __set: [...x] } : x)));
const batches = [new Map([["u1", PERIODS.u1]]), new Map([["u2", PERIODS.u2]])];

describe("register shared finance context", () => {
  it("both engines compute identical money with the shared context as with their own reads", async () => {
    const own = fakeDb();
    const before = [];
    for (const b of batches) before.push(stable({ inv: await computeDashboardUnitFinance(b, own.db as never), pay: await computePayrollUnitsTotals(b, own.db as never) }));

    const shared = fakeDb();
    const ctx = await loadFinanceSharedContext({ minStart: "2026-08-26", maxEnd: "2026-09-30" }, shared.db as never);
    const ctxReads = shared.reads.length;
    const after = [];
    for (const b of batches) after.push(stable({ inv: await computeDashboardUnitFinance(b, shared.db as never, ctx), pay: await computePayrollUnitsTotals(b, shared.db as never, ctx) }));

    expect(after).toEqual(before);
    // Every site priced by both engines, and the additions really feed the money.
    for (const b of before) { expect(b.inv.__map).toHaveLength(1); expect(b.pay.__map).toHaveLength(1); }
    for (const table of ["additions", "deductions"]) {
      const saved = DB[table];
      DB[table] = [];
      try {
        const without = stable(await computePayrollUnitsTotals(batches[1], fakeDb().db as never));
        expect(without).not.toEqual(before[1].pay);
      } finally {
        DB[table] = saved;
      }
    }
    // Per batch, the shared inputs are never read again.
    const perBatch = shared.reads.slice(ctxReads);
    for (const t of ["additions", "deductions", "allowance_types", "cost_components", "public_holidays", "inv_settings", "contract_rate_revisions", "billing_day_bases"]) {
      expect(perBatch.filter((x) => x === t)).toEqual([]);
    }
    const ownCount = (t: string) => own.reads.filter((x) => x === t).length;
    expect(ownCount("deductions")).toBe(4); // 2 batches × 2 engines
    expect(shared.reads.filter((x) => x === "deductions")).toHaveLength(1);
  });

  it("a batch outside the context window ignores it and reads for itself", async () => {
    const shared = fakeDb();
    const ctx = await loadFinanceSharedContext({ minStart: "2026-09-01", maxEnd: "2026-09-30" }, shared.db as never);
    const n = shared.reads.length;
    await computePayrollUnitsTotals(batches[1], shared.db as never, ctx); // u2 starts 2026-08-26
    expect(shared.reads.slice(n)).toContain("deductions");
  });

  it("each engine's per-site additions / deductions are exactly those of its old server read", async () => {
    const { db } = fakeDb();
    const ctx = await loadFinanceSharedContext({ minStart: "2026-08-26", maxEnd: "2026-09-30" }, db as never);
    for (const [unitId, p] of Object.entries(PERIODS)) {
      const roster = new Set(["c1", "c2", "c3"]);
      // Old server reads: every active addition up to the batch end; deductions in [start, end].
      const oldAdds = DB.additions.filter((a) => a.status === "active" && String(a.addition_date) <= p.end);
      const oldDeds = DB.deductions.filter((d) => d.status === "active" && String(d.deduction_date) >= p.start && String(d.deduction_date) <= p.end);
      const newAdds = contextAdditions(ctx, INVOICE_ADDITION_FIELDS, p.start, p.end);
      const newDeds = contextDeductions(ctx, INVOICE_DEDUCTION_FIELDS, p.start, p.end);
      expect(additionsForPeriod(newAdds as unknown as RawAddition[], roster, unitId, p.start, p.end).map((a) => (a as unknown as Row).addition_name))
        .toEqual(additionsForPeriod(oldAdds as unknown as RawAddition[], roster, unitId, p.start, p.end).map((a) => (a as unknown as Row).addition_name));
      expect(deductionsForPeriod(newDeds as unknown as RawDeduction[], roster, unitId, p.start, p.end))
        .toEqual(deductionsForPeriod(oldDeds.map((r) => Object.fromEntries(INVOICE_DEDUCTION_FIELDS.map((c) => [c, r[c]]))) as unknown as RawDeduction[], roster, unitId, p.start, p.end));
      // Payroll keeps its 62-day joining-fee lead-in.
      const from = payrollDeductionFrom(p.start);
      expect(contextDeductions(ctx, ["deduction_name"], from, p.end).map((d) => d.deduction_name))
        .toEqual(DB.deductions.filter((d) => d.status === "active" && String(d.deduction_date) >= from && String(d.deduction_date) <= p.end).map((d) => d.deduction_name));
    }
    // The window read carries the single-site page's lower bound (no more "every active addition ever").
    expect(ors).toContain("additions:addition_date.gte.2026-08-26,and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.2026-08-26))");
  });

  it("hands every caller its own copy", async () => {
    const { db } = fakeDb();
    const ctx = await loadFinanceSharedContext({ minStart: "2026-08-26", maxEnd: "2026-09-30" }, db as never);
    const a = contextAdditions(ctx, INVOICE_ADDITION_FIELDS, "2026-09-01", "2026-09-30");
    a[0].amount = 999999;
    expect(contextAdditions(ctx, INVOICE_ADDITION_FIELDS, "2026-09-01", "2026-09-30")[0].amount).toBe(300);
  });

  it("orders holidays by month and day for both engines", async () => {
    const { db } = fakeDb();
    const ctx = await loadFinanceSharedContext({ minStart: "2026-08-26", maxEnd: "2026-09-30" }, db as never);
    expect(ctx.holidays.map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(ctx.invoiceGlobals.publicHolidays.map((h) => h.id)).toEqual(["h1", "h2"]);
  });
});

describe("realtime never refetches every site's rate cards or whole live batches", () => {
  const t = [{ unitId: "u1", month: "2026-09" }];
  it("excludes contract rate cards / codes and live batches; saved totals still refresh", () => {
    expect(realtimeKeyMatches(["finance-charter-contracts", "u1:2026-09-01:2026-09-30"], t)).toBe(false);
    expect(realtimeKeyMatches(["finance-charter-contract-codes", "u1:2026-09-01:2026-09-30"], t)).toBe(false);
    expect(realtimeKeyMatches(["finance-charter-live", "u1:2026-09-01:2026-09-30"], t)).toBe(false);
    expect(realtimeKeyMatches(["finance-charter-live-site", "u1", "2026-09-01", "2026-09-30", 0], ["all"])).toBe(false);
    expect(realtimeKeyMatches(["finance-charter-saved-totals-v5", "u1:2026-09-01:2026-09-30"], t)).toBe(true);
    expect(realtimeKeyMatches(["finance-charter-breakdown", "u1", "2026-09-01", "2026-09-30"], t)).toBe(true);
  });
});
