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
});