/**
 * Dashboard invoice / payroll / profit per site, computed with the invoice
 * engine (the same calculation as the single-site invoice page), each site
 * over its own invoice period.
 */
import { computeInvoiceUnit, invoiceLineMath, invoicePartRows, invoiceUnitTaxable, loadInvoiceGlobals } from "@/lib/invoice-engine";
import { isSplit } from "@/lib/invoice-split";
import { loadInvoiceUnitsBulk, type UnitPeriod } from "@/lib/invoice-engine-bulk";
import { contractMonthlyBilling } from "@/lib/contract-rate-display";
import { loadAllFormulaMasters } from "@/lib/contract-hydrate";
import { employerCostOnly } from "@/lib/contract-billing-addons";

export type DashboardUnitFinance = {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  customer_name: string;
  internal: boolean;
  period_start: string;
  period_end: string;
  contract_value: number;
  committed_payroll: number;
  committed_strength: number;
  actual_strength: number;
  invoice_amount: number;
  payroll_cost: number;
  employer_contribution: number;
  /** Invoice amount per employee (all invoice parts; extra charges excluded). */
  invoice_by_person: Map<string, number>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function computeDashboardUnitFinance(periods: Map<string, UnitPeriod>): Promise<Map<string, DashboardUnitFinance>> {
  const out = new Map<string, DashboardUnitFinance>();
  if (!periods.size) return out;
  // Reference data loads alongside the site data (all formula masters: small tables).
  const globalsP = loadInvoiceGlobals([], null, loadAllFormulaMasters());
  const bulk = await loadInvoiceUnitsBulk(periods);
  const globals = await globalsP;
  let n = 0;
  for (const [unitId, unit] of bulk.units) {
    // Keep the page responsive while hundreds of sites are priced.
    if (++n % 40 === 0) await yieldToBrowser();
    const result = computeInvoiceUnit(unit.data, globals);
    const taxable = invoiceUnitTaxable(
      result,
      { unitId, unitCode: unit.data.unitCode, customerName: unit.customerName, invoiceSplit: unit.invoiceSplit, exactDayRate: unit.data.exactDayRate },
      unit.extras,
    ).taxable;
    const invoiceByPerson = new Map<string, number>();
    const split = unit.invoiceSplit;
    const parts = isSplit(split) ? split.parts.map((p) => p.key) : [split.parts[0]?.key ?? "main"];
    const mathCtx = { unitId, unitCode: unit.data.unitCode, customerName: unit.customerName, billingMode: result.billingMode, invoiceSplit: split, periodDates: result.periodDates, shiftHoursByDesignation: result.shiftHoursByDesignation, billingDayBaseByDesignation: result.billingDayBaseByDesignation, exactDayRate: unit.data.exactDayRate };
    if (!unit.isInternal) {
      for (const part of parts) {
        for (const row of invoicePartRows(result.rows, split, part, result.billingMode)) {
          if (!row.wages) continue;
          invoiceByPerson.set(row.id, r2((invoiceByPerson.get(row.id) ?? 0) + invoiceLineMath(row, mathCtx).actual));
        }
      }
    }
    let payroll = 0;
    let employer = 0;
    for (const row of result.rows) {
      if (!row.wages) continue;
      payroll += row.wages.earnedGross;
      // Management fee / reliever / service charges are billed margin, not cost.
      employer += employerCostOnly(row.wages.employerContributions);
    }
    let contractValue = 0;
    let committedPayroll = 0;
    let committedStrength = 0;
    for (const line of result.contractLines) {
      committedStrength += line.quantity;
      if (!line.resource) continue;
      committedPayroll += line.quantity * line.resource.components.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      if (!unit.isInternal) contractValue += line.quantity * contractMonthlyBilling(line.resource);
    }
    out.set(unitId, {
      unit_id: unitId,
      unit_code: unit.data.unitCode ?? "",
      unit_name: unit.unitName ?? "",
      customer_name: unit.customerName || "—",
      internal: unit.isInternal,
      period_start: unit.data.start,
      period_end: unit.data.end,
      contract_value: r2(contractValue),
      committed_payroll: r2(committedPayroll),
      committed_strength: committedStrength,
      actual_strength: result.rosterSize,
      invoice_amount: unit.isInternal ? 0 : taxable,
      payroll_cost: r2(payroll),
      employer_contribution: r2(employer),
      invoice_by_person: invoiceByPerson,
    });
  }
  return out;
}
