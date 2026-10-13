import { mergePayItems } from "@/lib/pay-item-names";
import { fetchPeriodContract } from "@/lib/period-contract";
import { fetchAttendedCandidateIds } from "@/lib/period-roster";


import { supabase } from "./shim";
const supabaseSessionReady=async()=>{};
import {
  applyEpfBreakdownToWageComputation,
  applyEmployeeAdditions,
  applyLwfToWageComputation,
  applyPtToWageComputation,
  computeAttendanceTotals,
  computeWages,
  fmtINR,
  resolvePtAmount,
  type AttendanceCodeLike,
  type AttendanceEntryLike,
  type ContractResourceLike,
  type PincodeRangeLike,
  type PtSlabLike,
} from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { misBillingLine } from "@/lib/mis-billing";
import { gstinStateCode } from "@/lib/gstin";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { normShift, shiftKey } from "@/lib/shift-resources";
import { applyRateRevisionsForPeriod } from "@/lib/rate-revisions";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { refreshBillingAddOns } from "@/lib/contract-billing-addons";
import { resolvePayrollDayCount } from "@/lib/payroll-days";
import { usePublicHolidays, holidayMapForDates } from "@/lib/public-holidays";
import { DEFAULT_SPLIT, EXCLUDE, INVOICE_ITEMS, isSplit, loadOrgInvoiceSplit, totalsForPart } from "@/lib/invoice-split";



const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Ledger names for one-off additions/deductions are stored as
// "<code> - <name> - <date>". Only the middle "<name>" segment is user-facing.
function cleanLedgerName(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 3) return parts[1].trim() || s;
  return s;
}

const ESI_COMPONENT_RE = /\besi(c)?\b/i;
const PT_COMPONENT_RE = /\bprofessional\s*tax\b|\bp\.?\s*tax\b|\bpt\b/i;
const isEsiItem = (item: { name?: unknown }) => ESI_COMPONENT_RE.test(String(item.name ?? ""));
const isPtItem = (item: { name?: unknown }) => PT_COMPONENT_RE.test(String(item.name ?? ""));
const hasConfiguredFormula = (item: { formulaExpression?: string | null }) =>
  !!String(item?.formulaExpression ?? "").trim();
/** ESI rows fall back to the statutory calc only when no formula is configured. */
const isStatutoryEsi = (item: { name?: unknown; formulaExpression?: string | null }) =>
  isEsiItem(item) && !hasConfiguredFormula(item);
const contractTotalAmount = (item: { name?: unknown; amount?: unknown }) =>
  isEsiItem(item) || isPtItem(item) ? 0 : Number(item.amount) || 0;

type RateCardItem = {
  name?: unknown;
  amount?: unknown;
  calcType?: string | null;
  percentage?: number | string | null;
  baseComponents?: { label: string; operator: "+" | "-" }[] | null;
  capAmount?: number | string | null;
  capFlatAmount?: number | string | null;
  formulaMode?: string | null;
  formulaExpression?: string | null;
};

/**
 * Full-month statutory ESI on the contract rate card (same maths the client
 * contract card uses): percentages / ceiling come from the configured ESI
 * rows, base is gross minus washing & conveyance.
 */
function contractEsiAmounts(resource: {
  components: RateCardItem[];
  benefits?: RateCardItem[];
  deductions?: RateCardItem[];
  employerContributions?: RateCardItem[];
}): { employee: number; employer: number } {
  const sum = (list: RateCardItem[] | undefined) =>
    (list ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gross = sum(resource.components) + sum(resource.benefits);
  const washing = (resource.components ?? [])
    .filter((c) => /\bwashing\b/i.test(String(c.name ?? "")))
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const conveyance = (resource.components ?? [])
    .filter((c) => /\bconveyance\b|\bconv\.?\b/i.test(String(c.name ?? "")))
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const base = Math.max(0, gross - washing - conveyance);
  const empItem = (resource.deductions ?? []).find(isEsiItem);
  const erItem = (resource.employerContributions ?? []).find(isEsiItem);
  const empPct = empItem && Number(empItem.percentage) > 0 ? Number(empItem.percentage) : 0.75;
  const erPct = erItem && Number(erItem.percentage) > 0 ? Number(erItem.percentage) : 3.25;
  const cap =
    (empItem && Number(empItem.capAmount) > 0 && Number(empItem.capAmount)) ||
    (erItem && Number(erItem.capAmount) > 0 && Number(erItem.capAmount)) ||
    21000;
  const eligible = base > 0 && base <= cap;
  return {
    employee: eligible ? Math.ceil(base * (empPct / 100)) : 0,
    employer: eligible ? Math.ceil(base * (erPct / 100)) : 0,
  };
}

/** Billing add-ons that sit after Total CTC on the contract rate card. */
const isRelieverLine = (x: { name?: unknown }) => /reliever/i.test(String(x?.name ?? ""));
const isMgmtFeeLine = (x: { name?: unknown }) =>
  /management\s*fee|\bmgmt\s*fee\b/i.test(String(x?.name ?? ""));
const isBillingAddOn = (x: { name?: unknown }) => isRelieverLine(x) || isMgmtFeeLine(x);

/**
 * Contracted value per head per month = exactly the saved contract card's
 * FINAL BILLING RATE. The contract editor has already evaluated and saved all
 * formulas, caps and add-ons; invoices must consume those saved amounts and
 * must never independently recalculate them.
 */
function contractBillableMonthly(resource: {
  components: RateCardItem[];
  benefits?: RateCardItem[];
  deductions?: RateCardItem[];
  employerContributions?: RateCardItem[];
}): number {
  const sumSaved = (items: RateCardItem[] | undefined) =>
    (items ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return Math.round((
    sumSaved(resource.components)
    + sumSaved(resource.benefits)
    + sumSaved(resource.employerContributions)
  ) * 100) / 100;
}



function fmtPretty(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

function buildDates(start: string, end: string): string[] {
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

export async function computeInvoice(unitId:string,start:string,end:string,G:any){
  const {ptSlabs,pincodeRanges,lwfRows}=G;
  const periodDates=buildDates(start,end);
  const { data: ur } = await supabase.from("units").select("*").eq("id", unitId).maybeSingle();
  const unit:any=ur; const unitState=unit?.billing_state??null; const unitPincode=unit?.billing_pincode??null; const epfCapEnabled=unit?.epf_cap_enabled??true;
  const unitPh = { enabled: Boolean(ur?.ph_enabled), multiplier: Number(ur?.ph_multiplier ?? 1) || 1, dayValue: !ur?.ph_enabled ? 0 : ur?.ph_day_value == null || Number.isNaN(Number(ur.ph_day_value)) ? null : Number(ur.ph_day_value) };
  const publicHolidays=G.publicHolidays;
  const phConfig = (() => { if (!unitPh.enabled) return null; const m = holidayMapForDates(periodDates, publicHolidays); if (m.size === 0) return null; return { dates: Array.from(m.keys()), multiplier: unitPh.multiplier }; })();
  const misApplicable=true; const sheet:any=null;
  const data:any = await (async()=>{
      await supabaseSessionReady();
      // 1. Roster: candidates mapped to this unit (primary + secondary).
      const [primaryRes, linksRes] = await Promise.all([
        supabase
          .from("candidates")
          .select("id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date")
          .eq("unit_id", unitId)
          .eq("is_enabled", true)
          .eq("status", "active"),
        supabase.from("candidate_units").select("candidate_id, shift_hours" as never).eq("unit_id", unitId),
      ]);
      if (primaryRes.error) throw primaryRes.error;
      if (linksRes.error) throw linksRes.error;
      const primary = primaryRes.data;
      const links = linksRes.data;
      const linkIds = ((links ?? []) as unknown as { candidate_id: string }[]).map((l) => l.candidate_id);
      let secondary: typeof primary = [];
      if (linkIds.length > 0) {
        const { data, error: secErr } = await supabase
          .from("candidates")
          .select("id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date")
          .in("id", linkIds)
          .eq("is_enabled", true)
          .eq("status", "active");
        if (secErr) throw secErr;
        secondary = data ?? [];
      }

      const roster = Array.from(
        new Map([...(primary ?? []), ...(secondary ?? [])].map((c) => [c.id, c])).values(),
      );
      // Bill days worked by people who have since left or been disabled.
      {
        const have = new Set(roster.map((c) => c.id));
        const attended = (await fetchAttendedCandidateIds(unitId, start, end)).filter((id) => !have.has(id));
        if (attended.length) {
          const { data: leavers } = await supabase
            .from("candidates")
            .select("id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date")
            .in("id", attended);
          roster.push(...((leavers ?? []) as typeof roster));
        }
      }

      const designationIds = Array.from(
        new Set(roster.map((c) => c.designation_id).filter(Boolean)),
      ) as string[];
      const { data: designations } = await supabase
        .from("designations")
        .select("id, name")
        .in("id", designationIds.length ? designationIds : ["00000000-0000-0000-0000-000000000000"]);
      const desigMap = new Map((designations ?? []).map((d) => [d.id, d.name as string]));

      // 2. Attendance entries (fetched per day to avoid backend row caps)
      const entries = await fetchAttendanceEntriesForPeriod({ unitId, start, end }) as Array<{
        candidate_id: string;
        designation_id: string | null;
        entry_date: string;
        code: string;
        ot_hours: number | string | null;
      }>;

      const { data: codes } = await supabase
        .from("attendance_codes")
        .select("code, counts_as_present, is_paid, day_value")
        .eq("enabled", true);

      // 3. Contract resources for this unit's active contract.
      const periodContract = await fetchPeriodContract<Record<string, unknown>>(unitId, start, end, "id, payroll_window_id, billing_type_id");
      const contracts = periodContract ? [periodContract as any] : [];
      const contractId = contracts?.[0]?.id;
      const billingTypeId = contracts?.[0]?.billing_type_id ?? null;

      let billingMode: "man_days" | "man_hours" | "man_months" | "lumpsum" = "man_days";
      if (billingTypeId) {
        const { data: bt } = await supabase
          .from("billing_types" as never)
          .select("code")
          .eq("id", billingTypeId)
          .maybeSingle();
        const code = ((bt as unknown) as { code?: string | null } | null)?.code ?? "man_days";
        if (code === "man_hours" || code === "man_months" || code === "lumpsum") billingMode = code;
      }

      let resources: Record<string, unknown>[] = [];
      if (contractId) {
        const { data: r } = await supabase
          .from("contract_resources" as never)
          .select(
            "id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id, billing_day_base_id, shift_hours, ot_multiplier",
          )
          .eq("contract_id", contractId);
        resources = (r ?? []) as unknown as Record<string, unknown>[];
        resources = await applyRateRevisionsForPeriod(resources as Record<string, unknown>[], start, end);
      }

      // 3b. Per-employee Additions & Deductions in the invoice window.
      // Mirrors admin.payroll.$unitId.tsx so invoice employer-cost lines up
      // 1:1 with the payroll register (previously omitted).
      const candidateIds = roster.map((c) => c.id);
      type PerEmpItem = { name: string; amount: number; prorate?: boolean; countsForPf?: boolean; countsForEsi?: boolean };
      type DayAdj = { pDays: number; otDays: number; phDays: number; otherPaidDays: number; tDays: number };
      const additionsByCandidate = new Map<string, PerEmpItem[]>();
      const deductionsByCandidate = new Map<string, PerEmpItem[]>();
      const dayAdjustmentByCandidate = new Map<string, DayAdj>();
      const phDisplayCountByCandidate = new Map<string, number>();
      const phCashByCandidate = new Map<string, number>();
      if (candidateIds.length > 0) {
        const [addsRes, dedsRes, addTypesRes] = await Promise.all([
          supabase
            .from("additions" as never)
            .select("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi")
            .in("candidate_id", candidateIds)
            .lte("addition_date", end)
            .or(`addition_date.gte.${start},and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.${start}))`)
            .or(`unit_id.is.null,unit_id.eq.${unitId}`)
            .eq("status", "active"),
          supabase
            .from("deductions" as never)
            .select("candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for")
            .in("candidate_id", candidateIds)
            .gte("deduction_date", start)
            .lte("deduction_date", end)
            .eq("status", "active")
            .or(`unit_id.is.null,unit_id.eq.${unitId}`),
          supabase.from("addition_types").select("id, code"),
        ]);
        const phTypeIds = new Set<string>(
          ((addTypesRes.data ?? []) as { id: string; code: string | null }[])
            .filter((t) => (t.code ?? "").toLowerCase() === "paid_holidays")
            .map((t) => t.id),
        );
        type RawAdd = { candidate_id: string; addition_type_id?: string | null; addition_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; repeat_monthly?: boolean | null; prorate_by_days?: boolean | null; counts_for_pf?: boolean | null; counts_for_esi?: boolean | null };
        type RawDed = { candidate_id: string; deduction_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null };
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

        for (const a of ((addsRes.data ?? []) as unknown as RawAdd[])) {
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
            });
            additionsByCandidate.set(a.candidate_id, arr);
          }
          if (a.entry_mode === "days_x_per_day" && a.include_in_total_days) {
            applyDayAdj(a.candidate_id, Number(a.days) || 0, a.affects_days_for, +1);
          }
        }
        for (const d of ((dedsRes.data ?? []) as unknown as RawDed[])) {
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



      // Coerce attendance entries missing a designation to the candidate's
      // primary designation so billing lines roll into the correct
      // contract-resource row instead of a phantom "no designation" line.
      const primaryDesigByCandidate = new Map(
        roster.map((c) => [c.id, c.designation_id ?? null] as const),
      );
      for (const e of entries) {
        if (!e.designation_id) {
          const primary = primaryDesigByCandidate.get(e.candidate_id) ?? null;
          if (primary) e.designation_id = primary;
        }
      }

      // Make sure we know the names of any designation_ids referenced by entries
      // that weren't in the roster's primary designation list.
      const allDesigIds = new Set<string>(designationIds);
      for (const e of entries) if (e.designation_id) allDesigIds.add(e.designation_id);
      for (const r of resources) {
        const d = r.designation_id ? String(r.designation_id) : "";
        if (d) allDesigIds.add(d);
      }
      if (allDesigIds.size > 0) {
        const { data: extraDs } = await supabase
          .from("designations")
          .select("id, name")
          .in("id", Array.from(allDesigIds));
        for (const d of extraDs ?? []) desigMap.set(d.id, d.name as string);
      }

      // Load ALL enabled payroll day bases (referenced by contract resources
      // AND by cost-component / allowance divisors pdb:<uuid>). Mirrors the
      // payroll route so invoice base-day math never diverges from payroll.
      const { data: pdbs } = await supabase
        .from("payroll_day_bases")
        .select("id, method, fixed_days, weekly_off_day, included_weekdays, enabled");
      type PdbMethod = "actual_days" | "fixed_days" | "actual_minus_weekly_off" | "custom_weekdays" | "fixed_annual_average" | "actual_minus_days";
      const pdbMap = new Map<string, NonNullable<ContractResourceLike["payrollDayBase"]>>(
        (pdbs ?? []).map((p) => [
          p.id,
          {
            method: p.method as PdbMethod,
            fixedDays: p.fixed_days,
            weeklyOffDay: p.weekly_off_day,
            includedWeekdays: Array.isArray((p as unknown as { included_weekdays?: unknown }).included_weekdays)
              ? ((p as unknown as { included_weekdays: unknown[] }).included_weekdays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))
              : null,
          },
        ]),
      );
      // Billing-days rules are configured separately from payroll days: the
      // invoice prints payroll days, but the hourly rate divisor uses the
      // billing-days basis when one is set on the contract resource.
      const { data: bdbs } = await supabase
        .from("billing_day_bases" as never)
        .select("id, method, fixed_days, weekly_off_day, included_weekdays, enabled");
      const bdbMap = new Map<string, NonNullable<ContractResourceLike["payrollDayBase"]>>(
        ((bdbs ?? []) as unknown as Record<string, unknown>[]).map((p) => [
          String(p.id),
          {
            method: p.method as PdbMethod,
            fixedDays: p.fixed_days == null ? null : Number(p.fixed_days),
            weeklyOffDay: p.weekly_off_day == null ? null : Number(p.weekly_off_day),
            includedWeekdays: Array.isArray(p.included_weekdays)
              ? (p.included_weekdays as unknown[]).map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
              : null,
          },
        ]),
      );
      const billingDayBaseByDesignation = new Map<string, NonNullable<ContractResourceLike["payrollDayBase"]>>();
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        const bid = r.billing_day_base_id ? String(r.billing_day_base_id) : "";
        if (!did || !bid) continue;
        const base = bdbMap.get(bid);
        if (base) billingDayBaseByDesignation.set(did, base);
      }

      const dayBases = (pdbs ?? []).map((p) => ({
        id: String(p.id),
        method: p.method as PdbMethod,
        fixedDays: p.fixed_days,
        weeklyOffDay: p.weekly_off_day,
        includedWeekdays: Array.isArray((p as unknown as { included_weekdays?: unknown }).included_weekdays)
          ? ((p as unknown as { included_weekdays: unknown[] }).included_weekdays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))
          : null,
      }));


      const resourceByDesignation = new Map<string, ContractResourceLike>();
      // Same designation may exist as an 8h and a 12h line; keep both.
      const resourceByShiftKey = new Map<string, ContractResourceLike>();
      const shiftKeysOrdered: string[] = [];
      const shiftsByDesignation = new Map<string, Set<number>>();
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        if (!did) continue;
        const sk = shiftKey(did, r.shift_hours);
        const set = shiftsByDesignation.get(did) ?? new Set<number>();
        set.add(normShift(r.shift_hours));
        shiftsByDesignation.set(did, set);
        shiftKeysOrdered.push(sk);
        resourceByShiftKey.set(sk, {
          designationId: did,
          components: Array.isArray(r.components)
            ? (r.components as {
                name: string;
                amount: number;
                allowanceId?: string | null;
                includeInOt?: boolean | null;
                formulaMode?: string | null;
                formulaExpression?: string | null;
                formulaVersion?: number | null;
              }[]).map((c) => ({
                ...c,
                name: String(c.name ?? ""),
                amount: Number(c.amount) || 0,
                allowanceId: c.allowanceId ?? null,
                includeInOt: c.includeInOt,
                formulaMode: c.formulaMode ?? null,
                formulaExpression: c.formulaExpression ?? null,
                formulaVersion: c.formulaVersion ?? null,
              }))
            : [],
          benefits: Array.isArray(r.benefits) ? (r.benefits as { name: string; amount: number }[]) : [],
          deductions: Array.isArray(r.deductions) ? (r.deductions as { name: string; amount: number; allowanceId?: string | null; costComponentId?: string | null }[]) : [],
          employerContributions: Array.isArray(r.employer_contributions)
            ? (r.employer_contributions as { name: string; amount: number; allowanceId?: string | null; costComponentId?: string | null }[])
            : [],
          otMultiplier: Number((r as any).ot_multiplier ?? 1) || 1,
          payrollDayBase: r.payroll_day_base_id
            ? pdbMap.get(String(r.payroll_day_base_id)) ?? null
            : null,
        });
        if (!resourceByDesignation.has(did)) resourceByDesignation.set(did, resourceByShiftKey.get(sk)!);
      }

      // Overlay latest formula_mode/expression/version from Control Center
      // masters so paysheets/invoices reflect master-formula edits without
      // requiring contracts to be re-saved.
      const uniqueShiftKeys = Array.from(new Set(shiftKeysOrdered));
      const hydratedList = (
        await hydrateFormulasFromMaster(uniqueShiftKeys.map((k) => resourceByShiftKey.get(k)!))
      ).map(refreshBillingAddOns);
      resourceByDesignation.clear();
      hydratedList.forEach((r, i) => {
        resourceByShiftKey.set(uniqueShiftKeys[i], r);
        if (!resourceByDesignation.has(r.designationId)) resourceByDesignation.set(r.designationId, r);
      });
      const shiftForDesignationDefault = new Map<string, number>();
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        if (did && !shiftForDesignationDefault.has(did)) shiftForDesignationDefault.set(did, normShift(r.shift_hours));
      }
      const postingShift = new Map<string, number>();
      for (const l of (links ?? []) as unknown as { candidate_id: string; shift_hours?: number | null }[]) {
        if (l.shift_hours != null) postingShift.set(l.candidate_id, normShift(l.shift_hours));
      }
      const billingBaseByShiftKey = new Map<string, NonNullable<ContractResourceLike["payrollDayBase"]>>();
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        const bid = r.billing_day_base_id ? String(r.billing_day_base_id) : "";
        const base = bid ? bdbMap.get(bid) : undefined;
        if (did && base) billingBaseByShiftKey.set(shiftKey(did, r.shift_hours), base);
      }
      /** Pick the contract line for this guard: posting shift first, else the designation default. */
      const lineFor = (cid: string, did: string, lineShift?: number) => {
        const offered = shiftsByDesignation.get(did);
        const wanted = lineShift === 8 || lineShift === 12 ? lineShift : postingShift.get(cid);
        const shift = wanted && offered?.has(wanted) ? wanted : (shiftForDesignationDefault.get(did) ?? 8);
        const sk = shiftKey(did, shift);
        return {
          shift,
          resource: resourceByShiftKey.get(sk) ?? resourceByDesignation.get(did),
          billingBase: billingBaseByShiftKey.get(sk) ?? null,
        };
      };

      // 4. Build line items per (candidate, designation_id).
      // Each candidate gets a primary line (their own designation) plus an extra
      // line for any other designation found in their attendance entries.
      const rosterById = new Map(roster.map((c) => [c.id, c]));
      const pairKey = (cid: string, did: string | null, sh = 0) => `${cid}|${did ?? "__none__"}|${sh}`;
      const entryShift = (e: unknown) => Number((e as { shift_hours?: number | null }).shift_hours) || 0;
      // Regular vs reliever is decided by the attendance line itself
      // (attendance_entries.is_reliever), never by the profile designation.
      const entryReliever = (e: unknown) => Boolean((e as { is_reliever?: boolean | null }).is_reliever);
      const lineKey = (cid: string, did: string | null, sh: number, rel: boolean) => `${pairKey(cid, did, sh)}|${rel ? "R" : "N"}`;
      const pairs = new Map<string, { candidateId: string; designationId: string | null; shift: number; reliever: boolean }>();

      for (const c of roster) {
        const sh = postingShift.get(c.id) ?? 0;
        const k = lineKey(c.id, c.designation_id ?? null, sh, false);
        pairs.set(k, { candidateId: c.id, designationId: c.designation_id ?? null, shift: sh, reliever: false });
      }
      const entryCountByLine = new Map<string, number>();
      for (const e of entries) {
        if (!rosterById.has(e.candidate_id)) continue;
        const rel = entryReliever(e);
        const k = lineKey(e.candidate_id, e.designation_id, entryShift(e), rel);
        entryCountByLine.set(k, (entryCountByLine.get(k) ?? 0) + 1);
        if (!pairs.has(k)) pairs.set(k, { candidateId: e.candidate_id, designationId: e.designation_id, shift: entryShift(e), reliever: rel });
      }
      // One regular line per person carries PH credit and day adjustments:
      // their own-designation line when it has attendance, else their busiest regular line.
      const mainLineByCandidate = new Map<string, string>();
      for (const [k, p] of pairs) {
        if (p.reliever) continue;
        const c = rosterById.get(p.candidateId)!;
        const cur = mainLineByCandidate.get(p.candidateId);
        const score = (key: string, pp: typeof p) =>
          (entryCountByLine.get(key) ?? 0) * 2 + ((c.designation_id ?? null) === pp.designationId ? 1 : 0);
        if (!cur || score(k, p) > score(cur, pairs.get(cur)!)) mainLineByCandidate.set(p.candidateId, k);
      }

      const rows = Array.from(pairs.entries()).map(([pk, p]) => {
        const c = rosterById.get(p.candidateId)!;
        const did = p.designationId ? String(p.designationId) : "";
        const designationName = (p.designationId && desigMap.get(p.designationId)) || "—";
        // Filter entries to just this line so totals reflect only that line.
        const lineEntries = entries.filter(
          (e) =>
            e.candidate_id === p.candidateId &&
            (e.designation_id ?? null) === p.designationId &&
            entryShift(e) === p.shift &&
            entryReliever(e) === p.reliever,
        );
        const isPrimary = !p.reliever && mainLineByCandidate.get(p.candidateId) === pk;
        const isRegular = !p.reliever;
        // PH credit belongs to the employee's primary line only — reliever
        // lines must not earn a second credit for the same holiday.
        const totals = computeAttendanceTotals(
          c.id,
          periodDates,
          lineEntries as AttendanceEntryLike[],
          (codes ?? []) as AttendanceCodeLike[],
          isPrimary ? phConfig : null,
          (c as { preferred_joining_date?: string | null }).preferred_joining_date ?? null,
          unitPh?.dayValue ?? null,
        );
        // Apply per-employee day adjustments — primary designation line only.
        if (isPrimary) {
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
        const resource = line.resource;
        const phOverride = isPrimary ? phCashByCandidate.get(c.id) : undefined;
        const wages = resource
          ? computeWages(totals, resource, periodDates.length, {
              phOverrideAmount: phOverride,
              periodDates: periodDates.map((d) => new Date(d)),
              dayBases,
              epfCapEnabled,
            })
          : null;
        const candidateGender = ((c as unknown as { gender?: string | null }).gender ?? "").toString();
        const candidateIsDisabled = Boolean((c as unknown as { is_disabled?: boolean | null }).is_disabled);
        if (wages && isPrimary) {
          const extraAdds = additionsByCandidate.get(c.id) ?? [];
          const extraDeds = deductionsByCandidate.get(c.id) ?? [];
          if (extraDeds.length > 0) {
            wages.deductions = [...wages.deductions, ...extraDeds];
          }
          // Same additions step as the payroll register (proration, ESI/PF flags).
          const applied = applyEmployeeAdditions(wages, extraAdds, totals.pDays, { isDisabled: candidateIsDisabled });
          Object.assign(wages, applied.wages);
          (wages as unknown as { additions: PerEmpItem[] }).additions = applied.additions;
          const pt = resolvePtAmount({
            state: unitState,
            pincode: unitPincode,
            gender: candidateGender,
            earnedGross: wages.earnedGross,
            slabs: (ptSlabs ?? []) as PtSlabLike[],
            ranges: (pincodeRanges ?? []) as PincodeRangeLike[],
          });
          Object.assign(wages, applyPtToWageComputation(wages, pt.amount));

          // LWF from Control Center master (live-synced with payroll).
          if (lwfRows && pincodeRanges) {
            const lwfRes = resolveLwf(String(unitPincode ?? ""), pincodeRanges as never, lwfRows, unitState);
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

          // Statutory EPF employer split (EPS + EPF); total unchanged.
          Object.assign(wages, applyEpfBreakdownToWageComputation(wages, { epfCapEnabled }));
        }

        // Merge split components (e.g. "HRA 5%" + "HRA 15%" -> "HRA") across
        // contract config and computed wages so invoice tables/exports show
        // a single column per canonical component. Totals are unchanged.
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
          rowKey: pk,
          employeeCode: c.employee_code || "",
          joiningDate:
            ((c as { preferred_joining_date?: string | null }).preferred_joining_date ?? null) as string | null,
          name: c.full_name || "—",
          designation: designationName,
          designationId: p.designationId,
          isPrimary,
          isRegular,
          shiftHours: line.shift,
          billingDayBase: line.billingBase,
          totals,
          wages,
          resource: mergedResource ?? resource ?? null,
          hasContract: !!resource,
        };
      });

      rows.sort((a, b) => {
        const an = (a.employeeCode || a.name).localeCompare(b.employeeCode || b.name);
        if (an !== 0) return an;
        // primary first, then by designation name
        if (a.isRegular !== b.isRegular) return a.isRegular ? -1 : 1;
        return a.designation.localeCompare(b.designation);
      });

      const shiftHoursByDesignation = new Map<string, number>();
      for (const r of resources) {
        const h = Number((r as { shift_hours?: unknown }).shift_hours);
        shiftHoursByDesignation.set(
          String(r.designation_id ?? "__none__"),
          Number.isFinite(h) && h > 0 ? h : 8,
        );
      }

      return { rows, billingMode, shiftHoursByDesignation, billingDayBaseByDesignation, contractId: contractId ?? null };
  })();
  const rows=data.rows; const billingMode=data.billingMode; const shiftHoursByDesignation=data.shiftHoursByDesignation; const billingDayBaseByDesignation=data.billingDayBaseByDesignation;
  const invoiceMathFor = (r: (typeof rows)[number]) => {
    const contracted = r.resource ? contractBillableMonthly(r.resource as never) : 0;

    const payrollDays =
      resolvePayrollDayCount(r.resource?.payrollDayBase ?? null, periodDates) ??
      (r.wages?.baseDays || periodDates.length || 30);
    // Days printed on the invoice always come from the payroll-days rule.
    // The hourly-rate divisor uses the billing-days rule when configured.
    const billingDays =
      resolvePayrollDayCount(
        r.billingDayBase ?? billingDayBaseByDesignation.get(String(r.designationId ?? "")) ?? r.resource?.payrollDayBase ?? null,
        periodDates,
        // A billing divisor is a contractual constant (e.g. 30.40), so it is
        // never clamped down to the number of days in the cycle.
        { clampToPeriod: false },
      ) ?? payrollDays;

    const billedDays = Math.round((r.totals.tDays ?? 0) * 100) / 100;
    // The billing UNIT comes from the contract's billing type — never assumed.
    //   man_days   → rate per duty  = contracted ÷ billing days (2 dp), × duties
    //   man_hours  → rate per hour  = contracted ÷ billing days ÷ shift hrs, × hrs
    //   man_months / lumpsum → the full contracted value
    // The 2 dp rounding happens on the rate that is actually printed, so the
    // printed rate × printed quantity always reconciles with the amount.
    const shiftHours = r.shiftHours ?? shiftHoursByDesignation.get(String(r.designationId ?? "__none__")) ?? 8;
    const perHour =
      billingDays > 0 && shiftHours > 0
        ? Math.round((contracted / billingDays / shiftHours) * 100) / 100
        : 0;
    const perDay = billingDays > 0 ? Math.round((contracted / billingDays) * 100) / 100 : 0;
    const billedHours = Math.round(billedDays * shiftHours * 100) / 100;
    const billsHourly = billingMode === "man_hours";
    const unitRate = billsHourly ? perHour : perDay;
    const unitQuantity = billsHourly ? billedHours : billedDays;
    const unitLabel = billsHourly ? "hrs" : "Duty";
    const actual =
      !r.wages || !r.resource
        ? 0
        : billingMode === "lumpsum" || billingMode === "man_months"
          ? contracted
          : Math.round(unitRate * unitQuantity * 100) / 100;
    return {
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
  };



  const lines=rows.filter((r:any)=>r.wages).map((r:any)=>{const m=invoiceMathFor(r);return {emp:r.employeeCode,des:r.designation,days:m.billedDays,qty:m.unitQuantity,rate:m.unitRate,amt:m.actual,unit:m.unitLabel}});
  const { data: ex } = await supabase.from("invoice_extra_charges").select("*").eq("unit_id",unitId);
  return {billingMode,lines,taxable:Math.round(lines.reduce((s:number,l:any)=>s+l.amt,0)*100)/100,extras:ex??[]};
}
