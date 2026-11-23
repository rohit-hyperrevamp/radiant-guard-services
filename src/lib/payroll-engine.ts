/**
 * Payroll register for one site and period — the payroll page's own
 * calculation, moved here verbatim so the payroll page and the payroll list
 * compute pay the same way. Never re-implement payroll pay elsewhere.
 */
import { withContractEdRule } from "@/lib/ed-rule";
import { fetchPeriodContract } from "@/lib/period-contract";
import { fetchAttendedCandidateIds } from "@/lib/period-roster";
import { mergePayItems } from "@/lib/pay-item-names";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { normShift, shiftKey } from "@/lib/shift-resources";
import { applyRateRevisionsForPeriod } from "@/lib/rate-revisions";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import {
  applyEpfBreakdownToWageComputation,
  applyEmployeeAdditions,
  applyLwfToWageComputation,
  applyPtToWageComputation,
  computeAttendanceTotals,
  computeWages,
  resolvePtAmount,
  roundFinalGross,
  roundEsiUp,
  type AttendanceCodeLike,
  type AttendanceEntryLike,
  type ContractResourceLike,
  type PincodeRangeLike,
  type PtSlabLike,
  EXTRA_DUTY_COMPONENT_RE,
  normalizeOtEsi,
} from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { employerCostOnly, managementFeeOf } from "@/lib/contract-billing-addons";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { fetchOtherSitePtTotals, fetchOtherSitesWorked, fetchPtAllocations, ptForSite } from "@/lib/pt-cross-site";

// Ledger names for one-off additions/deductions are stored as
// "<code> - <name> - <date>" (e.g. "41084 - Uniform - 2026-05-01").
// For display and exports we only want the middle "<name>" segment.
export function cleanLedgerName(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 3) return parts[1].trim() || s;
  return s;
}

const PT_COMPONENT_RE = /\bprofessional\s*tax\b|\bp\.?\s*tax\b|\bpt\b/i;

export type PayrollUnitInput = {
  unitId: string;
  start: string;
  end: string;
  periodDates: string[];
  ptState: string | null;
  ptPincode: string | null;
  epfCapEnabled: boolean;
  esiRoundUp: boolean;
  woAsPresent: boolean;
  unitPh: { enabled: boolean; multiplier: number; excluded: string[]; excludedDays: string[]; dayValue: number | null } | null | undefined;
  phConfig: { dates: string[]; multiplier: number } | null;
  ptSlabs: PtSlabLike[] | undefined;
  pincodeRanges: PincodeRangeLike[] | undefined;
  lwfRows: LwfRow[] | undefined;
};

type AnyRow = Record<string, any>;

/**
 * Preloaded reads for one site (bulk loading). Each field is exactly what the
 * corresponding single-site query returns; absent = query it as the page does.
 */
export type PayrollUnitSource = {
  primary: AnyRow[];
  linkIds: string[];
  secondary: AnyRow[];
  /** Attended-but-not-rostered people (fetchAttendedCandidateIds rule). */
  attendedIds: string[];
  people: Map<string, AnyRow>;
  designations: Map<string, string>;
  entries: AnyRow[];
  codes: AnyRow[];
  periodContract: AnyRow | null;
  /** Contract lines in stored order, rate revisions already applied. */
  resources: AnyRow[];
  additions: AnyRow[];
  deductions: AnyRow[];
  /** Answers the page's prior-attendance query for these candidates. */
  priorAttendance: (candidateIds: string[]) => Promise<{ candidate_id: string }[]>;
  addTypes: AnyRow[];
  pdbs: AnyRow[];
  hydrate: <T extends ContractResourceLike>(list: T[]) => T[];
  postingShifts: { candidate_id: string; shift_hours: number }[];
  employeeWages: AnyRow[];
  otherSitePt: Map<string, { gross: number; pt: number }>;
  ptAllocated: Map<string, number>;
};

export async function computePayrollUnitRows(input: PayrollUnitInput, src?: PayrollUnitSource) {
  const { unitId, start, end, periodDates, ptState, ptPincode, epfCapEnabled, esiRoundUp, woAsPresent, unitPh, phConfig, ptSlabs, pincodeRanges, lwfRows } = input;
  if (!src) await supabaseSessionReady();
  // 1. Roster: candidates mapped to this unit (primary + secondary).
  const candidateCols =
    "id, employee_code, full_name, designation_id, gender, is_disabled, bank_account_holder, bank_account_number, bank_ifsc, bank_name, bank_branch, approved_at, preferred_joining_date, application_date, pan_number, compliance";
  const [{ data: primary }, { data: links }] = src ? [{ data: src.primary as any[] }, { data: src.linkIds.map((candidate_id) => ({ candidate_id })) }] : await Promise.all([
    supabase
      .from("candidates")
      .select(candidateCols)
      .eq("unit_id", unitId)
      .eq("is_enabled", true)
      .eq("status", "active"),
    supabase.from("candidate_units").select("candidate_id").eq("unit_id", unitId),
  ]);
  const linkIds = (links ?? []).map((l) => l.candidate_id);
  let secondary: typeof primary = [];
  if (src) secondary = src.secondary as typeof primary;
  else if (linkIds.length > 0) {
    const { data } = await supabase
      .from("candidates")
      .select(candidateCols)
      .in("id", linkIds)
      .eq("is_enabled", true)
      .eq("status", "active");
    secondary = data ?? [];
  }
  const roster = Array.from(
    new Map([...(primary ?? []), ...(secondary ?? [])].map((c) => [c.id, c])).values(),
  );
  // People who worked here this period but have since left/been disabled
  // are still paid for the days they worked.
  {
    const have = new Set(roster.map((c) => c.id));
    const attended = (src ? src.attendedIds : await fetchAttendedCandidateIds(unitId, start, end)).filter((id) => !have.has(id));
    if (attended.length) {
      const { data: leavers } = src
        ? { data: attended.map((id) => src.people.get(id)).filter(Boolean) }
        : await supabase.from("candidates").select(candidateCols).in("id", attended);
      roster.push(...((leavers ?? []) as typeof roster));
    }
  }

  const designationIds = Array.from(
    new Set(roster.map((c) => c.designation_id).filter(Boolean)),
  ) as string[];
  const { data: designations } = src
    ? { data: designationIds.filter((id) => src.designations.has(id)).map((id) => ({ id, name: src.designations.get(id)! })) }
    : await supabase
      .from("designations")
      .select("id, name")
      .in("id", designationIds.length ? designationIds : ["00000000-0000-0000-0000-000000000000"]);
  const desigMap = new Map((designations ?? []).map((d) => [d.id, d.name as string]));

  // 2. Attendance entries (fetched per day to avoid backend row caps)
  const entries = (src ? src.entries.map((e) => ({ ...e })) : await fetchAttendanceEntriesForPeriod({ unitId, start, end })) as Array<{
    candidate_id: string;
    designation_id: string | null;
    entry_date: string;
    code: string;
    ot_hours: number | string | null;
  }>;

  const { data: codes } = src ? { data: src.codes as any[] } : await supabase
    .from("attendance_codes")
    .select("code, counts_as_present, is_paid, day_value")
    .eq("enabled", true);

  // 3. Contract resources for this unit's active contract.
  const periodContract = src ? src.periodContract : await fetchPeriodContract<Record<string, unknown>>(unitId, start, end, "id, payroll_window_id");
  const contracts = periodContract ? [periodContract as any] : [];
  const contractId = contracts?.[0]?.id;

  let resources: Record<string, unknown>[] = [];
  if (src) resources = contractId ? src.resources : [];
  else if (contractId) {
    const { data: r } = await supabase
      .from("contract_resources")
      .select(
        "id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id, shift_hours, ot_multiplier, ot_basis, ot_formula, ot_esi, ot_hourly_rate, ot_hourly_esic",
      )
      .eq("contract_id", contractId);
    resources = ((r ?? []) as unknown) as Record<string, unknown>[];
    resources = await applyRateRevisionsForPeriod(resources as Record<string, unknown>[], start, end);
  }

  // 3b. Per-employee Additions & Deductions (Control Center catalog).
  // Pull anything dated within the payroll period and still active.
  const candidateIds = roster.map((c) => c.id);
  type PerEmpItem = { name: string; amount: number; prorate?: boolean; countsForPf?: boolean; countsForEsi?: boolean; formula?: string | null; inputs?: { amount?: number; days?: number; per_day?: number } };
  type DayAdj = { pDays: number; otDays: number; phDays: number; otherPaidDays: number; tDays: number };
  const additionsByCandidate = new Map<string, PerEmpItem[]>();
  const deductionsByCandidate = new Map<string, PerEmpItem[]>();
  const dayAdjustmentByCandidate = new Map<string, DayAdj>();
  const phDisplayCountByCandidate = new Map<string, number>();
  // PH cash override: user-entered PH addition amount is paid as-is on
  // the "Paid Holiday" line (bypasses the engine's perDayRate × phCount).
  const phCashByCandidate = new Map<string, number>();
  if (candidateIds.length > 0) {
    const [addsRes, dedsRes, priorAttendanceRes, addTypesRes] = src ? [
      { data: src.additions },
      { data: src.deductions },
      { data: await src.priorAttendance(candidateIds) },
      { data: src.addTypes },
    ] : await Promise.all([
      supabase
        .from("additions" as never)
        .select("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi, formula_expression, per_day_amount")
        .in("candidate_id", candidateIds)
        .lte("addition_date", end)
        .or(`addition_date.gte.${start},and(repeat_monthly.eq.true,or(end_date.is.null,end_date.gte.${start}))`)
        .or(`unit_id.is.null,unit_id.eq.${unitId}`)
        .eq("status", "active"),

      supabase
        .from("deductions" as never)
        .select("candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, deduction_date")
        .in("candidate_id", candidateIds)
        .lte("deduction_date", end)
        .eq("status", "active")
        .or(`unit_id.is.null,unit_id.eq.${unitId}`),
      // A joining fee dated before the employee's first attended payroll
      // window must be carried into that first window rather than lost.
      // Knowing who already attended before this period prevents the
      // one-time fee from repeating in later payrolls.
      supabase
        .from("attendance_entries")
        .select("candidate_id")
        .eq("unit_id", unitId)
        .in("candidate_id", candidateIds)
        .lt("entry_date", start),
      supabase.from("addition_types").select("id, code"),
    ]);
    const phTypeIds = new Set<string>(
      ((addTypesRes.data ?? []) as { id: string; code: string | null }[])
        .filter((t) => (t.code ?? "").toLowerCase() === "paid_holidays")
        .map((t) => t.id),
    );
    type RawAdd = { candidate_id: string; addition_type_id?: string | null; addition_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; source_kind?: string | null; repeat_monthly?: boolean | null; prorate_by_days?: boolean | null; counts_for_pf?: boolean | null; counts_for_esi?: boolean | null; formula_expression?: string | null; per_day_amount?: number | string | null };
    type RawDed = { candidate_id: string; deduction_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; source_kind?: string | null; deduction_date: string };
    // Carry-forward from an amended earlier payroll: flag it on the line so
    // the register shows it came from a previous month.
    const carryLabel = (name: string, sourceKind: string | null | undefined) =>
      sourceKind === "payroll_amendment" ? `${name} — previous period` : name;

    const candidatesWithPriorAttendance = new Set(
      ((priorAttendanceRes.data ?? []) as { candidate_id: string }[]).map((row) => row.candidate_id),
    );
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
    // System-computed day buckets: when an addition/deduction affects
    // these buckets via day-adjustments, the cash value is recomputed
    // by computeWages from the contract gross (perDayRate × days for PH,
    // perDutyOt × days for OT). Pushing the manual amount as a cash
    // addition would double-count, so we suppress it and rely on the
    // engine. Buckets like 'present'/'worked'/'other' don't have a
    // built-in cash line, so we still keep the addition row for those.
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
        // PH-type addition: pay the user-entered amount directly on the
        // Paid Holiday line; bump the PH Days display count; skip the
        // generic cash-addition row and day-adjustment paths so we
        // don't double-count.
        phCashByCandidate.set(
          a.candidate_id,
          (phCashByCandidate.get(a.candidate_id) ?? 0) + amt,
        );
        const phDelta = Math.max(1, Number(a.days) || 1);
        phDisplayCountByCandidate.set(
          a.candidate_id,
          (phDisplayCountByCandidate.get(a.candidate_id) ?? 0) + phDelta,
        );
        continue;
      }
      const isDayAdj = isSystemComputedDayAdj(a.entry_mode, a.include_in_total_days, a.affects_days_for);
      if (!isDayAdj) {
        const arr = additionsByCandidate.get(a.candidate_id) ?? [];
        const recurring = !!a.repeat_monthly;
        arr.push({
          name: carryLabel(cleanLedgerName(a.addition_name), a.source_kind),
          amount: Math.round((recurring ? Number(a.amount) || 0 : amt) * 100) / 100,
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
    // A one-time joining fee may be dated a few days before the window
    // opens (e.g. joined 5 Jun, window starts 26 Jun). Carry it forward
    // ONLY for genuinely new joiners — i.e. the joining date falls after
    // the previous window's start, so no earlier payroll could have
    // billed it. Long-tenured staff never re-pay a joining fee, and their
    // GPAIP is picked up in the window containing their anniversary.
    const prevWindowStart = (() => {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const joiningDateByCandidate = new Map<string, string | null>(
      roster.map((c) => [
        c.id,
        ((c as unknown as Record<string, unknown>)["preferred_joining_date"] as string | null) ?? null,
      ]),
    );
    for (const d of ((dedsRes.data ?? []) as unknown as RawDed[])) {
      const isInPeriod = d.deduction_date >= start;
      const joined = joiningDateByCandidate.get(d.candidate_id) ?? null;
      const isNewJoiner = !!joined && joined >= prevWindowStart;
      const isFirstWindowJoiningFee = d.source_kind === "unit_fee"
        && isNewJoiner
        && d.deduction_date >= (joined as string)
        && !candidatesWithPriorAttendance.has(d.candidate_id);
      if (!isInPeriod && !isFirstWindowJoiningFee) continue;

      const inst = Math.max(1, Number(d.installments) || 1);
      const rawAmt = (Number(d.amount) || 0) / inst;
      // Gross amendment recoveries are stored as a negative employee net
      // impact in the ledger. In payroll they must still increase the
      // deduction bucket, unlike negative statutory rows (which are
      // genuine refunds and must reduce that bucket).
      const isGrossAmendmentRecovery = d.source_kind === "payroll_amendment"
        && /^gross deduction\b/i.test(cleanLedgerName(d.deduction_name));
      const amt = isGrossAmendmentRecovery ? Math.abs(rawAmt) : rawAmt;
      const isDayAdj = isSystemComputedDayAdj(d.entry_mode, d.include_in_total_days, d.affects_days_for);
      if (!isDayAdj) {
        const arr = deductionsByCandidate.get(d.candidate_id) ?? [];
        arr.push({ name: carryLabel(cleanLedgerName(d.deduction_name), d.source_kind), amount: Math.round(amt * 100) / 100 });
        deductionsByCandidate.set(d.candidate_id, arr);
      }
      if (d.entry_mode === "days_x_per_day" && d.include_in_total_days) {
        applyDayAdj(d.candidate_id, Number(d.days) || 0, d.affects_days_for, -1);
      }
    }

  }


  // Coerce attendance entries missing a designation to the candidate's
  // primary designation so they roll into a real contract-resource line
  // instead of a phantom "no designation" row that shows ₹0.
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
  if (src) {
    for (const id of allDesigIds) { const n = src.designations.get(id); if (n) desigMap.set(id, n); }
  } else if (allDesigIds.size > 0) {
    const { data: extraDs } = await supabase
      .from("designations")
      .select("id, name")
      .in("id", Array.from(allDesigIds));
    for (const d of extraDs ?? []) desigMap.set(d.id, d.name as string);
  }

  // Load ALL enabled payroll day bases — referenced by contract resources
  // AND by cost component / allowance divisors (pdb:<uuid>).
  const { data: pdbs } = src ? { data: src.pdbs as any[] } : await supabase
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
  const resourceByShiftKey = new Map<string, ContractResourceLike>();
  const shiftKeysOrdered: string[] = [];
  const shiftsByDesignation = new Map<string, Set<number>>();
  const shiftForDesignationDefault = new Map<string, number>();
  for (const r of resources) {
    const did = String(r.designation_id ?? "");
    if (!did) continue;
    const sk = shiftKey(did, (r as { shift_hours?: unknown }).shift_hours);
    const set = shiftsByDesignation.get(did) ?? new Set<number>();
    set.add(normShift((r as { shift_hours?: unknown }).shift_hours));
    shiftsByDesignation.set(did, set);
    if (!shiftForDesignationDefault.has(did)) shiftForDesignationDefault.set(did, normShift((r as { shift_hours?: unknown }).shift_hours));
    shiftKeysOrdered.push(sk);
    resourceByShiftKey.set(sk, {
      designationId: did,
      components: Array.isArray(r.components)
        ? (r.components as { name: string; amount: number; allowanceId?: string | null; includeInOt?: boolean; formulaMode?: string | null; formulaExpression?: string | null; formulaVersion?: number | null }[]).map((c) => ({
            // Keep every line setting (rounding, per-duty / lump-sum method,
            // divisor) — dropping them silently changed earned amounts.
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
      benefits: Array.isArray(r.benefits) ? (r.benefits as { name: string; amount: number; formulaMode?: string | null; formulaExpression?: string | null }[]) : [],
      deductions: Array.isArray(r.deductions)
        ? (r.deductions as { name: string; amount: number; allowanceId?: string | null; costComponentId?: string | null; deductionCalcType?: "earned_salary" | "fixed_amount"; formulaMode?: string | null; formulaExpression?: string | null }[])
        : [],
      employerContributions: Array.isArray(r.employer_contributions)
        ? (r.employer_contributions as { name: string; amount: number; allowanceId?: string | null; costComponentId?: string | null; deductionCalcType?: "earned_salary" | "fixed_amount"; formulaMode?: string | null; formulaExpression?: string | null }[])
        : [],
      otMultiplier: Number((r as { ot_multiplier?: unknown }).ot_multiplier ?? 1) || 1,
      otBasis: ((r as { ot_basis?: string | null }).ot_basis ?? "components") as "components" | "gross" | "earned_gross" | "formula" | "hourly",
      otFormula: (r as { ot_formula?: string | null }).ot_formula ?? null,
      otHourlyRate: (r as { ot_hourly_rate?: number | null }).ot_hourly_rate ?? null,
      otHourlyEsic: (r as { ot_hourly_esic?: number | null }).ot_hourly_esic ?? null,
      otShiftHours: ([8,10,12].includes(Number(Number((r as { shift_hours?: number | null }).shift_hours))) ? (Number(Number((r as { shift_hours?: number | null }).shift_hours)) as 8 | 10 | 12) : 8),
      otEsi: normalizeOtEsi((r as { ot_esi?: unknown }).ot_esi),
      payrollDayBase: r.payroll_day_base_id
        ? pdbMap.get(String(r.payroll_day_base_id)) ?? null
        : null,
    });
  }

  // Hydrate formula_mode/expression/version from Control Center masters
  // so payroll always reflects the LATEST master formula — even when the
  // contract snapshot pre-dates the formula engine. Per-line `amount`
  // (the agreed monetary base) stays from the snapshot.
  const uniqueShiftKeys = Array.from(new Set(shiftKeysOrdered));
  const hydratedList = src
    ? src.hydrate(uniqueShiftKeys.map((k) => resourceByShiftKey.get(k)!))
    : await hydrateFormulasFromMaster(uniqueShiftKeys.map((k) => resourceByShiftKey.get(k)!));
  hydratedList.forEach((r, i) => {
    resourceByShiftKey.set(uniqueShiftKeys[i], r);
    if (!resourceByDesignation.has(r.designationId)) resourceByDesignation.set(r.designationId, r);
  });
  const postingShiftRes = src ? { data: src.postingShifts } : await supabase
    .from("candidate_units")
    .select("candidate_id, shift_hours" as never)
    .eq("unit_id", unitId)
    .not("shift_hours" as never, "is", null);
  const postingShift = new Map<string, number>();
  for (const l of ((postingShiftRes.data ?? []) as unknown as { candidate_id: string; shift_hours: number }[])) {
    postingShift.set(l.candidate_id, normShift(l.shift_hours));
  }
  const resourceForLine = (cid: string, did: string, lineShift?: number) => {
    const offered = shiftsByDesignation.get(did);
    const wanted = [8, 10, 12].includes(Number(lineShift)) ? lineShift : postingShift.get(cid);
    const shift = wanted && offered?.has(wanted) ? wanted : (shiftForDesignationDefault.get(did) ?? 8);
    return resourceByShiftKey.get(shiftKey(did, shift)) ?? resourceByDesignation.get(did);
  };

  // 3c. Per-employee wage sheets (non-billable employees). These override
  // the contract resource: a non-billable employee is not deployed against
  // a client contract, their wages are their own.
  const resourceByCandidate = new Map<string, ContractResourceLike>();
  {
    const rosterIds = roster.map((c) => c.id);
    if (rosterIds.length > 0) {
      const { data: ew } = src ? { data: src.employeeWages.filter((w) => rosterIds.includes(String(w.candidate_id))) } : await supabase
        .from("employee_wages" as never)
        .select(
          "candidate_id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id",
        )
        .in("candidate_id", rosterIds);
      const raw = ((ew ?? []) as unknown) as Record<string, unknown>[];
      for (const r of raw) {
        resourceByCandidate.set(String(r.candidate_id), {
          designationId: String(r.designation_id ?? ""),
          components: Array.isArray(r.components) ? (r.components as ContractResourceLike["components"]) : [],
          benefits: Array.isArray(r.benefits) ? (r.benefits as ContractResourceLike["benefits"]) : [],
          deductions: Array.isArray(r.deductions) ? (r.deductions as ContractResourceLike["deductions"]) : [],
          employerContributions: Array.isArray(r.employer_contributions)
            ? (r.employer_contributions as ContractResourceLike["employerContributions"])
            : [],
          payrollDayBase: r.payroll_day_base_id ? pdbMap.get(String(r.payroll_day_base_id)) ?? null : null,
        });
      }
      if (resourceByCandidate.size > 0) {
        const ids = Array.from(resourceByCandidate.keys());
        const hydratedEw = src
          ? src.hydrate(ids.map((id) => resourceByCandidate.get(id)!))
          : await hydrateFormulasFromMaster(ids.map((id) => resourceByCandidate.get(id)!));
        hydratedEw.forEach((r, i) => resourceByCandidate.set(ids[i], r));
      }
    }
  }

  // 4. Build line items per (candidate, designation_id).
  // Each candidate gets a primary line (their own designation) plus an extra
  // line for any other designation found in their attendance entries.
  const rosterById = new Map(roster.map((c) => [c.id, c]));
  const pairKey = (cid: string, did: string | null, sh = 0) => `${cid}|${did ?? "__none__"}|${sh}`;
  const entryShift = (e: unknown) => Number((e as { shift_hours?: number | null }).shift_hours) || 0;
  const pairs = new Map<string, { candidateId: string; designationId: string | null; shift: number }>();

  for (const c of roster) {
    const sh = postingShift.get(c.id) ?? 0;
    const k = pairKey(c.id, c.designation_id ?? null, sh);
    pairs.set(k, { candidateId: c.id, designationId: c.designation_id ?? null, shift: sh });
  }
  for (const e of entries) {
    if (!rosterById.has(e.candidate_id)) continue;
    const k = pairKey(e.candidate_id, e.designation_id, entryShift(e));
    if (!pairs.has(k)) pairs.set(k, { candidateId: e.candidate_id, designationId: e.designation_id, shift: entryShift(e) });
  }

  // The line that carries once-a-month items (PH credit, PT, LWF, personal
  // additions/deductions): the employee's home-role line when it has a
  // contract rate here, otherwise their first rated line at this site.
  // Without this, someone whose home role isn't on this contract would
  // never be charged PT or their deductions.
  const carrierByCandidate = new Map<string, string>();
  const carrierRank = new Map<string, number>();
  // Lines with attendance this period — a carrier with no duties is hidden
  // from payroll, which silently dropped PT/deductions (e.g. a Security
  // Guard home role while all duties were as Supervisor/Bouncer).
  const attendedLines = new Set<string>();
  for (const e of entries) attendedLines.add(pairKey(e.candidate_id, e.designation_id, entryShift(e)));
  for (const p of pairs.values()) {
    const c = rosterById.get(p.candidateId);
    if (!c) continue;
    const did = p.designationId ? String(p.designationId) : "";
    const rated = Boolean(resourceByCandidate.get(c.id) ?? resourceForLine(c.id, did, p.shift));
    const key = pairKey(p.candidateId, p.designationId, p.shift);
    const isHome = (c.designation_id ?? null) === p.designationId;
    // Rank: attended first, then rated home > rated other > unrated home.
    const rank = (attendedLines.has(key) ? 10 : 0) + (rated ? (isHome ? 3 : 2) : isHome ? 1 : 0);
    if (rank > (carrierRank.get(c.id) ?? -1)) {
      carrierRank.set(c.id, rank);
      carrierByCandidate.set(c.id, key);
    }
  }
  // Gross and PT already paid to these people at OTHER sites this month
  // (processed payrolls only). PT is one monthly slab per person, so a
  // guard working two sites is taxed on the combined gross, once.
  const [otherSitePt, otherSitesWorked, ptAllocated] = src
    ? [src.otherSitePt, new Map<string, string[]>(), src.ptAllocated] as const
    : await Promise.all([
    fetchOtherSitePtTotals(candidateIds, unitId, end),
    fetchOtherSitesWorked(candidateIds, unitId, end),
    fetchPtAllocations(candidateIds, unitId, end),
  ]);

  const rows = Array.from(pairs.values()).map((p) => {
    const c = rosterById.get(p.candidateId)!;
    const did = p.designationId ? String(p.designationId) : "";
    const designationName = (p.designationId && desigMap.get(p.designationId)) || "—";
    // Filter entries to just this (candidate, designation) pair so totals reflect only that line.
    const lineEntries = entries.filter(
      (e) =>
        e.candidate_id === p.candidateId &&
        (e.designation_id ?? null) === p.designationId &&
        entryShift(e) === p.shift,
    );
    // Public holiday credit belongs to the employee, not to each line they
    // appear on: a reliever line (designation other than their own) must not
    // earn a second PH credit in the same unit.
    const isPrimaryLine = carrierByCandidate.get(c.id) === pairKey(p.candidateId, p.designationId, p.shift);
    const totals = computeAttendanceTotals(
      c.id,
      periodDates,
      lineEntries as AttendanceEntryLike[],
      (codes ?? []) as AttendanceCodeLike[],
      isPrimaryLine && !(unitPh?.excluded ?? []).includes(String(c.id)) && phConfig
        ? { ...phConfig, dates: Array.from(phConfig.dates).filter((d) => !(unitPh?.excludedDays ?? []).includes(`${c.id}|${d}`)) }
        : null,
      (c as { preferred_joining_date?: string | null }).preferred_joining_date ?? null,
      unitPh?.dayValue ?? null,
      woAsPresent,
    );
    // Apply per-employee day adjustments from additions/deductions that opted into
    // "Include in total days" — only on the candidate's primary designation line.
    const isPrimaryForAdj = carrierByCandidate.get(c.id) === pairKey(p.candidateId, p.designationId, p.shift);
    if (isPrimaryForAdj) {
      const adj = dayAdjustmentByCandidate.get(c.id);
      if (adj) {
        totals.pDays = Math.max(0, totals.pDays + adj.pDays);
        totals.otDays = Math.max(0, totals.otDays + adj.otDays);
        totals.phDays = Math.max(0, totals.phDays + adj.phDays);
        totals.otherPaidDays = Math.max(0, totals.otherPaidDays + adj.otherPaidDays);
        totals.tDays = Math.max(0, totals.tDays + adj.tDays);
      }
      // Display-only PH count from PH-type lumpsum additions.
      const phDisplay = phDisplayCountByCandidate.get(c.id) ?? 0;
      if (phDisplay) totals.phDays = totals.phDays + phDisplay;
    }
    const contractResource = resourceForLine(c.id, did, p.shift);
    const resource = withContractEdRule(resourceByCandidate.get(c.id), contractResource) ?? contractResource;
    const phOverride = isPrimaryForAdj ? phCashByCandidate.get(c.id) : undefined;
    const wages = resource
      ? computeWages(totals, resource, periodDates.length, { phOverrideAmount: phOverride, periodDates: periodDates.map((d) => new Date(d)), dayBases, epfCapEnabled, esiRoundUp })
      : null;
    const isPrimary = carrierByCandidate.get(c.id) === pairKey(p.candidateId, p.designationId, p.shift);
    const candidateGender = ((c as unknown as { gender?: string | null }).gender ?? "").toString();
    const candidateIsDisabled = Boolean((c as unknown as { is_disabled?: boolean | null }).is_disabled);

    // Fold per-employee additions/deductions onto the primary line only so
    // we don't double-count across multiple designation lines for one person.
    if (wages && isPrimary) {
      const rawAdds = additionsByCandidate.get(c.id) ?? [];
      const extraDeds = deductionsByCandidate.get(c.id) ?? [];
      if (extraDeds.length > 0) {
        wages.deductions = [...wages.deductions, ...extraDeds];
      }
      const applied = applyEmployeeAdditions(wages, rawAdds, totals.pDays, { isDisabled: candidateIsDisabled, period: { ot: totals.otDays, ph: totals.phDays, payable_days: totals.tDays, days_in_month: periodDates.length } });
      Object.assign(wages, applied.wages);
      (wages as unknown as { additions: { name: string; amount: number }[] }).additions = applied.additions;
    }

    // Resolve Professional Tax for this employee from state/gender/earnedGross slabs.
    let ptResolved: ReturnType<typeof resolvePtAmount> | null = null;
    if (wages && isPrimary) {
      ptResolved = resolvePtAmount({
        state: ptState,
        pincode: ptPincode,
        gender: candidateGender,
        // PT slabs are read on regular earned gross; extra duty never
        // counts towards any deduction base.
        earnedGross: Math.max(
          0,
          wages.earnedGross -
            wages.components
              .filter((c) => EXTRA_DUTY_COMPONENT_RE.test(c.name))
              .reduce((s2, c) => s2 + (Number(c.amount) || 0), 0),
        ),
        slabs: (ptSlabs ?? []) as PtSlabLike[],
        ranges: (pincodeRanges ?? []) as PincodeRangeLike[],
      });
      Object.assign(wages, applyPtToWageComputation(wages, ptResolved.amount));
    } else if (wages) {
      // PT is a once-a-month statutory deduction per employee. Secondary
      // lines (e.g. extra-duty-only designation rows) must never charge it
      // again — the primary line already carries it.
      const stripped = wages.deductions.filter((d) => !PT_COMPONENT_RE.test(d.name));
      if (stripped.length !== wages.deductions.length) {
        const totalDeductions = Math.round(stripped.reduce((s, d) => s + d.amount, 0) * 100) / 100;
        Object.assign(wages, {
          deductions: stripped,
          totalDeductions,
          netPay: Math.max(0, Math.round((wages.earnedGross - totalDeductions) * 100) / 100),
        });
      }
    }



    // Resolve LWF from Control Center master (pincode → state → LWF row).
    // Only fires if this period's month is in the master's deduction_months
    // and the master row is enabled. Otherwise LWF rows are zeroed.
    if (wages && isPrimary && lwfRows && pincodeRanges) {
      const lwfRes = resolveLwf(String(ptPincode ?? ""), pincodeRanges as never, lwfRows, ptState);
      const periodMonth = new Date(start).getMonth() + 1; // 1-12
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

    // Split EPF employer contribution into statutory (EPS + EPF) sub-lines.
    // Total employer cost is preserved.
    if (wages && isPrimary) {
      Object.assign(wages, applyEpfBreakdownToWageComputation(wages, { epfCapEnabled }));
    }




    // Collapse variants like "HRA 5%" / "HRA 15%" into a single "HRA"
    // entry so columns and breakdowns are de-duplicated everywhere
    // (table, drawer, Wage Register, Pay Sheet, MIS). Totals are unchanged.
    const mergedResource = resource
      ? {
          ...resource,
          components: mergePayItems(resource.components),
          benefits: mergePayItems(resource.benefits),
          deductions: mergePayItems(resource.deductions),
          employerContributions: mergePayItems(resource.employerContributions),
        }
      : null;
    if (wages) {
      wages.components = mergePayItems(wages.components) as typeof wages.components;
      wages.deductions = mergePayItems(wages.deductions) as typeof wages.deductions;
      wages.employerContributions = mergePayItems(wages.employerContributions) as typeof wages.employerContributions;
      const wAny = wages as unknown as { additions?: { name: string; amount: number }[] };
      if (Array.isArray(wAny.additions)) {
        wAny.additions = mergePayItems(wAny.additions);
      }
    }

    const cAny = c as unknown as Record<string, unknown>;
    return {
      id: c.id,
      rowKey: pairKey(c.id, p.designationId),
      employeeCode: c.employee_code || "",
      name: c.full_name || "—",
      designation: designationName,
      designationId: p.designationId,
      isPrimary,
      // Reliever badge mirrors attendance: only lines whose entries are marked reliever.
      isReliever: lineEntries.length > 0 && lineEntries.every((e) => !!(e as { is_reliever?: boolean | null }).is_reliever),
      totals,
      wages,
      resource: mergedResource ?? null,
      hasContract: !!resource,
      pt: ptResolved,
      bankAccountHolder: (cAny.bank_account_holder as string) || "",
      bankAccountNumber: (cAny.bank_account_number as string) || "",
      bankIfsc: (cAny.bank_ifsc as string) || "",
      bankName: (cAny.bank_name as string) || "",
      bankBranch: (cAny.bank_branch as string) || "",
      dateOfJoining:
        (cAny.preferred_joining_date as string) ||
        (cAny.approved_at as string) ||
        (cAny.application_date as string) ||
        "",
      panNumber: (cAny.pan_number as string) || "",
      pfNumber: ((cAny.compliance as Record<string, unknown> | null)?.pf_number as string) || "",
      esiNumber: ((cAny.compliance as Record<string, unknown> | null)?.esic_number as string) || "",
      uan: ((cAny.compliance as Record<string, unknown> | null)?.uan as string) || "",
    };
  });

  // Professional Tax: slab on the person's whole month — every line at
  // this site (Extra Duty included) plus gross already paid at other sites
  // — minus PT already charged elsewhere, carried on one line only.
  const siteGrossByCandidate = new Map<string, number>();
  for (const r of rows) {
    if (r.wages) siteGrossByCandidate.set(r.id, (siteGrossByCandidate.get(r.id) ?? 0) + r.wages.earnedGross);
  }
  for (const r of rows) {
    if (!r.wages || !r.isPrimary) continue;
    const resolved = ptForSite({
      state: ptState,
      pincode: ptPincode,
      gender: ((rosterById.get(r.id) as unknown as { gender?: string | null } | undefined)?.gender ?? "").toString(),
      siteGross: siteGrossByCandidate.get(r.id) ?? 0,
      other: otherSitePt.get(r.id),
      allocated: ptAllocated.get(r.id) ?? null,
      slabs: (ptSlabs ?? []) as PtSlabLike[],
      ranges: (pincodeRanges ?? []) as PincodeRangeLike[],
    });
    Object.assign(r.wages, applyPtToWageComputation(r.wages, resolved.amount));
    const other = otherSitePt.get(r.id) ?? null;
    r.pt = {
      ...resolved,
      otherGross: other?.gross ?? 0,
      otherPt: other?.pt ?? 0,
      otherSites: otherSitesWorked.get(r.id) ?? [],
      allocated: ptAllocated.has(r.id),
    } as typeof r.pt;
  }
  // Gross is paid in whole rupees (nearest); net = rounded gross − deductions.
  for (const r of rows) {
    if (r.wages && esiRoundUp) Object.assign(r.wages, roundEsiUp(r.wages));
    if (r.wages) Object.assign(r.wages, roundFinalGross(r.wages));
  }




  // Client payroll shows only people with attendance in this period, and
  // never Field Officers (non-billable; paid from the Radiant home unit).
  const FO_HOME_UNIT_ID = "92541381-14d3-4be6-ae8c-078b79c2e0f1";
  const isFoDesignation = (id: string | null | undefined) =>
    /field[\s-]*officer/i.test((id && desigMap.get(id)) || "");
  const visibleRows = rows.filter((r) => {
    const t = r.totals;
    if ((t.pDays + t.phDays + t.otDays + t.otherPaidDays) <= 0) return false;
    if (unitId !== FO_HOME_UNIT_ID) {
      const c = rosterById.get(r.id);
      // A Field Officer may hold a secondary billable posting here (e.g. as
      // Security Guard): only lines in a Field Officer designation are hidden.
      if (isFoDesignation(r.designationId ?? c?.designation_id)) return false;
    }
    return true;
  });

  visibleRows.sort((a, b) => {
    const an = (a.employeeCode || a.name).localeCompare(b.employeeCode || b.name);
    if (an !== 0) return an;
    // primary first, then by designation name
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.designation.localeCompare(b.designation);
  });

  return visibleRows;
}

export type PayrollUnitRow = Awaited<ReturnType<typeof computePayrollUnitRows>>[number];

/** Site totals exactly as the payroll page shows them (sum of its visible rows). */
export type PayrollUnitTotals = {
  gross: number;
  deductions: number;
  net: number;
  /** Employer contributions excluding billed margin (management fee, reliever, service charge). */
  employer: number;
  /** The payroll page's own "Employer contrib" total (every employer line, as shown there). */
  employerAll: number;
  /** Management fee within employerAll — billed margin, counted as profit on the dashboard. */
  managementFee: number;
  /** Per employee: gross / deductions summed over their lines at this site. */
  byPerson: Map<string, { gross: number; deductions: number }>;
};

function payrollDates(start: string, end: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const cursor = new Date(ys, ms - 1, ds);
  const stop = new Date(ye, me - 1, de);
  while (cursor <= stop) {
    out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function payrollUnitTotals(rows: PayrollUnitRow[]): PayrollUnitTotals {
  const byPerson = new Map<string, { gross: number; deductions: number }>();
  let gross = 0, deductions = 0, net = 0, employer = 0, employerAll = 0, managementFee = 0;
  for (const r of rows) {
    if (!r.wages) continue;
    gross += Number(r.wages.earnedGross) || 0;
    deductions += Number(r.wages.totalDeductions) || 0;
    net += Number(r.wages.netPay) || 0;
    employer += employerCostOnly(r.wages.employerContributions as never);
    employerAll += Number(r.wages.totalEmployerContributions) || 0;
    managementFee += managementFeeOf(r.wages.employerContributions as never);
    const p = byPerson.get(r.id) ?? { gross: 0, deductions: 0 };
    p.gross += Number(r.wages.earnedGross) || 0;
    p.deductions += Number(r.wages.totalDeductions) || 0;
    byPerson.set(r.id, p);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { gross: r2(gross), deductions: r2(deductions), net: r2(net), employer: r2(employer), employerAll: r2(employerAll), managementFee: r2(managementFee), byPerson };
}

/**
 * Payroll page totals for many sites, each over its own period: the same
 * reference data and the page's own calculation, with every read batched.
 */
export async function computePayrollUnitsTotals(
  periods: Map<string, { start: string; end: string }>,
): Promise<Map<string, PayrollUnitTotals>> {
  const out = new Map<string, PayrollUnitTotals>();
  const ids = Array.from(periods.keys());
  if (!ids.length) return out;
  await supabaseSessionReady();
  const [{ fetchEnabledPublicHolidays, holidayMapForDates }, { fetchPlatformFlag, PLATFORM_SETTING_KEYS }, bulk, { applyRateRevisionsWith }, { hydrateFormulasWith, loadAllFormulaMasters }, { fetchInChunks }, { visibleAttendanceCandidateIds }] = await Promise.all([
    import("@/lib/public-holidays"),
    import("@/lib/platform-settings"),
    import("@/lib/invoice-engine-bulk"),
    import("@/lib/rate-revisions"),
    import("@/lib/contract-hydrate"),
    import("@/lib/supabase-batch"),
    import("@/lib/attendance-roster-eligibility"),
  ]);
  const starts = [...periods.values()].map((p) => p.start).sort();
  const ends = [...periods.values()].map((p) => p.end).sort();
  const minStart = starts[0]!;
  const maxEnd = ends[ends.length - 1]!;
  // Joining fees dated up to a month before a window can carry into it.
  const dedFrom = (() => { const d = new Date(`${minStart}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 62); return d.toISOString().slice(0, 10); })();
  const all = <T,>(q: (a: number, b: number) => unknown) => fetchInChunks<T>(["x"], (_c, a, b) => q(a, b) as never);
  const [holidays, esiRoundUp, slabsRes, rangesRes, lwfRes, inputs, revisions, masters, codes, addTypes, pdbs, desigs, additions, deductions] = await Promise.all([
    fetchEnabledPublicHolidays(),
    fetchPlatformFlag(PLATFORM_SETTING_KEYS.esiRoundUp, true),
    supabase.from("professional_tax_slabs").select("id, state, region_label, salary_min, salary_max, tax_per_month, gender"),
    supabase.from("pincode_ranges").select("state, region_label, range_start, range_end, is_excluded"),
    supabase.from("labour_welfare_funds").select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes"),
    bulk.fetchPeriodInputs(periods),
    bulk.fetchAllRevisions(),
    loadAllFormulaMasters(),
    supabase.from("attendance_codes").select("code, counts_as_present, is_paid, day_value").eq("enabled", true).then((r) => (r.data ?? []) as AnyRow[]),
    supabase.from("addition_types").select("id, code").then((r) => (r.data ?? []) as AnyRow[]),
    supabase.from("payroll_day_bases").select("id, method, fixed_days, weekly_off_day, included_weekdays, enabled").then((r) => (r.data ?? []) as AnyRow[]),
    all<AnyRow>((a, b) => supabase.from("designations").select("id, name").order("id").range(a, b)),
    all<AnyRow>((a, b) => supabase.from("additions" as never).select("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi, formula_expression, per_day_amount, addition_date, end_date, unit_id").eq("status", "active").lte("addition_date", maxEnd).order("id").range(a, b)),
    all<AnyRow>((a, b) => supabase.from("deductions" as never).select("candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, deduction_date, unit_id").eq("status", "active").gte("deduction_date", dedFrom).lte("deduction_date", maxEnd).order("id").range(a, b)),
  ]);
  for (const r of [slabsRes, rangesRes, lwfRes]) if (r.error) throw r.error;
  const ptSlabs = (slabsRes.data ?? []) as PtSlabLike[];
  const pincodeRanges = (rangesRes.data ?? []) as PincodeRangeLike[];
  const lwfRows = (lwfRes.data ?? []) as LwfRow[];
  const designations = new Map(desigs.map((d) => [String(d.id), String(d.name)]));
  const s = (v: unknown) => String(v ?? "");
  const group = <T extends AnyRow>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = key(r); const l = m.get(k) ?? []; l.push(r); m.set(k, l); }
    return m;
  };
  const contractsByUnit = group(inputs.contracts, (c) => s(c.unit_id));
  const periodContract = new Map<string, AnyRow>();
  for (const [u, p] of periods) {
    const c = bulk.choosePeriodContract(contractsByUnit.get(u) ?? [], p.start, p.end);
    if (c) periodContract.set(u, c);
  }
  const resources = await bulk.fetchContractResources(Array.from(new Set([...periodContract.values()].map((c) => s(c.id)))));
  const resourcesByContract = group(resources, (r) => s(r.contract_id));
  const primaryByUnit = group(inputs.primary, (c) => s(c.unit_id));
  const linksByUnit = group(inputs.links, (l) => s(l.unit_id));
  const scopesByUnit = group(inputs.scopes, (x) => s(x.scope_id));
  const addsByCand = group(additions, (a) => s(a.candidate_id));
  const dedsByCand = group(deductions, (d) => s(d.candidate_id));
  const siteById = new Map(inputs.sites.map((u) => [s(u.id), u]));

  // Roster per site (the page's rule), then the people-wide reads in batches.
  type Prepared = { unitId: string; start: string; end: string; src: Omit<PayrollUnitSource, "employeeWages" | "otherSitePt" | "ptAllocated">; rosterIds: string[] };
  const prepared: Prepared[] = [];
  const hydrate = <T extends ContractResourceLike>(list: T[]) => hydrateFormulasWith(list, masters);
  for (const [unitId, p] of periods) {
    const primary = primaryByUnit.get(unitId) ?? [];
    const links = linksByUnit.get(unitId) ?? [];
    const linkIds = links.map((l) => s(l.candidate_id));
    const secondary = Array.from(new Map(linkIds.map((id) => [id, inputs.people.get(id)])).values())
      .filter((c): c is AnyRow => !!c && c.is_enabled === true && c.status === "active");
    const entries = inputs.entries.get(unitId) ?? [];
    const attended = Array.from(new Set(entries.map((e) => e.candidate_id)));
    const attendedIds = visibleAttendanceCandidateIds(
      unitId,
      attended.map((id) => inputs.people.get(id)).filter((c): c is AnyRow => !!c).map((c) => ({ id: s(c.id), unit_id: c.unit_id ?? null, is_enabled: c.is_enabled ?? null, status: c.status ?? null })),
      linkIds,
      (scopesByUnit.get(unitId) ?? []).map((x) => s(x.candidate_id)),
    );
    const rosterIds = Array.from(new Set([...primary.map((c) => s(c.id)), ...secondary.map((c) => s(c.id)), ...attendedIds]));
    const rosterSet = new Set(rosterIds);
    const contract = periodContract.get(unitId) ?? null;
    const lines = contract ? (resourcesByContract.get(s(contract.id)) ?? []).map(({ contract_id: _c, ...rest }) => rest) : [];
    const pick = <T extends AnyRow>(by: Map<string, T[]>) => rosterIds.flatMap((id) => by.get(id) ?? []);
    prepared.push({
      unitId, start: p.start, end: p.end, rosterIds,
      src: {
        primary, linkIds, secondary, attendedIds, people: inputs.people, designations,
        entries, codes, periodContract: contract,
        resources: applyRateRevisionsWith(lines, revisions, p.start, p.end),
        additions: pick(addsByCand).filter((a) => {
          const d = s(a.addition_date);
          if (!d || d > p.end) return false;
          if (!(d >= p.start || (a.repeat_monthly === true && (!a.end_date || s(a.end_date) >= p.start)))) return false;
          return !a.unit_id || s(a.unit_id) === unitId;
        }),
        deductions: pick(dedsByCand).filter((d) => s(d.deduction_date) <= p.end && (!d.unit_id || s(d.unit_id) === unitId)),
        // Only needed for one-time joining fees; queried exactly as the page does.
        priorAttendance: async (cids) => {
          // The answer only matters for one-time joining fees (unit_fee deductions).
          const feeIds = new Set(pick(dedsByCand).filter((d) => d.source_kind === "unit_fee").map((d) => s(d.candidate_id)));
          if (!cids.length || !cids.some((id) => feeIds.has(id))) return [];
          const { data } = await supabase.from("attendance_entries").select("candidate_id").eq("unit_id", unitId).in("candidate_id", cids).lt("entry_date", p.start);
          return (data ?? []) as { candidate_id: string }[];
        },
        addTypes, pdbs, hydrate,
        postingShifts: links.filter((l) => l.shift_hours != null).map((l) => ({ candidate_id: s(l.candidate_id), shift_hours: Number(l.shift_hours) })),
      },
    });
    void rosterSet;
  }

  const everyone = Array.from(new Set(prepared.flatMap((x) => x.rosterIds)));
  const months = Array.from(new Set(prepared.map((x) => x.end.slice(0, 7))));
  const [wages, snaps, allocs] = await Promise.all([
    fetchInChunks<AnyRow>(everyone, (chunk, a, b) => supabase.from("employee_wages" as never).select("candidate_id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id").in("candidate_id", chunk).range(a, b) as never),
    Promise.all(months.map((m) => {
      const [y, mo] = m.split("-").map(Number);
      const ms = `${m}-01`;
      const me = new Date(Date.UTC(y!, mo!, 0)).toISOString().slice(0, 10);
      return fetchInChunks<AnyRow>(everyone, (chunk, a, b) => supabase
        .from("payroll_run_snapshots")
        .select("candidate_id, payroll_run_id, version, gross, deductions, payroll_runs!inner(unit_id, period_end, payroll_status)")
        .in("candidate_id", chunk).eq("payroll_runs.payroll_status", "processed")
        .gte("payroll_runs.period_end", ms).lte("payroll_runs.period_end", me).range(a, b) as never).catch(() => [] as AnyRow[]).then((rows) => [m, rows] as const);
    })),
    Promise.all(months.map((m) => {
      const [y, mo] = m.split("-").map(Number);
      return fetchInChunks<AnyRow>(everyone, (chunk, a, b) => (supabase as unknown as { from: (t: string) => any })
        .from("pt_site_allocations").select("candidate_id, unit_id, pt_amount")
        .in("candidate_id", chunk).eq("period_year", y).eq("period_month", mo).range(a, b) as never).catch(() => [] as AnyRow[]).then((rows) => [m, rows] as const);
    })),
  ]);
  const wagesByCand = group(wages, (w) => s(w.candidate_id));
  const snapsByMonth = new Map(snaps);
  const allocsByMonth = new Map(allocs);

  const PT_RE = PT_COMPONENT_RE;
  const queue = [...prepared];
  const worker = async () => {
    for (let x = queue.shift(); x; x = queue.shift()) {
      const month = x.end.slice(0, 7);
      const ids = new Set(x.rosterIds);
      // fetchOtherSitePtTotals: latest snapshot per run + person at OTHER sites this month.
      const latest = new Map<string, AnyRow>();
      for (const sn of snapsByMonth.get(month) ?? []) {
        if (!ids.has(s(sn.candidate_id)) || s((sn.payroll_runs as AnyRow | null)?.unit_id) === x.unitId) continue;
        const k = `${sn.payroll_run_id}|${sn.candidate_id}`;
        const prev = latest.get(k);
        if (!prev || Number(sn.version) > Number(prev.version)) latest.set(k, sn);
      }
      const otherSitePt = new Map<string, { gross: number; pt: number }>();
      for (const sn of latest.values()) {
        const deds = Array.isArray(sn.deductions) ? (sn.deductions as { name?: string; amount?: number | string }[]) : [];
        const pt = deds.filter((d) => PT_RE.test(String(d?.name ?? ""))).reduce((a, d) => a + (Number(d.amount) || 0), 0);
        const cur = otherSitePt.get(s(sn.candidate_id)) ?? { gross: 0, pt: 0 };
        otherSitePt.set(s(sn.candidate_id), { gross: cur.gross + (Number(sn.gross) || 0), pt: cur.pt + pt });
      }
      // fetchPtAllocations.
      const ptAllocated = new Map<string, number>();
      for (const r of allocsByMonth.get(month) ?? []) {
        const cid = s(r.candidate_id);
        if (!ids.has(cid)) continue;
        if (!ptAllocated.has(cid)) ptAllocated.set(cid, 0);
        if (s(r.unit_id) === x.unitId) ptAllocated.set(cid, (ptAllocated.get(cid) ?? 0) + (Number(r.pt_amount) || 0));
      }
      const u = siteById.get(x.unitId);
      const periodDates = payrollDates(x.start, x.end);
      const flags = bulk.chooseFlagContract(contractsByUnit.get(x.unitId) ?? [], x.start, x.end);
      const dv = u?.ph_day_value;
      const unitPh = {
        enabled: Boolean(u?.ph_enabled),
        multiplier: Number(u?.ph_multiplier ?? 1) || 1,
        excluded: ((u?.ph_excluded_candidate_ids ?? []) as unknown[]).map(String),
        excludedDays: ((u?.ph_excluded_days ?? []) as unknown[]).map(String),
        dayValue: !u?.ph_enabled ? 0 : dv == null || Number.isNaN(Number(dv)) ? null : Number(dv),
      };
      const phMap = unitPh.enabled ? holidayMapForDates(periodDates, holidays) : new Map();
      const phConfig = unitPh.enabled && phMap.size > 0 ? { dates: Array.from(phMap.keys()) as string[], multiplier: unitPh.multiplier } : null;
      const rows = await computePayrollUnitRows({
        unitId: x.unitId, start: x.start, end: x.end, periodDates,
        ptState: (u?.pt_state as string | null) || ((u?.billing_state as string | null) ?? null),
        ptPincode: u?.pt_state ? null : ((u?.billing_pincode as string | null) ?? null),
        epfCapEnabled: (u?.epf_cap_enabled as boolean | null) ?? true,
        esiRoundUp, woAsPresent: Boolean(flags?.wo_as_present), unitPh, phConfig, ptSlabs, pincodeRanges, lwfRows,
      }, { ...x.src, employeeWages: x.rosterIds.flatMap((id) => wagesByCand.get(id) ?? []), otherSitePt, ptAllocated });
      out.set(x.unitId, payrollUnitTotals(rows));
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, prepared.length) }, worker));
  return out;
}
