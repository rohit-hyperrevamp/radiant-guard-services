import { describe, expect, it } from "vitest";
import { dashboardFinanceRows, FINANCE_CALCULATION_VERSION, financeLossReason, financeProfit, financeRowIsCurrent, type SavedFinanceRow } from "./finance-totals";
import { checkedQueryData } from "./finance-source";

describe("authoritative finance totals", () => {
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
});