import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import type { PayrollDayBaseLike } from "@/lib/payroll-days";
import { fetchPostingShifts, shiftKey } from "@/lib/shift-resources";
import { invoiceExtraDutyRate, isCli2989Caretaker } from "@/lib/invoice-duty-rates";
import { contractMonthlyBilling } from "@/lib/contract-rate-display";
import { invoiceCapPool, invoicePoolStrength } from "@/lib/invoice-present-cap";
import { applyRateRevisionsForPeriod } from "@/lib/rate-revisions";

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
  invoicePresentCap?: boolean;
  invoiceCapQuantity?: number;
  extraDutyBillRate?: number | null;
  extraDutyFromMonthlyBilling?: boolean;
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
  postingShift: Map<string, 8 | 10 | 12>;
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


/**
 * Contract governing a period, same rule as fetchPeriodContract: an active or
 * expired contract overlapping the period (latest start, active first, newest),
 * else the latest active contract.
 */
export function pickPeriodContract<T extends { status?: unknown; start_date?: unknown; end_date?: unknown; created_at?: unknown }>(
  contracts: T[],
  period?: { start: string; end: string } | null,
): T | null {
  const s = (v: unknown) => String(v ?? "");
  const order = (a: T, b: T) =>
    s(b.start_date).localeCompare(s(a.start_date)) ||
    s(a.status).localeCompare(s(b.status)) ||
    s(b.created_at).localeCompare(s(a.created_at));
  if (period) {
    const overlap = contracts
      .filter((c) => (c.status === "active" || c.status === "expired") && s(c.start_date) <= period.end && (!c.end_date || s(c.end_date) >= period.start))
      .sort(order);
    if (overlap[0]) return overlap[0];
  }
  return contracts.filter((c) => c.status === "active").sort(order)[0] ?? null;
}

export async function fetchUnitFinance(
  unitIds: string[],
  periods?: Map<string, { start: string; end: string }>,
): Promise<UnitFinanceMap> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  const out: UnitFinanceMap = new Map();
  if (!ids.length) return out;

  type ContractRow = { id: string; unit_id: string | null; contract_code: string | null; status: string; start_date: string | null; end_date: string | null; created_at: string | null };
  const contracts = await fetchInChunks<ContractRow>(
    ids,
    (chunk, from, to) =>
      supabase
        .from("client_contracts")
        .select("id, unit_id, contract_code, status, start_date, end_date, created_at")
        .in("unit_id", chunk)
        .eq("record_type", "client")
        .in("status", ["active", "expired"])
        .order("id")
        .range(from, to),
  );

  const byUnit = new Map<string, ContractRow[]>();
  for (const c of contracts) {
    if (!c.unit_id) continue;
    byUnit.set(c.unit_id, [...(byUnit.get(c.unit_id) ?? []), c]);
  }
  const contractByUnit = new Map<string, { id: string; code: string }>();
  for (const [unitId, list] of byUnit) {
    const c = pickPeriodContract(list, periods?.get(unitId) ?? null);
    if (c) contractByUnit.set(unitId, { id: c.id, code: c.contract_code || "—" });
  }
  if (!contractByUnit.size) return out;

  const contractIds = Array.from(contractByUnit.values()).map((c) => c.id);
  const [rawResources, designations, payrollBases, billingBases, postingShifts, units] = await Promise.all([
    fetchInChunks<Record<string, unknown>>(contractIds, (chunk, from, to) =>
      supabase
        .from("contract_resources")
        .select(
          "id, contract_id, designation_id, quantity, shift_hours, components, benefits, deductions, employer_contributions, payroll_day_base_id, billing_day_base_id, invoice_present_cap, round_off_final, round_off_totals, ot_basis, ot_hourly_rate, ot_hourly_esic",
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
    fetchInChunks<{ id: string; code: string | null }>(ids, (chunk, from, to) =>
      supabase.from("units").select("id, code").in("id", chunk).range(from, to),
    ),
  ]);
  const desigMap = new Map(designations.map((d) => [d.id as string, d.name as string]));
  const unitCodeById = new Map(units.map((u) => [u.id, u.code]));

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
  // Period rates: day-split approved rate revisions, as invoice/payroll detail apply them.
  const byPeriod = new Map<string, Record<string, unknown>[]>();
  for (const r of rawResources) {
    const p = periods?.get(unitByContract.get(String(r.contract_id)) ?? "");
    const key = p ? `${p.start}|${p.end}` : "";
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), r]);
  }
  const resources: Record<string, unknown>[] = [];
  for (const [key, list] of byPeriod) {
    const [start, end] = key.split("|");
    resources.push(...(key ? await applyRateRevisionsForPeriod(list, start, end) : list));
  }

  const grouped = new Map<string, ResourceRate[]>();
  for (const r of resources) {
    const unitId = unitByContract.get(r.contract_id as string);
    if (!unitId) continue;
    // Wage components are the single source of truth for gross. A stored
    // `gross` scalar can go stale when components are edited, so it is never
    // used: no wages configured means no payroll, only employer cost to bill.
    const grossRate = sumAmounts((r as { components?: unknown }).components);
    const deductionRate = sumAmounts((r as { deductions?: unknown }).deductions);
    const amountLines = (value: unknown): { name?: unknown; amount?: unknown }[] =>
      Array.isArray(value) ? value : [];
    const monthlyBilling = contractMonthlyBilling({
      components: amountLines(r.components),
      benefits: amountLines(r.benefits),
      employerContributions: amountLines(r.employer_contributions),
      roundOffFinal: r.round_off_final === true,
      roundOffTotals: (r.round_off_totals ?? {}) as Record<string, boolean>,
    });
    const rate: ResourceRate = {
      designationId: (r.designation_id as string) ?? null,
      designationName: (r.designation_id ? desigMap.get(r.designation_id as string) : undefined) || "Resource",
      quantity: Number(r.quantity) || 0,
      shiftHours: ([8,10,12].includes(Number(Number(r.shift_hours))) ? (Number(Number(r.shift_hours)) as 8 | 10 | 12) : 8),
      grossRate: Math.round(grossRate * 100) / 100,
      deductionRate: Math.round(deductionRate * 100) / 100,
      netRate: Math.round(Math.max(0, grossRate - deductionRate) * 100) / 100,
      billRate: monthlyBilling,
      invoicePresentCap: r.invoice_present_cap === true,
      extraDutyBillRate: invoiceExtraDutyRate(unitId, Array.isArray(r.components) ? r.components : [], {
        unitCode: unitCodeById.get(unitId),
        designationName: (r.designation_id ? desigMap.get(String(r.designation_id)) : undefined) ?? null,
        monthlyBilling,
        // Contract "custom per-hour" Extra Duty bills (ED wage + ESIC) per hour.
        hourlyEd: r.ot_basis === "hourly"
          ? { rate: r.ot_hourly_rate as number | null, esic: r.ot_hourly_esic as number | null, shiftHours: Number(r.shift_hours) || 8 }
          : null,
      }),
      extraDutyFromMonthlyBilling: isCli2989Caretaker(unitCodeById.get(unitId), r.designation_id ? desigMap.get(String(r.designation_id)) : null),
      payrollDayBase: r.payroll_day_base_id ? payrollBaseById.get(String(r.payroll_day_base_id)) ?? null : null,
      billingDayBase: r.billing_day_base_id ? billingBaseById.get(String(r.billing_day_base_id)) ?? null : null,
    };
    const arr = grouped.get(unitId) ?? [];
    arr.push(rate);
    grouped.set(unitId, arr);
  }

  for (const [unitId, rates] of grouped) {
    const contract = contractByUnit.get(unitId);
    if (!contract) continue;
    const strengths = invoicePoolStrength(rates);
    for (const rate of rates) rate.invoiceCapQuantity = strengths.get(invoiceCapPool("", rate)) ?? 0;
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
    const postingShift = new Map<string, 8 | 10 | 12>();
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
          extraDutyBillRate: rates[0].extraDutyBillRate,
          extraDutyFromMonthlyBilling: rates[0].extraDutyFromMonthlyBilling,
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
