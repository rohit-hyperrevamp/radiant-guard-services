import { describe, expect, it } from "vitest";
import { dashboardFinanceRows, FINANCE_CALCULATION_VERSION, financeLossReason, financeProfit, financeRowIsCurrent, financeSummaryAmount, type SavedFinanceRow } from "./finance-totals";
import { checkedQueryData } from "./finance-source";

describe("authoritative finance totals", () => {
  it("requires the rate-segment calculation version rather than the earlier blended payroll", () => {
    expect(FINANCE_CALCULATION_VERSION).toBe(4);
    const row = { generation: 1, calculated_generation: 1, calculation_version: 3, computed_at: "2026-11-24", totals: { employer_cost: 1800 } } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
  });
  it("retains FPL's fee in invoice revenue without adding it a second time", () => {
    expect(financeProfit({ invoice: 1623569.26, gross: 1219126, employer: 274229.32 })).toBe(130213.94);
  });
  it("retains both management fee and reliever charges as profit, not costs", () => {
    expect(financeProfit({ invoice: 25000, gross: 18000, employer: 1800 })).toBe(5200);
  });
  it("does not manufacture profit when accurate costs exceed billing", () => {
    const values = { invoice: 10000, gross: 9500, employer: 1500 };
    expect(financeProfit(values)).toBe(-1000);
    expect(financeLossReason(values)).toBeTruthy();
  });
  it("never turns a failed finance source read into zero", () => {
    expect(() => checkedQueryData({ data: null, error: { message: "Source unavailable" } })).toThrow("Source unavailable");
  });
  it("rejects saved totals when any source changed after calculation", () => {
    const row = { generation: 5, calculated_generation: 4, calculation_version: FINANCE_CALCULATION_VERSION, computed_at: "2026-11-24T00:00:00Z", totals: { employer_cost: 1800 } } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
    expect(financeRowIsCurrent({ ...row, calculated_generation: 5 })).toBe(true);
  });
  it("lists every selected September client even when only one has refreshed money", () => {
    const periods = new Map([['a', { start: '2026-09-01', end: '2026-09-30' }], ['b', { start: '2026-08-21', end: '2026-09-20' }], ['c', { start: '2026-09-01', end: '2026-09-30' }]]);
    const roster = ['a','b','c'].map(id => ({ id, code: `CLI-${id}`, name: `Client ${id}`, customer_name: 'Bank' }));
    const saved = [{ unit_id: 'a', period_start: '2026-09-01', period_end: '2026-09-30', generation: 1, calculated_generation: 1, calculation_version: FINANCE_CALCULATION_VERSION, computed_at: '2026-11-24', totals: { invoice_amount: 25000, payroll_cost: 18000, employer_cost: 1800 } }] as SavedFinanceRow[];
    const rows = dashboardFinanceRows(periods, saved, roster, new Set());
    expect(rows.map(r => r.unit_code)).toEqual(['CLI-a','CLI-b','CLI-c']);
    expect(rows.map(r => r.totals_status)).toEqual(['ready','pending','pending']);
    expect(rows[0]?.employer_contribution).toBe(1800);
    expect(rows[0]?.variance).toBe(5200);
    expect(rows[1]?.period_start).toBe('2026-08-21');
  });
  it("does not reuse an old month or an old commercial-fee classification", () => {
    const row = { unit_id: 'a', period_start: '2026-10-01', period_end: '2026-10-31', generation: 1, calculated_generation: 1, calculation_version: 1, computed_at: '2026-11-24', totals: { employer_cost: 1800 } } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
    expect(dashboardFinanceRows(new Map([['a', {start:'2026-09-01',end:'2026-09-30'}]]),[row],[],new Set())[0]?.totals_status).toBe('pending');
  });
  it("shows unapproved but current saved totals, rather than hiding a computed client's money", () => {
    const row = { unit_id:'a',period_start:'2026-09-01',period_end:'2026-09-30',generation:1,calculated_generation:1,calculation_version:FINANCE_CALCULATION_VERSION,computed_at:'2026-11-24',totals:{employer_cost:1800,invoice_amount:25000,payroll_cost:18000}} as SavedFinanceRow;
    const result = dashboardFinanceRows(new Map([['a',{start:'2026-09-01',end:'2026-09-30'}]]),[row],[{id:'a',code:'CLI1',name:'Bank',customer_name:'Bank'}],new Set())[0];
    expect(result?.attendance_approved).toBe(false);
    expect(result?.totals_status).toBe('ready');
    expect(result?.invoice_amount).toBe(25000);
  });
  it("does not equate an incomplete saved result with an actual zero", () => {
    const row = { generation: 1, calculated_generation: 1, calculation_version: 1, computed_at: null, totals: null } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(false);
  });
  it("keeps compatible newer saved results visible during a rolling deployment", () => {
    const row = { generation: 7, calculated_generation: 7, calculation_version: 5, computed_at: "2026-11-24", totals: { employer_cost: 1800 } } as SavedFinanceRow;
    expect(financeRowIsCurrent(row)).toBe(true);
    expect(financeRowIsCurrent({ ...row, calculated_generation: 6 })).toBe(false);
  });
  it("withholds a summary when no client has verified amounts instead of reporting zero", () => {
    expect(financeSummaryAmount(0, 0)).toBeNull();
    expect(financeSummaryAmount(25000, 0)).toBeNull();
  });
  it("retains a verified zero result and partial verified amounts", () => {
    expect(financeSummaryAmount(0, 1)).toBe(0);
    expect(financeSummaryAmount(25000, 1)).toBe(25000);
  });
});
import { registerMoney, splitSavedRegisterTotals, FINANCE_CALCULATION_VERSION as V } from "./finance-totals";

describe("register renders saved totals and computes only stale sites", () => {
  const p = { start: "2026-10-21", end: "2026-11-20" };
  const totals = (invoice: number) => ({
    unit_code: "C", unit_name: "S", customer_name: "O", internal: false, contract_value: 0, committed_payroll: 0,
    committed_strength: 0, actual_strength: 0, invoice_amount: invoice, payroll_cost: 600, employer_contribution: 90,
    management_fee: 0, employer_cost: 80, billing_addons: 10, deductions: 50, net_pay: 550, invoice_parts: [],
  });
  const row = (unit_id: string, over: Partial<import("./finance-totals").SavedFinanceRow> = {}) => ({
    unit_id, period_start: p.start, period_end: p.end, generation: 2, calculated_generation: 2,
    calculation_version: V, computed_at: "2026-11-21T00:00:00Z", last_error: null, totals: totals(1000), ...over,
  });

  it("splits fresh rows from stale, failed, other-period and missing ones", () => {
    const periods = new Map([["fresh", p], ["dirty", p], ["failed", p], ["oldwin", p], ["missing", p]]);
    const { ready, stale } = splitSavedRegisterTotals(periods, [
      row("fresh"),
      row("dirty", { calculated_generation: 1 }),
      row("failed", { totals: null, computed_at: null, last_error: "boom" }),
      row("oldwin", { period_start: "2026-09-21", period_end: "2026-10-20" }),
    ]);
    expect([...ready.keys()]).toEqual(["fresh"]);
    expect(stale.sort()).toEqual(["dirty", "failed", "missing", "oldwin"]);
    expect(ready.get("fresh")?.employer_contribution).toBe(80); // actual employer cost, as before
  });

  it("saved wins; live fills stale sites; nothing is guessed while updating", () => {
    const live = {
      engine: new Map([["s", { invoice_amount: 700 }]]),
      pay: new Map([["s", { gross: 400, deductions: 40, net: 360, employer: 60 }]]),
    };
    expect(registerMoney("f", { invoice_amount: 1000, payroll_cost: 600, deductions: 50, net_pay: 550, employer_contribution: 80 }, live))
      .toEqual({ invoiceAmount: 1000, payrollAmount: 600, deductionAmount: 50, netPayrollAmount: 550, employerCost: 80, source: "saved" });
    expect(registerMoney("s", undefined, live))
      .toEqual({ invoiceAmount: 700, payrollAmount: 400, deductionAmount: 40, netPayrollAmount: 360, employerCost: 60, source: "live" });
    // Live batch finished but the engines produced nothing for this site: zero, as the register always showed.
    expect(registerMoney("none", undefined, live)?.invoiceAmount).toBe(0);
    // Still computing: no value at all (shown as "updating", never as ₹0).
    expect(registerMoney("s", undefined, undefined)).toBeNull();
  });
});
