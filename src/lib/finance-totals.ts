export const FINANCE_CALCULATION_VERSION = 4;

export type FinanceTotals = {
  invoice: number;
  gross: number;
  employer: number;
};

/** Employer is actual cost only; commercial fees already included in invoice stay in profit. */
export function financeProfit(t: FinanceTotals): number {
  const cents = (n: number) => Math.round(n * 100);
  return (cents(t.invoice) - cents(t.gross) - cents(t.employer)) / 100;
}

export function financeLossReason(t: FinanceTotals, internal = false): string | null {
  if (internal) return "Internal payroll cost centre — not a client margin";
  if (financeProfit(t) >= 0) return null;
  if (t.invoice === 0) return "No billable invoice value for this period; payroll costs exist";
  if (t.gross > t.invoice) return "Earned wages exceed the invoice value";
  return "Earned wages plus actual employer costs exceed the invoice value";
}

export type SavedFinanceRow = {
  unit_id: string;
  period_start: string;
  period_end: string;
  generation: number;
  calculated_generation: number | null;
  calculation_version: number;
  computed_at: string | null;
  last_error?: string | null;
  totals: {
    unit_code: string; unit_name: string; customer_name: string; internal: boolean;
    contract_value: number; committed_payroll: number; committed_strength: number; actual_strength: number;
    invoice_amount: number; payroll_cost: number; employer_contribution: number; management_fee: number;
    employer_cost: number; billing_addons: number;
    deductions: number; net_pay: number;
    invoice_parts: { key: string; taxable: number }[];
  } | null;
};

export function financeRowIsCurrent(row: SavedFinanceRow): boolean {
  return row.totals !== null && Number.isFinite(row.totals.employer_cost) && row.computed_at !== null && row.calculation_version >= FINANCE_CALCULATION_VERSION && row.calculated_generation === row.generation;
}

/** An unavailable summary is not a zero-valued financial result. */
export function financeSummaryAmount(value: number, readyCount: number): number | null {
  return readyCount > 0 && Number.isFinite(value) ? value : null;
}

export type FinanceRosterUnit = { id: string; code: string; name: string; customer_name: string; internal?: boolean };

/** Start with the selected register roster, never the subset of refreshed money rows. */
export function dashboardFinanceRows(
  periods: Map<string, { start: string; end: string }>,
  saved: SavedFinanceRow[],
  roster: FinanceRosterUnit[],
  approved: Set<string>,
) {
  const units = new Map(roster.map(u => [u.id, u]));
  const byId = new Map(saved.filter(r => {
    const p = periods.get(r.unit_id);
    return p?.start === r.period_start && p.end === r.period_end;
  }).map(r => [r.unit_id, r]));
  return [...periods].map(([id, p]) => {
    const row = byId.get(id), unit = units.get(id);
    const current = row ? financeRowIsCurrent(row) : false;
    const t = current ? row?.totals : null;
    const totals_status = current ? "ready" as const : row?.last_error ? "failed" as const : "pending" as const;
    const employer = t?.employer_cost ?? 0;
    const money = { invoice: t?.invoice_amount ?? 0, gross: t?.payroll_cost ?? 0, employer };
    const profit = current ? financeProfit(money) : 0;
    return {
      unit_id: id, period_start: p.start, period_end: p.end,
      unit_code: unit?.code ?? t?.unit_code ?? "", unit_name: unit?.name ?? t?.unit_name ?? "",
      customer_name: unit?.customer_name ?? t?.customer_name ?? "", internal: unit?.internal ?? t?.internal ?? false,
      contract_value: t?.contract_value ?? 0, committed_payroll: t?.committed_payroll ?? 0,
      committed_strength: t?.committed_strength ?? 0, actual_strength: t?.actual_strength ?? 0,
      invoice_amount: money.invoice, payroll_cost: money.gross, employer_contribution: employer,
      management_fee: t?.management_fee ?? 0, billing_addons: t?.billing_addons ?? 0,
      deductions: t?.deductions ?? 0, net_pay: t?.net_pay ?? 0, invoice_parts: t?.invoice_parts ?? [],
      variance: profit, variance_pct: money.invoice > 0 ? profit / money.invoice * 100 : 0,
      attendance_approved: approved.has(id), totals_status,
      loss_reason: current ? financeLossReason(money, t?.internal) : null,
    };
  });
}
/** Saved, current totals for the register; every other site of the roster is stale and must be computed live. */
export function splitSavedRegisterTotals(
  periods: Map<string, { start: string; end: string }>,
  saved: SavedFinanceRow[],
) {
  const ready = new Map<string, ReturnType<typeof dashboardFinanceRows>[number]>();
  const stale: string[] = [];
  /** Stale sites whose last server recompute failed (a subset of `stale`). */
  const failed: string[] = [];
  for (const row of dashboardFinanceRows(periods, saved, [], new Set())) {
    if (row.totals_status === "ready") ready.set(row.unit_id, row);
    else {
      stale.push(row.unit_id);
      if (row.totals_status === "failed") failed.push(row.unit_id);
    }
  }
  return { ready, stale, failed };
}

export type RegisterSavedMoney = { invoice_amount: number; payroll_cost: number; deductions: number; net_pay: number; employer_contribution: number };
export type RegisterLiveMoney = {
  engine: Map<string, { invoice_amount: number }>;
  pay: Map<string, { gross: number; deductions: number; net: number; employer: number }>;
};
export type RegisterMoney = {
  invoiceAmount: number; payrollAmount: number; deductionAmount: number; netPayrollAmount: number; employerCost: number;
  source: "saved" | "live";
};

/**
 * One register row's money: the saved current total when there is one, else the
 * live engine results once that site's live batch has finished. Null = no value:
 * still updating, or the live batch finished without an invoice AND a payroll
 * result for this site (unavailable — never shown or summed as ₹0, the same rule
 * as financeSummaryAmount). Field-for-field the precedence the register has always used.
 */
export function registerMoney(unitId: string, saved: RegisterSavedMoney | null | undefined, live: RegisterLiveMoney | null | undefined): RegisterMoney | null {
  if (!saved && !live) return null;
  const engine = live?.engine.get(unitId);
  const pay = live?.pay.get(unitId);
  if (!saved && (!engine || !pay)) return null;
  return {
    invoiceAmount: saved?.invoice_amount ?? (engine ? engine.invoice_amount : 0),
    payrollAmount: saved?.payroll_cost ?? pay?.gross ?? 0,
    deductionAmount: saved?.deductions ?? pay?.deductions ?? 0,
    netPayrollAmount: saved?.net_pay ?? pay?.net ?? 0,
    // Same actual-cost separation as the dashboard; billing add-ons stay inside revenue.
    employerCost: saved?.employer_contribution ?? pay?.employer ?? 0,
    source: saved ? "saved" : "live",
  };
}
