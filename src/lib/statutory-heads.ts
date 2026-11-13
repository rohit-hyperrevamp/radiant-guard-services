/** Classification only: never changes contract formulas, raw names or amounts. */
export type StatutoryHead = "pt" | "epf" | "lwf" | "levy" | "esic" | "gpaip" | "wc";
export type LedgerScope = "posted" | "pending" | "all";
export function statutoryHead(name: string | null | undefined): StatutoryHead | null {
  const n = (name ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (/\bpt\b|\bp t\b|\bprofession(?:al)?\s+(?:tax|taxes)\b/.test(n)) return "pt";
  if (/\b(?:epf|epfo|pf)\b|\be p f\b|\bp f\b|\bprovident\s+fund\b/.test(n)) return "epf";
  if (/\b(?:esic|esi)\b|\be s i(?: c)?\b|\bemployees?\s+state\s+insurance\b/.test(n)) return "esic";
  if (/\blwf\b|\bl w f\b|\blabou?r\s+welfare(?:\s+fund)?\b/.test(n)) return "lwf";
  if (/\b(?:sgb|msgb)\b|\b(?:security\s+)?guards?\s+board\b/.test(n)) return "levy";
  if (/\bgpaip\b|\b(?:group\s+)?personal\s+accident\b/.test(n)) return "gpaip";
  if (/\bwc\b|\bw c\b|\bworkm[ae]ns?\s+compensation\b|\bworkers?\s+compensation\b/.test(n))
    return "wc";
  return null;
}
export function ledgerStage(row: {
  status?: string | null;
  source_kind?: string | null;
}): "posted" | "pending" | "cancelled" {
  const status = (row.status ?? "").toLowerCase();
  if (["cancelled", "canceled", "void", "deleted"].includes(status)) return "cancelled";
  return ["completed", "processed", "paid"].includes(status) ? "posted" : "pending";
}
export function inLedgerScope(row: { status?: string | null }, scope: LedgerScope): boolean {
  const stage = ledgerStage(row);
  return stage !== "cancelled" && (scope === "all" || stage === scope);
}
export function ledgerAmount(row: {
  amount?: number | null;
  computed_amount?: number | null;
}): number {
  return Number(row.computed_amount ?? row.amount ?? 0);
}
export function payrollReferenceId(row: {
  payroll_run_id?: string | null;
  source_kind?: string | null;
  source_ref?: string | null;
}): string | null {
  if (row.payroll_run_id) return row.payroll_run_id;
  if (!["payroll_run", "payroll_amendment"].includes(row.source_kind ?? "")) return null;
  return (
    row.source_ref?.match(
      /^payroll_run:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::v\d+)?$/i,
    )?.[1] ?? null
  );
}
export function originalUnitId(
  row: {
    unit_id?: string | null;
    payroll_run_id?: string | null;
    source_kind?: string | null;
    source_ref?: string | null;
  },
  runs: Map<string, string | null>,
): string | null {
  const run = payrollReferenceId(row);
  return row.unit_id || (run ? runs.get(run) : null) || null;
}
export function complianceMoney(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
