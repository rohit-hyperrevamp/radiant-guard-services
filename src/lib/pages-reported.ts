import { supabase } from "@/integrations/supabase/client";
import type { WageComputation, WageComponent } from "@/lib/payroll-calc";

// ---------------------------------------------------------------------------
// Pages-reported figures: what Pages actually paid (wage register) and billed
// (tax invoice PDF) for a site + period. When present, payroll and invoice
// screens show these numbers instead of the live calculation, labelled
// "As per Pages". No calculation rule is changed — remove the rows to go back.
// ---------------------------------------------------------------------------

export type PagesReportedPayroll = {
  employee_code: string;
  employee_name: string | null;
  designation_name: string | null;
  duties: number;
  ot_duties: number;
  gross: number;
  total_deductions: number;
  net_pay: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
};

export type PagesReportedInvoice = {
  pdf_label: string | null;
  pdf_duties: number | null;
  taxable_value: number;
};

const norm = (code: string | null | undefined) => String(code ?? "").trim().toUpperCase();

export async function fetchPagesReportedPayroll(unitId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("pages_reported_payroll" as never)
    .select("employee_code, employee_name, designation_name, duties, ot_duties, gross, total_deductions, net_pay, earnings, deductions")
    .eq("unit_id", unitId)
    .eq("period_start", start)
    .eq("period_end", end);
  if (error) throw error;
  const out = new Map<string, PagesReportedPayroll>();
  for (const r of (data ?? []) as unknown as PagesReportedPayroll[]) out.set(norm(r.employee_code), r);
  return out;
}

export async function fetchPagesReportedInvoice(unitId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from("pages_reported_invoices" as never)
    .select("pdf_label, pdf_duties, taxable_value")
    .eq("unit_id", unitId)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PagesReportedInvoice | null) ?? null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const asItems = (list: { name: string; amount: number }[]): WageComponent[] =>
  (list ?? []).map((i) => ({ name: i.name, amount: Number(i.amount) || 0 }));

type RowLike = {
  employeeCode: string;
  isPrimary: boolean;
  wages: WageComputation | null;
};

/**
 * Puts each employee's Pages figure on one line (primary first) and folds the
 * person's other lines at this site into it, so site totals equal Pages.
 * Returns how many employees were taken from Pages.
 */
export function applyPagesReportedPayroll<T extends RowLike>(rows: T[], figures: Map<string, PagesReportedPayroll>): number {
  if (figures.size === 0) return 0;
  const byCode = new Map<string, T[]>();
  for (const r of rows) {
    const k = norm(r.employeeCode);
    if (!figures.has(k)) continue;
    const list = byCode.get(k) ?? [];
    list.push(r);
    byCode.set(k, list);
  }
  let applied = 0;
  for (const [code, list] of byCode) {
    const fig = figures.get(code)!;
    const carrier = list.find((r) => r.isPrimary && r.wages) ?? list.find((r) => r.wages) ?? list[0];
    for (const r of list) {
      const base = r.wages;
      const employer = r === carrier ? base?.employerContributions ?? [] : [];
      const totalEmployer = r2(employer.reduce((s, c) => s + (Number(c.amount) || 0), 0));
      const gross = r === carrier ? Number(fig.gross) || 0 : 0;
      const totalDeductions = r === carrier ? Number(fig.total_deductions) || 0 : 0;
      const wages: WageComputation = {
        contractGross: base?.contractGross ?? 0,
        perDayRate: base?.perDayRate ?? 0,
        baseDays: base?.baseDays ?? 0,
        ratio: base?.ratio ?? 0,
        otBaseAmount: base?.otBaseAmount ?? 0,
        perDutyOtAmount: base?.perDutyOtAmount ?? 0,
        otDuties: base?.otDuties ?? 0,
        totalOtAmount: 0,
        earnedGross: gross,
        components: r === carrier ? asItems(fig.earnings) : [],
        benefits: [],
        deductions: r === carrier ? asItems(fig.deductions) : [],
        employerContributions: employer,
        totalDeductions,
        totalEmployerContributions: totalEmployer,
        netPay: r === carrier ? Number(fig.net_pay) || 0 : 0,
        employerCost: r2(gross + totalEmployer),
      };
      (wages as unknown as { additions: unknown[] }).additions = [];
      r.wages = wages;
      (r as unknown as { pagesReported: "main" | "merged" }).pagesReported = r === carrier ? "main" : "merged";
    }
    applied++;
  }
  return applied;
}
