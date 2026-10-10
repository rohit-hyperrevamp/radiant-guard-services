import { supabase } from "@/integrations/supabase/client";
import { holidayMapForDates, fetchEnabledPublicHolidays } from "@/lib/public-holidays";
import { normShift, shiftKey } from "@/lib/shift-resources";
import { applyRateRevisionsForPeriod } from "@/lib/rate-revisions";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { applyEpfBreakdownToWageComputation, applyEsiToWageComputation, allowancePayable, applyAllowancePf, applyLwfToWageComputation, applyPtToWageComputation, computeAttendanceTotals, computeWages, mergeByCanonicalName, resolvePtAmount, type AttendanceCodeLike, type AttendanceEntryLike, type ContractResourceLike, type PincodeRangeLike, type PtSlabLike, EXTRA_DUTY_COMPONENT_RE } from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
function cleanLedgerName(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 3) return parts[1].trim() || s;
  return s;
}

const ESI_COMPONENT_RE = /\besi(c)?\b/i;
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
const PT_COMPONENT_RE = /\bprofessional\s*tax\b|\bpt\b/i;
const supabaseSessionReady = async () => {};
export async function computeUnit(unitId: string, start: string, end: string, G: { publicHolidays: any[]; ptSlabs: any[]; pincodeRanges: any[]; lwfRows: LwfRow[] }) {
  const { ptSlabs, pincodeRanges, lwfRows } = G;
  const periodDates = buildDates(start, end);
  const { data: ur } = await supabase.from("units").select("ph_enabled, ph_multiplier, ph_day_value").eq("id", unitId).maybeSingle();
  const unitPh = { enabled: Boolean(ur?.ph_enabled), multiplier: Number(ur?.ph_multiplier ?? 1) || 1, dayValue: !ur?.ph_enabled ? 0 : ur?.ph_day_value == null || Number.isNaN(Number(ur.ph_day_value)) ? null : Number(ur.ph_day_value) };
  const phConfig = (() => { if (!unitPh.enabled) return null; const m = holidayMapForDates(periodDates, G.publicHolidays); if (m.size === 0) return null; return { dates: Array.from(m.keys()), multiplier: unitPh.multiplier }; })();
  const { data: unit } = await supabase.from("units").select("id, code, name, customer_id, billing_state, billing_pincode, epf_cap_enabled").eq("id", unitId).maybeSingle();
  const unitState = unit?.billing_state ?? null; const unitPincode = unit?.billing_pincode ?? null; const epfCapEnabled = unit?.epf_cap_enabled ?? true;
  const __run = async () => {
      await supabaseSessionReady();
      // 1. Roster: candidates mapped to this unit (primary + secondary).
      const candidateCols =
        "id, employee_code, full_name, designation_id, gender, is_disabled, bank_account_holder, bank_account_number, bank_ifsc, bank_name, bank_branch, approved_at, preferred_joining_date, application_date, pan_number, compliance";
      const [{ data: primary }, { data: links }] = await Promise.all([
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
      if (linkIds.length > 0) {
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
      const { data: contracts } = await supabase
        .from("client_contracts")
        .select("id, payroll_window_id")
        .eq("unit_id", unitId)
        .eq("record_type", "client")
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1);
      const contractId = contracts?.[0]?.id;

      let resources: Record<string, unknown>[] = [];
      if (contractId) {
        const { data: r } = await supabase
          .from("contract_resources")
          .select(
            "id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id, shift_hours",
          )
          .eq("contract_id", contractId);
        resources = r ?? [];
        resources = await applyRateRevisionsForPeriod(resources as Record<string, unknown>[], start, end);
      }

      // 3b. Per-employee Additions & Deductions (Control Center catalog).
      // Pull anything dated within the payroll period and still active.
      const candidateIds = roster.map((c) => c.id);
      type PerEmpItem = { name: string; amount: number; prorate?: boolean; countsForPf?: boolean; countsForEsi?: boolean };
      type DayAdj = { pDays: number; otDays: number; phDays: number; otherPaidDays: number; tDays: number };
      const additionsByCandidate = new Map<string, PerEmpItem[]>();
      const deductionsByCandidate = new Map<string, PerEmpItem[]>();
      const dayAdjustmentByCandidate = new Map<string, DayAdj>();
      const phDisplayCountByCandidate = new Map<string, number>();
      // PH cash override: user-entered PH addition amount is paid as-is on
      // the "Paid Holiday" line (bypasses the engine's perDayRate × phCount).
      const phCashByCandidate = new Map<string, number>();
      if (candidateIds.length > 0) {
        const [addsRes, dedsRes, priorAttendanceRes, addTypesRes] = await Promise.all([
          supabase
            .from("additions" as never)
            .select("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for, source_kind, repeat_monthly, prorate_by_days, counts_for_pf, counts_for_esi")
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
        type RawAdd = { candidate_id: string; addition_type_id?: string | null; addition_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null; source_kind?: string | null; repeat_monthly?: boolean | null; prorate_by_days?: boolean | null; counts_for_pf?: boolean | null; counts_for_esi?: boolean | null };
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
      if (allDesigIds.size > 0) {
        const { data: extraDs } = await supabase
          .from("designations")
          .select("id, name")
          .in("id", Array.from(allDesigIds));
        for (const d of extraDs ?? []) desigMap.set(d.id, d.name as string);
      }

      // Load ALL enabled payroll day bases — referenced by contract resources
      // AND by cost component / allowance divisors (pdb:<uuid>).
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
      const hydratedList = await hydrateFormulasFromMaster(uniqueShiftKeys.map((k) => resourceByShiftKey.get(k)!));
      hydratedList.forEach((r, i) => {
        resourceByShiftKey.set(uniqueShiftKeys[i], r);
        if (!resourceByDesignation.has(r.designationId)) resourceByDesignation.set(r.designationId, r);
      });
      const postingShiftRes = await supabase
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
        const wanted = lineShift === 8 || lineShift === 12 ? lineShift : postingShift.get(cid);
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
          const { data: ew } = await supabase
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
            const hydratedEw = await hydrateFormulasFromMaster(
              ids.map((id) => resourceByCandidate.get(id)!),
            );
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
        const isPrimaryLine = (c.designation_id ?? null) === p.designationId;
        const totals = computeAttendanceTotals(
          c.id,
          periodDates,
          lineEntries as AttendanceEntryLike[],
          (codes ?? []) as AttendanceCodeLike[],
          isPrimaryLine ? phConfig : null,
          (c as { preferred_joining_date?: string | null }).preferred_joining_date ?? null,
          unitPh?.dayValue ?? null,
        );
        // Apply per-employee day adjustments from additions/deductions that opted into
        // "Include in total days" — only on the candidate's primary designation line.
        const isPrimaryForAdj = (c.designation_id ?? null) === p.designationId;
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
        const resource = resourceByCandidate.get(c.id) ?? resourceForLine(c.id, did, p.shift);
        const phOverride = isPrimaryForAdj ? phCashByCandidate.get(c.id) : undefined;
        const wages = resource
          ? computeWages(totals, resource, periodDates.length, { phOverrideAmount: phOverride, periodDates: periodDates.map((d) => new Date(d)), dayBases, epfCapEnabled })
          : null;
        const isPrimary = (c.designation_id ?? null) === p.designationId;
        const candidateGender = ((c as unknown as { gender?: string | null }).gender ?? "").toString();
        const candidateIsDisabled = Boolean((c as unknown as { is_disabled?: boolean | null }).is_disabled);

        // Fold per-employee additions/deductions onto the primary line only so
        // we don't double-count across multiple designation lines for one person.
        if (wages && isPrimary) {
          const rawAdds = additionsByCandidate.get(c.id) ?? [];
          const extraDeds = deductionsByCandidate.get(c.id) ?? [];
          const extraAdds = rawAdds
            .map((a) => ({ ...a, amount: allowancePayable(a, totals.pDays, wages.baseDays) }))
            .filter((a) => a.amount > 0);
          const addAdditions: { name: string; amount: number }[] = extraAdds.map((a) => ({ name: a.name, amount: a.amount }));
          (wages as unknown as { additions: { name: string; amount: number }[] }).additions = addAdditions;
          if (extraDeds.length > 0) {
            wages.deductions = [...wages.deductions, ...extraDeds];
          }
          const addTotal = extraAdds.reduce((s, a) => s + a.amount, 0);
          const nonEsiTotal = extraAdds.filter((a) => a.countsForEsi === false).reduce((s, a) => s + a.amount, 0);
          const pfAllowance = extraAdds.filter((a) => a.countsForPf).reduce((s, a) => s + a.amount, 0);
          const fullGross = Math.round((wages.earnedGross + addTotal) * 100) / 100;
          wages.earnedGross = Math.round((fullGross - nonEsiTotal) * 100) / 100;
          Object.assign(wages, applyEsiToWageComputation(wages, { isDisabled: candidateIsDisabled }));
          wages.earnedGross = fullGross;
          Object.assign(wages, applyAllowancePf(wages, pfAllowance));
        }

        // Resolve Professional Tax for this employee from state/gender/earnedGross slabs.
        let ptResolved: ReturnType<typeof resolvePtAmount> | null = null;
        if (wages && isPrimary) {
          ptResolved = resolvePtAmount({
            state: unitState,
            pincode: unitPincode,
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
          const lwfRes = resolveLwf(String(unitPincode ?? ""), pincodeRanges as never, lwfRows);
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
              components: mergeByCanonicalName(resource.components),
              benefits: mergeByCanonicalName(resource.benefits),
              deductions: mergeByCanonicalName(resource.deductions),
              employerContributions: mergeByCanonicalName(resource.employerContributions),
            }
          : null;
        if (wages) {
          wages.components = mergeByCanonicalName(wages.components) as typeof wages.components;
          wages.deductions = mergeByCanonicalName(wages.deductions) as typeof wages.deductions;
          wages.employerContributions = mergeByCanonicalName(wages.employerContributions) as typeof wages.employerContributions;
          const wAny = wages as unknown as { additions?: { name: string; amount: number }[] };
          if (Array.isArray(wAny.additions)) {
            wAny.additions = mergeByCanonicalName(wAny.additions);
          }
        }

        return { c, p, did, designationName, totals, wages, resource, isPrimary, ptResolved, adds: additionsByCandidate.get(c.id) ?? [], deds: deductionsByCandidate.get(c.id) ?? [] };
      });
      return { rows, contractId, unit };
  };
  return __run();
}
