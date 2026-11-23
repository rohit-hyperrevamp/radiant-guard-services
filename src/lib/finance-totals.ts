export const FINANCE_CALCULATION_VERSION = 1;

export type FinanceTotals = {
  invoice: number;
  gross: number;
  employer: number;
  managementFee: number;
};

/** Employer display includes every line; management fee alone is retained as profit. */
export function financeProfit(t: FinanceTotals): number {
  const cents = (n: number) => Math.round(n * 100);
  return (cents(t.invoice) - cents(t.gross) - cents(t.employer) + cents(t.managementFee)) / 100;
}

export function financeLossReason(t: FinanceTotals, internal = false): string | null {
  if (internal) return "Internal payroll cost centre — not a client margin";
  if (financeProfit(t) >= 0) return null;
  if (t.invoice === 0) return "No billable invoice value for this period; payroll costs exist";
  if (t.gross > t.invoice) return "Earned wages exceed the invoice value";
  return "Earned wages plus employer costs, excluding management fee, exceed the invoice value";
}

export type SavedFinanceRow = {
  unit_id: string;
  period_start: string;
  period_end: string;
  generation: number;
  calculated_generation: number | null;
  calculation_version: number;
  computed_at: string | null;
  totals: {
    unit_code: string; unit_name: string; customer_name: string; internal: boolean;
    contract_value: number; committed_payroll: number; committed_strength: number; actual_strength: number;
    invoice_amount: number; payroll_cost: number; employer_contribution: number; management_fee: number;
    deductions: number; net_pay: number;
    invoice_parts: { key: string; taxable: number }[];
  } | null;
};

export function financeRowIsCurrent(row: SavedFinanceRow): boolean {
  return row.totals !== null && row.computed_at !== null && row.calculation_version === FINANCE_CALCULATION_VERSION && row.calculated_generation === row.generation;
}