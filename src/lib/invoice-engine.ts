/**
 * Invoice engine: the exact per-site invoice calculation used by the invoice
 * detail page, split into (1) loading the site's period data and (2) a pure,
 * synchronous computation. The dashboard loads many sites in bulk and runs the
 * SAME computation, so the dashboard invoice figure can never drift from the
 * invoice page again.
 */
import { allocateInvoicePresent, invoiceCapPool, invoicePresentLimit, invoicePoolStrength } from "@/lib/invoice-present-cap";
import { resolveContractDesignation } from "@/lib/designation-match";
import { mergePayItems } from "@/lib/pay-item-names";
import { roundDutyDays } from "@/lib/duty-days";
import { fetchPeriodContract } from "@/lib/period-contract";
import { fetchAttendedCandidateIds } from "@/lib/period-roster";
import { supabase } from "@/integrations/supabase/client";
import {
  applyEpfBreakdownToWageComputation,
  applyEmployeeAdditions,
  applyLwfToWageComputation,
  applyPtToWageComputation,
  computeAttendanceTotals,
  computeWages,
  resolvePtAmount,
  type AttendanceCodeLike,
  type AttendanceEntryLike,
  type ContractResourceLike,
  type PincodeRangeLike,
  type PtSlabLike,
  normalizeOtEsi,
} from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { exactDayRateFor, invoiceExtraDutyRate, invoiceDutyBillingLines, showsHourlyEdAsDays, isCli2989Caretaker, splitInvoiceDuties } from "@/lib/invoice-duty-rates";
import { fetchAttendanceEntriesForPeriod, type AttendanceEntryFetchRow } from "@/lib/attendance-fetch";
import { normShift, shiftKey } from "@/lib/shift-resources";
import { applyRateRevisionsWith, fetchRevisions, rateSegmentsWith, type RateRevisionRow } from "@/lib/rate-revisions";
import { formulaMasterIds, hydrateFormulasWith, type FormulaMaster } from "@/lib/contract-hydrate";
import { refreshBillingAddOns } from "@/lib/contract-billing-addons";
import { resolvePayrollDayCount } from "@/lib/payroll-days";
import { holidayMapForDates, type PublicHoliday } from "@/lib/public-holidays";
import { isSplit, totalsForPart, type InvoiceSplit } from "@/lib/invoice-split";
import { contractMonthlyBilling } from "@/lib/contract-rate-display";

export type InvoiceBillingMode = "man_days" | "man_hours" | "man_months" | "lumpsum";
type Row = Record<string, unknown>;
type DayBase = NonNullable<ContractResourceLike["payrollDayBase"]>;
type PdbMethod = "actual_days" | "fixed_days" | "actual_minus_weekly_off" | "custom_weekdays" | "fixed_annual_average" | "actual_minus_days";

export type InvoiceCandidate = {
  id: string;
  employee_code: string | null;
  full_name: string | null;
  designation_id: string | null;
  gender?: string | null;
  is_disabled?: boolean | null;
  preferred_joining_date?: string | null;
};
export const INVOICE_CANDIDATE_COLS = "id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date";

export type InvoiceUnitPh = {
  enabled: boolean;
  multiplier: number;
  excluded: string[];
  excludedDays: string[];
  dayValue: number | null;
};

export type RawAddition = { candidate_id: string; addition_type_id?: string | null; addition_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; repeat_monthly?: boolean | null; prorate_by_days?: boolean | null; counts_for_pf?: boolean | null; counts_for_esi?: boolean | null; formula_expression?: string | null; per_day_amount?: number | string | null; addition_date?: string | null; end_date?: string | null; unit_id?: string | null; status?: string | null };
export type RawDeduction = { candidate_id: string; deduction_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; deduction_date?: string | null; unit_id?: string | null; status?: string | null };

export const ADDITION_COLS = "candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi, formula_expression, per_day_amount";
export const DEDUCTION_COLS = "candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for";
export const RESOURCE_COLS = "id, designation_id, quantity, components, benefits, deductions, employer_contributions, payroll_day_base_id, billing_day_base_id, invoice_present_cap, shift_hours, ot_multiplier, ot_basis, ot_formula, ot_esi, ot_hourly_rate, ot_hourly_esic, round_off_final, round_off_totals";

/** Everything one site's invoice needs for one period. */
export type InvoiceUnitData = {
  unitId: string;
  start: string;
  end: string;
  unitCode: string | null;
  customerName: string | null;
  epfCapEnabled: boolean;
  ptState: string | null;
  ptPincode: string | null;
  unitPh: InvoiceUnitPh | null;
  woAsPresent: boolean;
  exactDayRate: boolean;
  primary: InvoiceCandidate[];
  links: { candidate_id: string; shift_hours?: number | null }[];
  secondary: InvoiceCandidate[];
  /** Attended, still eligible, not already on the roster (leavers / disabled since). */
  leavers: InvoiceCandidate[];
  entries: AttendanceEntryFetchRow[];
  periodContract: Row | null;
  billingMode: InvoiceBillingMode;
  /** Raw contract_resources rows of the period contract. */
  resources: Row[];
  revisions: RateRevisionRow[] | null;
  additions: RawAddition[];
  deductions: RawDeduction[];
};

/** Reference data shared by every site. */
export type InvoiceGlobals = {
  codes: AttendanceCodeLike[];
  pdbs: Row[];
  bdbs: Row[];
  designationNames: Map<string, string>;
  masters: Map<string, FormulaMaster>;
  publicHolidays: PublicHoliday[];
  phTypeIds: Set<string>;
  ptSlabs: PtSlabLike[];
  pincodeRanges: PincodeRangeLike[];
  lwfRows: LwfRow[];
};

// Ledger names for one-off additions/deductions are stored as
// "<code> - <name> - <date>". Only the middle "<name>" segment is user-facing.
function cleanLedgerName(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 3) return parts[1].trim() || s;
  return s;
}

/** Dated rates store wages only; Extra Duty settings always come from the contract line. */
function contractOtFields(r: Row): Row {
  const out: Row = {};
  for (const k of ["ot_basis", "ot_formula", "ot_multiplier", "ot_hourly_rate", "ot_hourly_esic", "ot_esi"]) if (k in r) out[k] = r[k];
  return out;
}

export function invoicePeriodDates(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const cursor = new Date(ys, ms - 1, ds);
  const stop = new Date(ye, me - 1, de);
  while (cursor <= stop) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function billingModeFromCode(code: string | null | undefined): InvoiceBillingMode {
  return code === "man_hours" || code === "man_months" || code === "lumpsum" ? code : "man_days";
}

export function unitPhFromRow(row: { ph_enabled?: boolean | null; ph_multiplier?: number | null; ph_day_value?: number | string | null; ph_excluded_candidate_ids?: string[] | null; ph_excluded_days?: string[] | null } | null): InvoiceUnitPh {
  const dv = row?.ph_day_value;
  return {
    enabled: Boolean(row?.ph_enabled),
    multiplier: Number(row?.ph_multiplier ?? 1) || 1,
    excluded: (row?.ph_excluded_candidate_ids ?? []).map(String),
    excludedDays: (row?.ph_excluded_days ?? []).map(String),
    // PH off for this client → PH marks count 0 days.
    dayValue: !row?.ph_enabled ? 0 : dv == null || Number.isNaN(Number(dv)) ? null : Number(dv),
  };
}

const toBase = (p: Row): DayBase => ({
  method: p.method as PdbMethod,
  fixedDays: p.fixed_days == null ? null : Number(p.fixed_days),
  weeklyOffDay: p.weekly_off_day == null ? null : Number(p.weekly_off_day),
  includedWeekdays: Array.isArray(p.included_weekdays)
    ? (p.included_weekdays as unknown[]).map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
    : null,
});

/**
 * Pure invoice computation for one site and period — the invoice page's
 * line build (roster, attendance, PH, additions, rate windows, Present cap).
 */
export function computeInvoiceUnit(src: InvoiceUnitData, g: InvoiceGlobals) {
  const { unitId, start, end } = src;
  const periodDates = invoicePeriodDates(start, end);
  const unitPh = src.unitPh;
  const phConfig = (() => {
    if (!unitPh?.enabled) return null;
    const map = holidayMapForDates(periodDates, g.publicHolidays);
    if (map.size === 0) return null;
    return { dates: Array.from(map.keys()), multiplier: unitPh.multiplier };
  })();
  const woAsPresent = src.woAsPresent;
  const epfCapEnabled = src.epfCapEnabled;
  const ptState = src.ptState;
  const ptPincode = src.ptPincode;
  const ptSlabs = g.ptSlabs;
  const pincodeRanges = g.pincodeRanges;
  const lwfRows = g.lwfRows;

  const roster: InvoiceCandidate[] = Array.from(
    new Map([...src.primary, ...src.secondary].map((c) => [c.id, c])).values(),
  );
  {
    const have = new Set(roster.map((c) => c.id));
    roster.push(...src.leavers.filter((c) => !have.has(c.id)));
  }
  const links = src.links;
  const desigMap = g.designationNames;
  const designationIds = Array.from(new Set(roster.map((c) => c.designation_id).filter(Boolean))) as string[];
  void designationIds;

  const entries = src.entries.map((e) => ({ ...e })) as Array<AttendanceEntryFetchRow>;
  const codes = g.codes;
  const periodContract = src.periodContract;
  const contractId = periodContract ? (periodContract.id as string | undefined) : undefined;
  const billingMode = src.billingMode;

  let resources: Row[] = [];
  let rawSegments = new Map<string, { from: string; to: string; values: Row }[]>();
  if (contractId) {
    resources = src.resources;
    rawSegments = rateSegmentsWith(resources, src.revisions, start, end);
    resources = applyRateRevisionsWith(resources, src.revisions, start, end);
  }

  // Per-employee Additions & Deductions in the invoice window (same as payroll).
  const candidateIds = roster.map((c) => c.id);
  type PerEmpItem = { name: string; amount: number; prorate?: boolean; countsForPf?: boolean; countsForEsi?: boolean; formula?: string | null; inputs?: { amount?: number; days?: number; per_day?: number } };
  type DayAdj = { pDays: number; otDays: number; phDays: number; otherPaidDays: number; tDays: number };
  const additionsByCandidate = new Map<string, PerEmpItem[]>();
  const deductionsByCandidate = new Map<string, PerEmpItem[]>();
  const dayAdjustmentByCandidate = new Map<string, DayAdj>();
  const phDisplayCountByCandidate = new Map<string, number>();
  const phCashByCandidate = new Map<string, number>();
  if (candidateIds.length > 0) {
    const phTypeIds = g.phTypeIds;
    const applyDayAdj = (cid: string, dayDelta: number, buckets: string[] | null | undefined, sign: 1 | -1) => {
      if (!dayDelta) return;
      const prev = dayAdjustmentByCandidate.get(cid) ?? { pDays: 0, otDays: 0, phDays: 0, otherPaidDays: 0, tDays: 0 };
      const list = (buckets ?? []).filter(Boolean);
      if (list.length === 0) list.push("present");
      for (const b of list) {
        if (b === "present" || b === "worked") prev.pDays += sign * dayDelta;
        else if (b === "ot") prev.otDays += sign * dayDelta;
        else if (b === "ph") prev.phDays += sign * dayDelta;
        else prev.otherPaidDays += sign * dayDelta;
      }
      // Only P / ED / PH buckets add to total PAID days.
      const paidBuckets = list.filter((b) => b === "present" || b === "worked" || b === "ot" || b === "ph").length;
      prev.tDays += sign * dayDelta * paidBuckets;
      dayAdjustmentByCandidate.set(cid, prev);
    };
    const SYSTEM_COMPUTED_BUCKETS = new Set(["ph", "ot"]);
    const isSystemComputedDayAdj = (entryMode: string | null | undefined, includeInTotal: boolean | null | undefined, buckets: string[] | null | undefined) =>
      entryMode === "days_x_per_day"
      && !!includeInTotal
      && Array.isArray(buckets)
      && buckets.length > 0
      && buckets.every((b) => SYSTEM_COMPUTED_BUCKETS.has(b));

    for (const a of src.additions) {
      const inst = Math.max(1, Number(a.installments) || 1);
      const amt = (Number(a.amount) || 0) / inst;
      const isPhType = !!(a.addition_type_id && phTypeIds.has(String(a.addition_type_id)));
      if (isPhType) {
        phCashByCandidate.set(a.candidate_id, (phCashByCandidate.get(a.candidate_id) ?? 0) + amt);
        const phDelta = Math.max(1, Number(a.days) || 1);
        phDisplayCountByCandidate.set(a.candidate_id, (phDisplayCountByCandidate.get(a.candidate_id) ?? 0) + phDelta);
        continue;
      }
      const isDayAdj = isSystemComputedDayAdj(a.entry_mode, a.include_in_total_days, a.affects_days_for);
      if (!isDayAdj) {
        const arr = additionsByCandidate.get(a.candidate_id) ?? [];
        arr.push({
          name: cleanLedgerName(a.addition_name),
          amount: Math.round((a.repeat_monthly ? Number(a.amount) || 0 : amt) * 100) / 100,
          prorate: !!a.prorate_by_days,
          countsForPf: !!a.counts_for_pf,
          countsForEsi: a.counts_for_esi !== false,
          formula: a.formula_expression ?? null,
          inputs: { amount: Number(a.amount) || 0, days: Number(a.days) || 0, per_day: Number(a.per_day_amount) || 0 },
        });
        additionsByCandidate.set(a.candidate_id, arr);
      }
      if (a.entry_mode === "days_x_per_day" && a.include_in_total_days) {
        applyDayAdj(a.candidate_id, Number(a.days) || 0, a.affects_days_for, +1);
      }
    }
    for (const d of src.deductions) {
      const inst = Math.max(1, Number(d.installments) || 1);
      const amt = (Number(d.amount) || 0) / inst;
      const isDayAdj = isSystemComputedDayAdj(d.entry_mode, d.include_in_total_days, d.affects_days_for);
      if (!isDayAdj) {
        const arr = deductionsByCandidate.get(d.candidate_id) ?? [];
        arr.push({ name: cleanLedgerName(d.deduction_name), amount: Math.round(amt * 100) / 100 });
        deductionsByCandidate.set(d.candidate_id, arr);
      }
      if (d.entry_mode === "days_x_per_day" && d.include_in_total_days) {
        applyDayAdj(d.candidate_id, Number(d.days) || 0, d.affects_days_for, -1);
      }
    }
  }

  // Entries missing a designation roll into the candidate's primary designation.
  const primaryDesigByCandidate = new Map(roster.map((c) => [c.id, c.designation_id ?? null] as const));
  for (const e of entries) {
    if (!e.designation_id) {
      const primary = primaryDesigByCandidate.get(e.candidate_id) ?? null;
      if (primary) e.designation_id = primary;
    }
  }

  const pdbMap = new Map<string, DayBase>(g.pdbs.map((p) => [String(p.id), toBase(p)]));
  const bdbMap = new Map<string, DayBase>(g.bdbs.map((p) => [String(p.id), toBase(p)]));
  const billingDayBaseByDesignation = new Map<string, DayBase>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    const bid = r.billing_day_base_id ? String(r.billing_day_base_id) : "";
    if (!did || !bid) continue;
    const base = bdbMap.get(bid);
    if (base) billingDayBaseByDesignation.set(did, base);
  }
  const dayBases = g.pdbs.map((p) => ({ id: String(p.id), ...toBase(p) }));

  const toResourceLike = (r: Row, did: string): ContractResourceLike => ({
    designationId: did,
    components: Array.isArray(r.components)
      ? (r.components as Row[]).map((c) => ({
          ...c,
          name: String(c.name ?? ""),
          amount: Number(c.amount) || 0,
          allowanceId: (c.allowanceId as string | null | undefined) ?? null,
          includeInOt: c.includeInOt as boolean | null | undefined,
          formulaMode: (c.formulaMode as string | null | undefined) ?? null,
          formulaExpression: (c.formulaExpression as string | null | undefined) ?? null,
          formulaVersion: (c.formulaVersion as number | null | undefined) ?? null,
        }))
      : [],
    benefits: Array.isArray(r.benefits) ? (r.benefits as { name: string; amount: number }[]) : [],
    deductions: Array.isArray(r.deductions) ? (r.deductions as { name: string; amount: number }[]) : [],
    employerContributions: Array.isArray(r.employer_contributions) ? (r.employer_contributions as { name: string; amount: number }[]) : [],
    otMultiplier: Number(r.ot_multiplier ?? 1) || 1,
    otBasis: (r.ot_basis ?? "components") as "components" | "gross" | "earned_gross" | "formula" | "hourly",
    otFormula: (r.ot_formula as string | null | undefined) ?? null,
    otHourlyRate: (r.ot_hourly_rate as number | null | undefined) ?? null,
    otHourlyEsic: (r.ot_hourly_esic as number | null | undefined) ?? null,
    otShiftHours: ([8, 10, 12].includes(Number(r.shift_hours)) ? (Number(r.shift_hours) as 8 | 10 | 12) : 8),
    otEsi: normalizeOtEsi(r.ot_esi),
    roundOffFinal: r.round_off_final === true,
    roundOffTotals: (r.round_off_totals ?? {}) as Record<string, boolean>,
    payrollDayBase: r.payroll_day_base_id ? pdbMap.get(String(r.payroll_day_base_id)) ?? null : null,
  }) as ContractResourceLike;
  const hydrate = (list: ContractResourceLike[]) =>
    hydrateFormulasWith(list as never[], g.masters).map((x) => refreshBillingAddOns(x as ContractResourceLike));

  const resourceByDesignation = new Map<string, ContractResourceLike>();
  const resourceByShiftKey = new Map<string, ContractResourceLike>();
  const shiftKeysOrdered: string[] = [];
  const shiftsByDesignation = new Map<string, Set<number>>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    if (!did) continue;
    const sk = shiftKey(did, r.shift_hours as number | null | undefined);
    const set = shiftsByDesignation.get(did) ?? new Set<number>();
    set.add(normShift(r.shift_hours as number | null | undefined));
    shiftsByDesignation.set(did, set);
    shiftKeysOrdered.push(sk);
    resourceByShiftKey.set(sk, toResourceLike(r, did));
    if (!resourceByDesignation.has(did)) resourceByDesignation.set(did, resourceByShiftKey.get(sk)!);
  }
  const uniqueShiftKeys = Array.from(new Set(shiftKeysOrdered));
  const hydratedList = hydrate(uniqueShiftKeys.map((k) => resourceByShiftKey.get(k)!));
  resourceByDesignation.clear();
  hydratedList.forEach((r, i) => {
    resourceByShiftKey.set(uniqueShiftKeys[i], r);
    if (!resourceByDesignation.has(r.designationId)) resourceByDesignation.set(r.designationId, r);
  });
  // Rate revised inside the period: each date window bills at its own rate.
  type RateWindow = { from: string; to: string; resource: ContractResourceLike };
  const rateWindowsByShiftKey = new Map<string, RateWindow[]>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    const segs = rawSegments.get(String(r.id));
    if (!did || !segs) continue;
    const likes = hydrate(segs.map((sg) => toResourceLike({ ...r, ...sg.values, ...contractOtFields(r) }, did)));
    rateWindowsByShiftKey.set(shiftKey(did, r.shift_hours as number | null | undefined), segs.map((sg, i) => ({ from: sg.from, to: sg.to, resource: likes[i] })));
  }
  const shiftForDesignationDefault = new Map<string, number>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    if (did && !shiftForDesignationDefault.has(did)) shiftForDesignationDefault.set(did, normShift(r.shift_hours as number | null | undefined));
  }
  const postingShift = new Map<string, number>();
  for (const l of links) {
    if (l.shift_hours != null) postingShift.set(l.candidate_id, normShift(l.shift_hours));
  }
  const billingBaseByShiftKey = new Map<string, DayBase>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    const bid = r.billing_day_base_id ? String(r.billing_day_base_id) : "";
    const base = bid ? bdbMap.get(bid) : undefined;
    if (did && base) billingBaseByShiftKey.set(shiftKey(did, r.shift_hours as number | null | undefined), base);
  }
  /** Pick the contract line for this guard: posting shift first, else the designation default. */
  const lineFor = (cid: string, rawDid: string, lineShift?: number) => {
    const did = resolveContractDesignation(rawDid, resourceByDesignation.keys(), (id) => desigMap.get(id));
    const offered = shiftsByDesignation.get(did);
    const wanted = [8, 10, 12].includes(Number(lineShift)) ? lineShift : postingShift.get(cid);
    const shift = wanted && offered?.has(wanted) ? wanted : (shiftForDesignationDefault.get(did) ?? 8);
    const sk = shiftKey(did, shift);
    return {
      shift,
      resource: resourceByShiftKey.get(sk) ?? resourceByDesignation.get(did),
      billingBase: billingBaseByShiftKey.get(sk) ?? null,
      invoicePresentCap: resources.find((r) => shiftKey(String(r.designation_id ?? ""), r.shift_hours as number | null | undefined) === sk)?.invoice_present_cap === true,
      contractDesignationId: did,
    };
  };

  // Field Officers are non-billable at client sites; only FO-designation lines are left off.
  const isFoDesig = (id: string | null | undefined) => /field[\s-]*officer/i.test((id && desigMap.get(id)) || "");
  const isFoHome = unitId === "92541381-14d3-4be6-ae8c-078b79c2e0f1";
  const rosterById = new Map(roster.map((c) => [c.id, c]));
  const pairKey = (cid: string, did: string | null, sh = 0) => `${cid}|${did ?? "__none__"}|${sh}`;
  const entryShift = (e: unknown) => Number((e as { shift_hours?: number | null }).shift_hours) || 0;
  // Regular vs reliever is decided by the attendance line itself.
  const entryReliever = (e: unknown) => Boolean((e as { is_reliever?: boolean | null }).is_reliever);
  const lineKey = (cid: string, did: string | null, sh: number, rel: boolean) => `${pairKey(cid, did, sh)}|${rel ? "R" : "N"}`;
  const pairs = new Map<string, { candidateId: string; designationId: string | null; shift: number; reliever: boolean }>();

  for (const c of rosterById.values()) {
    if (!isFoHome && isFoDesig(c.designation_id)) continue;
    const sh = postingShift.get(c.id) ?? 0;
    const k = lineKey(c.id, c.designation_id ?? null, sh, false);
    pairs.set(k, { candidateId: c.id, designationId: c.designation_id ?? null, shift: sh, reliever: false });
  }
  const entryCountByLine = new Map<string, number>();
  for (const e of entries) {
    if (!rosterById.has(e.candidate_id)) continue;
    if (!isFoHome && isFoDesig(e.designation_id ?? rosterById.get(e.candidate_id)?.designation_id)) continue;
    const rel = entryReliever(e);
    const k = lineKey(e.candidate_id, e.designation_id, entryShift(e), rel);
    entryCountByLine.set(k, (entryCountByLine.get(k) ?? 0) + 1);
    if (!pairs.has(k)) pairs.set(k, { candidateId: e.candidate_id, designationId: e.designation_id, shift: entryShift(e), reliever: rel });
  }
  // One regular line per person carries PH credit and day adjustments.
  const mainLineByCandidate = new Map<string, string>();
  for (const [k, p] of pairs) {
    if (p.reliever) continue;
    const c = rosterById.get(p.candidateId)!;
    const cur = mainLineByCandidate.get(p.candidateId);
    const score = (key: string, pp: typeof p) =>
      (entryCountByLine.get(key) ?? 0) * 2 + ((c.designation_id ?? null) === pp.designationId ? 1 : 0);
    if (!cur || score(k, p) > score(cur, pairs.get(cur)!)) mainLineByCandidate.set(p.candidateId, k);
  }

  // Entries grouped per line once (the page filtered the full list per row).
  const entriesByLine = new Map<string, AttendanceEntryFetchRow[]>();
  for (const e of entries) {
    const k = lineKey(e.candidate_id, e.designation_id ?? null, entryShift(e), entryReliever(e));
    const list = entriesByLine.get(k);
    if (list) list.push(e);
    else entriesByLine.set(k, [e]);
  }

  function buildRow(
    pk: string,
    p: { candidateId: string; designationId: string | null; shift: number; reliever: boolean },
    rateWindow: { from: string; to: string; resource: ContractResourceLike; last: boolean } | null,
  ) {
    const c = rosterById.get(p.candidateId)!;
    const did = p.designationId ? String(p.designationId) : "";
    const inWindow = (d: string) => !rateWindow || (d >= rateWindow.from && d <= rateWindow.to);
    const designationName = (p.designationId && desigMap.get(p.designationId)) || "—";
    const lineEntries = (entriesByLine.get(lineKey(p.candidateId, p.designationId, p.shift, p.reliever)) ?? []).filter(
      (e) => inWindow(String(e.entry_date).slice(0, 10)),
    );
    const isPrimary = !p.reliever && mainLineByCandidate.get(p.candidateId) === pk;
    // Day adjustments, PH cash and additions are applied once — on the last rate window.
    const carriesAdjustments = isPrimary && (!rateWindow || rateWindow.last);
    const isRegular = !p.reliever;
    const totals = computeAttendanceTotals(
      c.id,
      rateWindow ? periodDates.filter(inWindow) : periodDates,
      lineEntries as AttendanceEntryLike[],
      codes,
      isPrimary && !(unitPh?.excluded ?? []).includes(String(c.id)) && phConfig
        ? { ...phConfig, dates: Array.from(phConfig.dates).filter((d) => inWindow(String(d).slice(0, 10)) && !(unitPh?.excludedDays ?? []).includes(`${c.id}|${d}`)) }
        : null,
      c.preferred_joining_date ?? null,
      unitPh?.dayValue ?? null,
      woAsPresent,
    );
    if (carriesAdjustments) {
      const adj = dayAdjustmentByCandidate.get(c.id);
      if (adj) {
        totals.pDays = Math.max(0, totals.pDays + adj.pDays);
        totals.otDays = Math.max(0, totals.otDays + adj.otDays);
        totals.phDays = Math.max(0, totals.phDays + adj.phDays);
        totals.otherPaidDays = Math.max(0, totals.otherPaidDays + adj.otherPaidDays);
        totals.tDays = Math.max(0, totals.tDays + adj.tDays);
      }
      const phDisplay = phDisplayCountByCandidate.get(c.id) ?? 0;
      if (phDisplay) totals.phDays = totals.phDays + phDisplay;
    }
    const line = lineFor(c.id, did, p.shift);
    const resource = rateWindow?.resource ?? line.resource;
    const phOverride = carriesAdjustments ? phCashByCandidate.get(c.id) : undefined;
    const wages = resource
      ? computeWages(totals, resource, periodDates.length, {
          phOverrideAmount: phOverride,
          periodDates: periodDates.map((d) => new Date(d)),
          dayBases,
          epfCapEnabled,
        })
      : null;
    const candidateGender = (c.gender ?? "").toString();
    const candidateIsDisabled = Boolean(c.is_disabled);
    if (wages && carriesAdjustments) {
      const extraAdds = additionsByCandidate.get(c.id) ?? [];
      const extraDeds = deductionsByCandidate.get(c.id) ?? [];
      if (extraDeds.length > 0) wages.deductions = [...wages.deductions, ...extraDeds];
      const applied = applyEmployeeAdditions(wages, extraAdds, totals.pDays, { isDisabled: candidateIsDisabled, period: { ot: totals.otDays, ph: totals.phDays, payable_days: totals.tDays, days_in_month: periodDates.length } });
      Object.assign(wages, applied.wages);
      (wages as unknown as { additions: PerEmpItem[] }).additions = applied.additions;
      const pt = resolvePtAmount({ state: ptState, pincode: ptPincode, gender: candidateGender, earnedGross: wages.earnedGross, slabs: ptSlabs, ranges: pincodeRanges });
      Object.assign(wages, applyPtToWageComputation(wages, pt.amount));
      if (lwfRows && pincodeRanges) {
        const lwfRes = resolveLwf(String(ptPincode ?? ""), pincodeRanges as never, lwfRows, ptState);
        const periodMonth = new Date(start).getMonth() + 1;
        let applies = false;
        let employee = 0;
        let employer = 0;
        if (lwfRes.kind === "match" && lwfRes.lwf.enabled) {
          const months = Array.isArray(lwfRes.lwf.deduction_months) ? lwfRes.lwf.deduction_months : [];
          if (months.length === 0 || months.includes(periodMonth)) {
            applies = true;
            employee = Number(lwfRes.lwf.employee_contribution) || 0;
            employer = Number(lwfRes.lwf.employer_contribution) || 0;
          }
        }
        Object.assign(wages, applyLwfToWageComputation(wages, { employee, employer, applies }));
      }
      Object.assign(wages, applyEpfBreakdownToWageComputation(wages, { epfCapEnabled }));
    }
    const mergedResource = resource
      ? {
          ...resource,
          components: mergePayItems(resource.components),
          benefits: mergePayItems(resource.benefits ?? []),
          deductions: mergePayItems(resource.deductions ?? []),
          employerContributions: mergePayItems(resource.employerContributions ?? []),
        }
      : null;
    if (wages) {
      wages.components = mergePayItems(wages.components) as typeof wages.components;
      wages.deductions = mergePayItems(wages.deductions) as typeof wages.deductions;
      wages.employerContributions = mergePayItems(wages.employerContributions) as typeof wages.employerContributions;
    }
    return {
      id: c.id,
      rowKey: rateWindow ? `${pk}|${rateWindow.from}` : pk,
      rateWindowLabel: rateWindow
        ? `${rateWindow.from.split("-").reverse().join("-")} To ${rateWindow.to.split("-").reverse().join("-")}`
        : null,
      employeeCode: c.employee_code || "",
      joiningDate: (c.preferred_joining_date ?? null) as string | null,
      name: c.full_name || "—",
      designation: designationName,
      designationId: p.designationId,
      isPrimary,
      isRegular,
      shiftHours: line.shift,
      billingDayBase: line.billingBase,
      invoicePresentCap: line.invoicePresentCap,
      contractDesignationId: line.contractDesignationId,
      totals,
      wages,
      resource: (mergedResource ?? resource ?? null) as ContractResourceLike | null,
      hasContract: !!resource,
    };
  }

  const rows = Array.from(pairs.entries()).flatMap(([pk, p]) => {
    const c0 = rosterById.get(p.candidateId)!;
    const did0 = p.designationId ? String(p.designationId) : "";
    const line0 = lineFor(c0.id, did0, p.shift);
    const windows = rateWindowsByShiftKey.get(shiftKey(did0, line0.shift));
    if (!windows) return [buildRow(pk, p, null)];
    return windows.map((w, i) => buildRow(pk, p, { ...w, last: i === windows.length - 1 }));
  });

  rows.sort((a, b) => {
    const an = (a.employeeCode || a.name).localeCompare(b.employeeCode || b.name);
    if (an !== 0) return an;
    if (a.isRegular !== b.isRegular) return a.isRegular ? -1 : 1;
    return a.designation.localeCompare(b.designation);
  });

  const shiftHoursByDesignation = new Map<string, number>();
  for (const r of resources) {
    const h = Number(r.shift_hours);
    shiftHoursByDesignation.set(String(r.designation_id ?? "__none__"), Number.isFinite(h) && h > 0 ? h : 8);
  }

  const strengths = invoicePoolStrength(resources.map((r) => ({ designationId: String(r.designation_id ?? ""), shiftHours: normShift(r.shift_hours as number | null | undefined), quantity: Number(r.quantity ?? 0) })));
  const allocations = allocateInvoicePresent(rows.map((row) => {
    const poolRule = { designationId: row.contractDesignationId, shiftHours: row.shiftHours };
    const rule = { ...poolRule, invoicePresentCap: row.invoicePresentCap, invoiceCapQuantity: strengths.get(invoiceCapPool("", poolRule)) ?? 0, billingDayBase: row.billingDayBase };
    return { pool: invoiceCapPool(unitId, rule), order: `${row.id}|${row.rowKey}`, present: row.totals.pDays, extraDuty: row.totals.otDays, cap: billingMode === "man_days" || billingMode === "man_hours" ? invoicePresentLimit(rule, periodDates) : null };
  }));
  const invoiceRows = rows.map((row, index) => ({ ...row, payrollTotals: row.totals, totals: { ...row.totals, pDays: allocations[index].present, otDays: allocations[index].extraDuty, otHours: allocations[index].extraDuty } }));
  return {
    rows: invoiceRows,
    billingMode,
    shiftHoursByDesignation,
    billingDayBaseByDesignation,
    contractId: contractId ?? null,
    gstOption: typeof periodContract?.gst_option === "string" ? (periodContract.gst_option as string) : null,
    periodDates,
    resources,
    /** One priced contract line per role × shift (quantity from the last saved line), for contract-value totals. */
    contractLines: (() => {
      const qty = new Map<string, number>();
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        if (did) qty.set(shiftKey(did, r.shift_hours as number | null | undefined), Number(r.quantity) || 0);
      }
      return [...qty].map(([k, quantity]) => ({ quantity, resource: resourceByShiftKey.get(k) ?? null }));
    })(),
    rosterSize: new Set([...src.primary, ...src.secondary].map((c) => c.id)).size,
  };
}

export type InvoiceUnitResult = ReturnType<typeof computeInvoiceUnit>;
export type InvoiceRow = InvoiceUnitResult["rows"][number];

export type InvoiceMathContext = {
  unitId: string;
  unitCode: string | null | undefined;
  customerName: string | null | undefined;
  billingMode: InvoiceBillingMode;
  invoiceSplit: InvoiceSplit;
  periodDates: string[];
  shiftHoursByDesignation: Map<string, number>;
  billingDayBaseByDesignation: Map<string, DayBase>;
  exactDayRate: boolean;
};

/** One invoice line priced exactly as the invoice page prints it. */
export function invoiceLineMath(r: Pick<InvoiceRow, "resource" | "wages" | "totals" | "billingDayBase" | "designationId" | "shiftHours" | "designation" | "invoicePresentCap">, ctx: InvoiceMathContext) {
  const { billingMode, invoiceSplit, periodDates, exactDayRate } = ctx;
  const contracted = r.resource ? contractMonthlyBilling(r.resource as never) : 0;
  const payrollDays =
    resolvePayrollDayCount(r.resource?.payrollDayBase ?? null, periodDates) ??
    (r.wages?.baseDays || periodDates.length || 30);
  const billingDays =
    resolvePayrollDayCount(
      r.billingDayBase ?? ctx.billingDayBaseByDesignation.get(String(r.designationId ?? "")) ?? r.resource?.payrollDayBase ?? null,
      periodDates,
      // A billing divisor is a contractual constant (e.g. 30.40), never clamped.
      { clampToPeriod: false },
    ) ?? payrollDays;
  const billedDays = roundDutyDays(r.totals.tDays ?? 0);
  const shiftHours = r.shiftHours ?? ctx.shiftHoursByDesignation.get(String(r.designationId ?? "__none__")) ?? 8;
  const perHour = billingDays > 0 && shiftHours > 0 ? Math.round((contracted / billingDays / shiftHours) * 100) / 100 : 0;
  const perDay = billingDays > 0 ? Math.round((contracted / billingDays) * 100) / 100 : 0;
  const billedHours = Math.round(billedDays * shiftHours * 100) / 100;
  const billsHourly = billingMode === "man_hours";
  const unitRate = billsHourly ? perHour : perDay;
  const unitQuantity = billsHourly ? billedHours : billedDays;
  const unitLabel = billsHourly ? "hrs" : "Duty";
  const exactRate = billsHourly
    ? billingDays > 0 && shiftHours > 0 ? contracted / billingDays / shiftHours : 0
    : billingDays > 0 ? contracted / billingDays : 0;
  const extraDutyRate = invoiceExtraDutyRate(ctx.unitId, r.resource?.components ?? [], {
    unitCode: ctx.unitCode,
    designationName: r.designation,
    monthlyBilling: contracted,
    billingDays,
    savedExtraDutyRate: r.wages?.perDutyOtAmount,
    hourlyEd: r.resource?.otBasis === "hourly"
      ? { rate: r.resource.otHourlyRate, esic: r.resource.otHourlyEsic, shiftHours }
      : null,
  });
  const contractEdLines = (invoiceSplit.edLines === true || r.invoicePresentCap) && extraDutyRate == null && (r.totals.otDays ?? 0) > 0;
  const edRateForSplit = extraDutyRate ?? (contractEdLines ? exactDayRateFor(contracted, billingDays) : null);
  const caretakerHourlyEd =
    isCli2989Caretaker(ctx.unitCode, r.designation) ||
    (r.resource?.otBasis === "hourly" && extraDutyRate != null && !showsHourlyEdAsDays(ctx.customerName)) ||
    (contractEdLines && !r.invoicePresentCap);
  const dutySplit = edRateForSplit != null && r.wages && r.resource && (billingMode === "man_days" || billsHourly)
    ? splitInvoiceDuties({ billedDays, otDays: r.totals.otDays ?? 0, regularRate: unitRate, extraDutyRate: edRateForSplit, shiftHours, hourly: billsHourly, extraDutyHourly: caretakerHourlyEd, exactExtraDutyRate: caretakerHourlyEd })
    : null;
  const actual = dutySplit?.actual ?? (
    !r.wages || !r.resource
      ? 0
      : billingMode === "lumpsum" || billingMode === "man_months"
        ? contracted
        : Math.round((exactDayRate ? exactRate * (billsHourly ? (r.totals.tDays ?? 0) * shiftHours : (r.totals.tDays ?? 0)) : unitRate * unitQuantity) * 100) / 100);
  return {
    extraDutyRate,
    dutySplit,
    billingLines: invoiceDutyBillingLines({ dutySplit, edLines: invoiceSplit.edLines, unitRate, unitQuantity, actual, unitLabel, extraDutyUnitLabel: caretakerHourlyEd ? "hrs" : unitLabel }),
    contracted,
    payrollDays,
    billingDays,
    billedDays,
    shiftHours,
    billedHours,
    perHour,
    perDay,
    unitRate,
    unitQuantity,
    unitLabel,
    actual,
    variance: Math.round((actual - contracted) * 100) / 100,
  };
}

/** Rows of one invoice part (all rows when the contract has no split). */
export function invoicePartRows<R extends InvoiceRow>(all: R[], split: InvoiceSplit, part: string, billingMode: InvoiceBillingMode): R[] {
  if (!isSplit(split)) return all;
  const fixedValue = billingMode === "lumpsum" || billingMode === "man_months";
  return all
    .map((r) => ({ ...r, totals: totalsForPart(r.totals, r.invoicePresentCap || r.isRegular, split, part) }))
    .filter((r) => {
      if (fixedValue) return r.isRegular ? split.assign.regular === part : split.assign.reliever === part;
      return r.totals.tDays > 0;
    });
}

export type InvoiceExtraLike = { enabled: boolean; calcMode: "amount" | "percent"; percent: number; baseOverride: number | null; amount: number; quantity: number; rate: number };
const r2 = (v: number) => Math.round(v * 100) / 100;
function resolveExtras<T extends InvoiceExtraLike>(charges: T[], subtotal: number): T[] {
  return charges.map((c) => {
    if (c.calcMode !== "percent") return c;
    const base = c.baseOverride ?? subtotal;
    return { ...c, rate: r2(base), quantity: c.percent, amount: r2((base * c.percent) / 100) };
  });
}

/**
 * Taxable value of every invoice part, exactly as the page totals each tab:
 * billed lines rounded to paise, plus that part's configured extra charges.
 */
export function invoiceUnitTaxable(result: InvoiceUnitResult, ctx: Omit<InvoiceMathContext, "billingMode" | "periodDates" | "shiftHoursByDesignation" | "billingDayBaseByDesignation">, extras: InvoiceExtraLike[]) {
  const math: InvoiceMathContext = {
    ...ctx,
    billingMode: result.billingMode,
    periodDates: result.periodDates,
    shiftHoursByDesignation: result.shiftHoursByDesignation,
    billingDayBaseByDesignation: result.billingDayBaseByDesignation,
  };
  const split = ctx.invoiceSplit;
  const parts = isSplit(split) ? split.parts : [{ key: split.parts[0]?.key ?? "main", label: "" }];
  const out = parts.map((p) => {
    const rows = invoicePartRows(result.rows, split, p.key, result.billingMode);
    let actual = 0;
    for (const r of rows) {
      if (!r.wages) continue;
      actual += invoiceLineMath(r, math).actual;
    }
    const billed = r2(actual);
    const partExtras = resolveExtras(extras, billed).filter((c) => c.enabled && (!isSplit(split) || split.assign.extras === p.key));
    const extrasTotal = r2(partExtras.reduce((s, c) => s + c.amount, 0));
    return { part: p.key, billed, extras: extrasTotal, taxable: r2(billed + extrasTotal) };
  });
  return { parts: out, taxable: r2(out.reduce((s, p) => s + p.taxable, 0)) };
}

/** Load one site's invoice data with the invoice page's own queries. */
export async function loadInvoiceUnitData(unitId: string, start: string, end: string): Promise<InvoiceUnitData> {
  const [unitRes, flagsRes, primaryRes, linksRes] = await Promise.all([
    supabase
      .from("units")
      .select("id, code, customer_id, epf_cap_enabled, billing_state, billing_pincode, pt_state, ph_enabled, ph_multiplier, ph_day_value, ph_excluded_candidate_ids, ph_excluded_days, customers(name)" as never)
      .eq("id", unitId)
      .maybeSingle(),
    supabase
      .from("client_contracts")
      .select("wo_as_present, exact_day_rate" as never)
      .eq("unit_id", unitId)
      .eq("record_type", "client")
      .eq("status", "active")
      .lte("start_date", end)
      .or(`end_date.is.null,end_date.gte.${start}`)
      .order("start_date", { ascending: false })
      .limit(1),
    supabase.from("candidates").select(INVOICE_CANDIDATE_COLS).eq("unit_id", unitId).eq("is_enabled", true).eq("status", "active"),
    supabase.from("candidate_units").select("candidate_id, shift_hours" as never).eq("unit_id", unitId),
  ]);
  if (primaryRes.error) throw primaryRes.error;
  if (linksRes.error) throw linksRes.error;
  const unit = (unitRes.data ?? null) as Row | null;
  const flags = ((flagsRes.data ?? []) as unknown as Row[])[0];
  const links = (linksRes.data ?? []) as unknown as { candidate_id: string; shift_hours?: number | null }[];
  const linkIds = links.map((l) => l.candidate_id);
  let secondary: InvoiceCandidate[] = [];
  if (linkIds.length > 0) {
    const { data, error } = await supabase.from("candidates").select(INVOICE_CANDIDATE_COLS).in("id", linkIds).eq("is_enabled", true).eq("status", "active");
    if (error) throw error;
    secondary = (data ?? []) as InvoiceCandidate[];
  }
  const primary = (primaryRes.data ?? []) as InvoiceCandidate[];
  const have = new Set([...primary, ...secondary].map((c) => c.id));
  let leavers: InvoiceCandidate[] = [];
  const attended = (await fetchAttendedCandidateIds(unitId, start, end)).filter((id) => !have.has(id));
  if (attended.length) {
    const { data } = await supabase.from("candidates").select(INVOICE_CANDIDATE_COLS).in("id", attended);
    leavers = (data ?? []) as InvoiceCandidate[];
  }
  const entries = await fetchAttendanceEntriesForPeriod({ unitId, start, end });
  const periodContract = await fetchPeriodContract<Row>(unitId, start, end, "id, payroll_window_id, billing_type_id, gst_option");
  let billingMode: InvoiceBillingMode = "man_days";
  if (periodContract?.billing_type_id) {
    const { data: bt } = await supabase.from("billing_types" as never).select("code").eq("id", String(periodContract.billing_type_id)).maybeSingle();
    billingMode = billingModeFromCode(((bt as unknown) as { code?: string | null } | null)?.code ?? "man_days");
  }
  let resources: Row[] = [];
  let revisions: RateRevisionRow[] | null = null;
  if (periodContract?.id) {
    const { data: r } = await supabase.from("contract_resources" as never).select(RESOURCE_COLS).eq("contract_id", String(periodContract.id));
    resources = (r ?? []) as unknown as Row[];
    const ids = resources.map((x) => x.id).filter(Boolean).map(String);
    revisions = ids.length ? await fetchRevisions(ids) : null;
  }
  const roster = Array.from(new Set([...primary, ...secondary, ...leavers].map((c) => c.id)));
  let additions: RawAddition[] = [];
  let deductions: RawDeduction[] = [];
  if (roster.length > 0) {
    const [addsRes, dedsRes] = await Promise.all([
      supabase
        .from("additions" as never)
        .select(ADDITION_COLS)
        .in("candidate_id", roster)
        .lte("addition_date", end)
        .or(`addition_date.gte.${start},and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.${start}))`)
        .or(`unit_id.is.null,unit_id.eq.${unitId}`)
        .eq("status", "active"),
      supabase
        .from("deductions" as never)
        .select(DEDUCTION_COLS)
        .in("candidate_id", roster)
        .gte("deduction_date", start)
        .lte("deduction_date", end)
        .eq("status", "active")
        .or(`unit_id.is.null,unit_id.eq.${unitId}`),
    ]);
    additions = (addsRes.data ?? []) as unknown as RawAddition[];
    deductions = (dedsRes.data ?? []) as unknown as RawDeduction[];
  }
  const billingState = (unit?.billing_state as string | null | undefined) ?? null;
  const billingPincode = (unit?.billing_pincode as string | null | undefined) ?? null;
  const ptStateRaw = (unit?.pt_state as string | null | undefined) || null;
  return {
    unitId,
    start,
    end,
    unitCode: (unit?.code as string | null | undefined) ?? null,
    customerName: ((unit?.customers as { name?: string | null } | null | undefined)?.name ?? null) as string | null,
    epfCapEnabled: (unit?.epf_cap_enabled as boolean | null | undefined) ?? true,
    ptState: ptStateRaw || billingState,
    ptPincode: ptStateRaw ? null : billingPincode,
    unitPh: unitPhFromRow(unit as never),
    woAsPresent: Boolean(flags?.wo_as_present),
    exactDayRate: Boolean(flags?.exact_day_rate),
    primary,
    links,
    secondary,
    leavers,
    entries,
    periodContract,
    billingMode,
    resources,
    revisions,
    additions,
    deductions,
  };
}

/** Shared reference data (codes, day bases, designations, formula masters, PT/LWF, holidays). */
export async function loadInvoiceGlobals(resources: Row[] = [], revisions: RateRevisionRow[] | null = null, preloadedMasters?: Promise<Map<string, FormulaMaster>>): Promise<InvoiceGlobals> {
  const pages = async <T,>(build: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build(from, from + 999);
      if (error) throw error;
      const page = (data ?? []) as T[];
      out.push(...page);
      if (page.length < 1000) break;
    }
    return out;
  };
  const [codes, pdbs, bdbs, designations, holidays, addTypes, ptSlabs, pincodeRanges, lwfRows] = await Promise.all([
    supabase.from("attendance_codes").select("code, counts_as_present, is_paid, day_value").eq("enabled", true).then((r) => (r.data ?? []) as AttendanceCodeLike[]),
    supabase.from("payroll_day_bases").select("id, method, fixed_days, weekly_off_day, included_weekdays, enabled").then((r) => (r.data ?? []) as unknown as Row[]),
    supabase.from("billing_day_bases" as never).select("id, method, fixed_days, weekly_off_day, included_weekdays, enabled").then((r) => (r.data ?? []) as unknown as Row[]),
    pages<{ id: string; name: string | null }>((a, b) => supabase.from("designations").select("id,name").order("id").range(a, b)),
    supabase.from("public_holidays" as never).select("id,name,holiday_month,holiday_day,enabled,sort_order").eq("enabled", true).then((r) => ((r.data ?? []) as unknown as Row[]).map((h) => ({ id: String(h.id), name: String(h.name ?? ""), month: Number(h.holiday_month ?? 1), day: Number(h.holiday_day ?? 1), enabled: Boolean(h.enabled ?? true), sortOrder: Number(h.sort_order ?? 0) }))),
    supabase.from("addition_types").select("id, code").then((r) => (r.data ?? []) as { id: string; code: string | null }[]),
    supabase.from("professional_tax_slabs").select("id, state, region_label, salary_min, salary_max, tax_per_month, gender").then((r) => (r.data ?? []) as PtSlabLike[]),
    supabase.from("pincode_ranges").select("state, region_label, range_start, range_end, is_excluded").then((r) => (r.data ?? []) as PincodeRangeLike[]),
    supabase.from("labour_welfare_funds").select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes").then((r) => (r.data ?? []) as LwfRow[]),
  ]);
  const masters = await (preloadedMasters ?? loadFormulaMastersFor(resources, revisions));
  return {
    codes,
    pdbs,
    bdbs,
    designationNames: new Map(designations.map((d) => [d.id, d.name ?? ""])),
    masters,
    publicHolidays: holidays,
    phTypeIds: new Set(addTypes.filter((t) => (t.code ?? "").toLowerCase() === "paid_holidays").map((t) => t.id)),
    ptSlabs,
    pincodeRanges,
    lwfRows,
  };
}

/** Formula masters referenced by these raw contract_resources rows (and their revisions). */
export async function loadFormulaMastersFor(resources: Row[], revisions: RateRevisionRow[] | null = null): Promise<Map<string, FormulaMaster>> {
  const shape = (r: Row) => ({
    components: (Array.isArray(r.components) ? r.components : []) as never[],
    benefits: (Array.isArray(r.benefits) ? r.benefits : []) as never[],
    deductions: (Array.isArray(r.deductions) ? r.deductions : []) as never[],
    employerContributions: (Array.isArray(r.employer_contributions) ? r.employer_contributions : []) as never[],
  });
  const { allowanceIds, costIds } = formulaMasterIds([...resources, ...((revisions ?? []) as Row[])].map(shape));
  const out = new Map<string, FormulaMaster>();
  const cols = "id, formula_mode, formula_expression, formula_version, fixed_calc_method, fixed_duty_components, fixed_duty_divisor";
  const load = async (table: "allowance_types" | "cost_components", ids: string[]) => {
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await supabase.from(table).select(cols).in("id", ids.slice(i, i + 150));
      if (error) throw error;
      for (const m of (data ?? []) as Row[]) {
        out.set(String(m.id), {
          mode: (m.formula_mode as string | null) ?? null,
          expr: (m.formula_expression as string | null) ?? null,
          version: m.formula_version == null ? null : Number(m.formula_version),
          fixedCalcMethod: (m.fixed_calc_method as string | null) ?? null,
          fixedDutyComponents: Array.isArray(m.fixed_duty_components) ? (m.fixed_duty_components as string[]) : null,
          fixedDutyDivisor: (m.fixed_duty_divisor as string | null) ?? null,
        });
      }
    }
  };
  await Promise.all([load("allowance_types", [...allowanceIds]), load("cost_components", [...costIds])]);
  return out;
}
