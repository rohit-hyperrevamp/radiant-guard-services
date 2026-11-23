import { managementFeeOf } from "./contract-billing-addons";

export type PostedPayrollSnapshot = {
  payroll_run_id: string; version: number; unit_id: string;
  gross: number; total_deductions: number; net_pay: number; total_employer: number | null;
  employer_contributions: { name?: string; amount?: number }[] | null;
};

/** Amendments store full snapshots; adding every saved version double-counts payroll. */
export function latestPostedPayrollTotals(snapshots: PostedPayrollSnapshot[]) {
  const latest = new Map<string, number>();
  for (const s of snapshots) latest.set(s.payroll_run_id, Math.max(latest.get(s.payroll_run_id) ?? 0, s.version));
  const out = new Map<string, { gross: number; deductions: number; net: number; employer: number; managementFee: number }>();
  for (const s of snapshots) {
    if (s.version !== latest.get(s.payroll_run_id)) continue;
    const t = out.get(s.unit_id) ?? { gross: 0, deductions: 0, net: 0, employer: 0, managementFee: 0 };
    t.gross += Number(s.gross) || 0; t.deductions += Number(s.total_deductions) || 0; t.net += Number(s.net_pay) || 0;
    // Zero is a valid posted value, not a reason to borrow a different calculation.
    t.employer += s.total_employer == null ? (s.employer_contributions ?? []).reduce((n, l) => n + (Number(l.amount) || 0), 0) : Number(s.total_employer);
    t.managementFee += managementFeeOf(s.employer_contributions ?? []);
    out.set(s.unit_id, t);
  }
  return out;
}