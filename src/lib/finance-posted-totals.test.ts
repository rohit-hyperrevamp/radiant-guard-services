import { describe, expect, it } from "vitest";
import { latestPostedPayrollTotals, type PostedPayrollSnapshot } from "./finance-posted-totals";

const snapshot = (version: number, gross: number): PostedPayrollSnapshot => ({ payroll_run_id: "run", version, unit_id: "site", gross, total_deductions: 0, net_pay: gross, total_employer: 100, employer_contributions: [{ name: "Management Fee", amount: 20 }] });

describe("posted finance provenance", () => {
  it("uses only the latest complete payroll version, never original plus amendment", () => {
    expect(latestPostedPayrollTotals([snapshot(1, 1000), snapshot(2, 1100)]).get("site")?.gross).toBe(1100);
  });
  it("preserves an explicitly posted zero employer amount", () => {
    expect(latestPostedPayrollTotals([{ ...snapshot(1, 1000), total_employer: 0 }]).get("site")?.employer).toBe(0);
  });
  it("separates saved fees and reliever charges without changing posted total or earned gross", () => {
    const t = latestPostedPayrollTotals([{...snapshot(2,18000),total_employer:4800,employer_contributions:[{name:'ER EPF',amount:1800},{name:'Admin Fee',amount:200},{name:'Service Fee',amount:400},{name:'Management Fee',amount:1500},{name:'Reliever Charges',amount:900}]}]).get('site');
    expect(t?.gross).toBe(18000);
    expect(t?.employer).toBe(4800);
    expect(t?.employerCost).toBe(1800);
    expect(t?.billingAddons).toBe(3000);
  });
});