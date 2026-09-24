import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import type { PayrollDayBaseLike } from "@/lib/payroll-days";
import { fetchPostingShifts, shiftKey } from "@/lib/shift-resources";

/**
 * Contract-level money for the Invoice / Payroll charters.
 *
 * Per contract resource line (unit x designation) we derive two per-head
 * monthly rates:
 *  - `billRate`   -> what the client is charged (wages + employer cost lines)
 *  - `grossRate`  -> the employee's monthly gross (payroll side)
 *
 * The charters pro-rate these by actual paid days (plus overtime days) so the
 * month-till-date invoice and payroll values track attendance exactly. Full
 * statutory computation lives on the per-unit invoice / payroll registers.
 */

export type ResourceRate = {
  designationId: string | null;
  designationName: string;
  quantity: number;
  shiftHours: number;
  /** Divisor rules that turn the monthly value into the invoice's per-duty rate. */
  payrollDayBase: PayrollDayBaseLike | null;
  billingDayBase: PayrollDayBaseLike | null;
  /** Monthly gross = sum of the wage components. Never a stored scalar. */
  grossRate: number;
  /** Contract-level statutory / recurring employee deductions per month. */
  deductionRate: number;
  /** Take-home payroll = gross − deductions. */
  netRate: number;
  /** What the client is billed = gross + employer cost lines. */
  billRate: number;
};

export type UnitFinance = {
  unitId: string;
  contractId: string;
  contractCode: string;
  committed: number;
  monthlyContracted: number;
  monthlyPayroll: number;
  monthlyDeductions: number;
  monthlyNetPayroll: number;
  rates: ResourceRate[];
  byDesignation: Map<string, ResourceRate>;
  /** `${designationId}|8|12` -> rate, for contracts with both duty lengths. */
  byDesignationShift: Map<string, ResourceRate>;
  /** candidate_id -> duty length set on their posting at this unit. */
  postingShift: Map<string, 8 | 12>;
  /** Weighted average rate, used when an employee's designation is not on the contract. */
  fallback: ResourceRate | null;
};

export type UnitFinanceMap = Map<string, UnitFinance>;

function sumAmounts(list: unknown): number {
  if (!Array.isArray(list)) return 0;
  return list.reduce((s, item) => {
    const amount = Number((item as { amount?: unknown } | null)?.amount);
    return s + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}


export async function fetchUnitFinance(unitIds: string[]): Promise<UnitFinanceMap> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const out: UnitFinanceMap = new Map();
  if (!ids.length) return out;

  const contracts = await fetchInChunks<{ id: string; unit_id: string | null; contract_code: string | null }>(
    ids,
    (chunk, from, to) =>
      supabase
        .from("client_contracts")
        .select("id, unit_id, contract_code, status, start_date")
        .in("unit_id", chunk)
        .eq("status", "active")
        .range(from, to),
  );

  const contractByUnit = new Map<string, { id: string; code: string }>();
  for (const c of contracts) {
    if (!c.unit_id) continue;
    if (!contractByUnit.has(c.unit_id)) {
      contractByUnit.set(c.unit_id, { id: c.id as string, code: (c.contract_code as string) || "—" });
    }
  }
  if (!contractByUnit.size) return out;

  const contractIds = Array.from(contractByUnit.values()).map((c) => c.id);
  const [resources, designations, payrollBases, billingBases, postingShifts] = await Promise.all([
    fetchInChunks<Record<string, unknown>>(contractIds, (chunk, from, to) =>
      supabase
        .from("contract_resources")
        .select(
          "contract_id, designation_id, quantity, shift_hours, components, deductions, employer_contributions, payroll_day_base_id, billing_day_base_id",
        )
        .in("contract_id", chunk)
        .range(from, to),
    ),
    fetchAllPages<{ id: string; name: string }>((from, to) =>
      supabase.from("designations").select("id, name").range(from, to),
    ),
    supabase.from("payroll_day_bases").select("id, method, fixed_days, weekly_off_day, included_weekdays"),
    supabase
      .from("billing_day_bases" as never)
      .select("id, method, fixed_days, weekly_off_day, included_weekdays"),
    fetchPostingShifts(Array.from(contractByUnit.keys())),
  ]);
  const desigMap = new Map(designations.map((d) => [d.id as string, d.name as string]));

  // The per-duty billing rate the invoice prints is the monthly value divided by
  // the resource's billing-days rule (falling back to its payroll-days rule).
  const toBase = (row: Record<string, unknown>): PayrollDayBaseLike => ({
    method: row.method as PayrollDayBaseLike["method"],
    fixedDays: row.fixed_days == null ? null : Number(row.fixed_days),
    weeklyOffDay: row.weekly_off_day == null ? null : Number(row.weekly_off_day),
    includedWeekdays: Array.isArray(row.included_weekdays)
      ? (row.included_weekdays as unknown[]).map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
      : null,
  });
  const baseIndex = (rows: unknown) =>
    new Map<string, PayrollDayBaseLike>(
      (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((row) => [String(row.id), toBase(row)]),
    );
  const payrollBaseById = baseIndex((payrollBases as { data?: unknown }).data);
  const billingBaseById = baseIndex((billingBases as { data?: unknown }).data);

  const unitByContract = new Map<string, string>();
  for (const [unitId, c] of contractByUnit) unitByContract.set(c.id, unitId);

  const grouped = new Map<string, ResourceRate[]>();
  for (const r of resources) {
    const unitId = unitByContract.get(r.contract_id as string);
    if (!unitId) continue;
    // Wage components are the single source of truth for gross. A stored
    // `gross` scalar can go stale when components are edited, so it is never
    // used: no wages configured means no payroll, only employer cost to bill.
    const grossRate = sumAmounts((r as { components?: unknown }).components);
    const deductionRate = sumAmounts((r as { deductions?: unknown }).deductions);
    const employerTotal = sumAmounts((r as { employer_contributions?: unknown }).employer_contributions);
    const rate: ResourceRate = {
      designationId: (r.designation_id as string) ?? null,
      designationName: (r.designation_id ? desigMap.get(r.designation_id as string) : undefined) || "Resource",
      quantity: Number(r.quantity) || 0,
      shiftHours: Number(r.shift_hours) === 12 ? 12 : 8,
      grossRate: Math.round(grossRate * 100) / 100,
      deductionRate: Math.round(deductionRate * 100) / 100,
      netRate: Math.round(Math.max(0, grossRate - deductionRate) * 100) / 100,
      billRate: Math.round((grossRate + employerTotal) * 100) / 100,
      payrollDayBase: r.payroll_day_base_id ? payrollBaseById.get(String(r.payroll_day_base_id)) ?? null : null,
      billingDayBase: r.billing_day_base_id ? billingBaseById.get(String(r.billing_day_base_id)) ?? null : null,
    };
    const arr = grouped.get(unitId) ?? [];
    arr.push(rate);
    grouped.set(unitId, arr);
  }

  for (const [unitId, rates] of grouped) {
    const contract = contractByUnit.get(unitId)!;
    const committed = rates.reduce((s, r) => s + r.quantity, 0);
    const monthlyContracted = rates.reduce((s, r) => s + r.quantity * r.billRate, 0);
    const monthlyPayroll = rates.reduce((s, r) => s + r.quantity * r.grossRate, 0);
    const monthlyDeductions = rates.reduce((s, r) => s + r.quantity * r.deductionRate, 0);
    const byDesignation = new Map<string, ResourceRate>();
    const byDesignationShift = new Map<string, ResourceRate>();
    for (const r of rates) {
      if (!r.designationId) continue;
      if (!byDesignation.has(r.designationId)) byDesignation.set(r.designationId, r);
      byDesignationShift.set(shiftKey(r.designationId, r.shiftHours), r);
    }
    const postingShift = new Map<string, 8 | 12>();
    for (const [k, v] of postingShifts) {
      const [u, cid] = k.split("|");
      if (u === unitId) postingShift.set(cid, v);
    }
    const fallback: ResourceRate | null = rates.length
      ? {
          designationId: null,
          designationName: "Blended",
          quantity: committed,
          shiftHours: rates[0].shiftHours,
          grossRate: committed > 0 ? monthlyPayroll / committed : rates[0].grossRate,
          deductionRate: committed > 0 ? monthlyDeductions / committed : rates[0].deductionRate,
          netRate:
            committed > 0
              ? Math.max(0, (monthlyPayroll - monthlyDeductions) / committed)
              : rates[0].netRate,
          billRate: committed > 0 ? monthlyContracted / committed : rates[0].billRate,
          payrollDayBase: rates[0].payrollDayBase,
          billingDayBase: rates[0].billingDayBase,
        }
      : null;

    out.set(unitId, {
      unitId,
      contractId: contract.id,
      contractCode: contract.code,
      committed,
      monthlyContracted: Math.round(monthlyContracted * 100) / 100,
      monthlyPayroll: Math.round(monthlyPayroll * 100) / 100,
      monthlyDeductions: Math.round(monthlyDeductions * 100) / 100,
      monthlyNetPayroll: Math.round(Math.max(0, monthlyPayroll - monthlyDeductions) * 100) / 100,
      rates: rates.sort((a, b) => a.designationName.localeCompare(b.designationName)),
      byDesignation,
      byDesignationShift,
      postingShift,
      fallback,
    });
  }


  return out;
}

export function rateFor(
  finance: UnitFinance | undefined,
  designationId: string | null,
  candidateId?: string | null,
  lineShift?: number | null,
): ResourceRate | null {
  if (!finance) return null;
  if (designationId && lineShift) {
    const own = finance.byDesignationShift.get(shiftKey(designationId, lineShift));
    if (own) return own;
  }
  if (designationId && candidateId) {
    const shift = finance.postingShift.get(candidateId);
    const byShift = shift ? finance.byDesignationShift.get(shiftKey(designationId, shift)) : undefined;
    if (byShift) return byShift;
  }
  if (designationId) {
    const exact = finance.byDesignation.get(designationId);
    if (exact) return exact;
  }
  return finance.fallback;
}

export function fmtMoney(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function fmtMoneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}
