import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Download, Eye, FileCheck2, Loader2, Upload } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TaxInvoiceSheet, type TaxInvoiceData } from "@/components/TaxInvoiceSheet";
import { InvoiceExtraChargesCard, useInvoiceExtraCharges } from "@/components/InvoiceExtraCharges";

import { supabase } from "@/integrations/supabase/client";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import {
  applyEpfBreakdownToWageComputation,
  applyEsiToWageComputation,
  applyLwfToWageComputation,
  applyPtToWageComputation,
  computeAttendanceTotals,
  computeWages,
  mergeByCanonicalName,
  fmtINR,
  resolvePtAmount,
  type AttendanceCodeLike,
  type AttendanceEntryLike,
  type ContractResourceLike,
  type PincodeRangeLike,
  type PtSlabLike,
} from "@/lib/payroll-calc";
import { resolveLwf, type LwfRow } from "@/lib/lwf-lookup";
import { writeXlsx } from "@/lib/csv-export";
import { buildMisSheet, loadMisDisabledCustomerIds, loadMisTemplateForCustomer, loadMisUnitValues } from "@/lib/mis-template";
import { misBillingLine } from "@/lib/mis-billing";
import { gstinStateCode } from "@/lib/gstin";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { buildTallyVoucherRows, writeTallyBillingXlsx } from "@/lib/tally-billing";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { refreshBillingAddOns } from "@/lib/contract-billing-addons";
import { resolvePayrollDayCount } from "@/lib/payroll-days";
import { useOrgSettings } from "@/lib/org-settings";
import { normalizeState, resolveGstBillingBranch, taxSplit, useGstBillingBranches } from "@/lib/gst-billing";
import { usePublicHolidays, holidayMapForDates } from "@/lib/public-holidays";
import { logActivity } from "@/lib/activity-log";
import { useCurrentPermissions } from "@/lib/rbac";
import { PERIOD_STATUS_QK } from "@/lib/period-status";
import { useFinalInvoicesForUnits, unitPeriodKey } from "@/lib/final-invoice";
import { FinalInvoiceDialog, type FinalInvoiceTarget } from "@/components/FinalInvoiceDialog";

const searchSchema = z.object({
  start: z.string(),
  end: z.string(),
  candidate: z.string().optional(),
});

export const Route = createFileRoute("/admin/invoice/$unitId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PayrollUnitPage,
});

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
const PT_COMPONENT_RE = /\bprofessional\s*tax\b|\bpt\b/i;
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

function PayrollUnitPage() {
  const { unitId } = Route.useParams();
  const { start, end, candidate: highlightCandidate } = Route.useSearch();
  const queryClient = useQueryClient();
  const tallyInvoiceInputRef = useRef<HTMLInputElement>(null);
  const [uploadingTallyInvoice, setUploadingTallyInvoice] = useState(false);
  const { can } = useCurrentPermissions();
  const canUploadTallyInvoice = can("invoice", "edit");
  // Invoice numbers only exist once the invoice has been finalised.
  const finalInvoicesQ = useFinalInvoicesForUnits([unitId]);
  const finalInvoice = finalInvoicesQ.data?.get(unitPeriodKey(unitId, start, end)) ?? null;
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);

  const periodDates = useMemo(() => buildDates(start, end), [start, end]);

  // Public holiday credit — must mirror the payroll page, otherwise billed days
  // silently drop the PH duties that payroll pays out.
  const publicHolidays = usePublicHolidays();
  const { data: unitPh } = useQuery({
    queryKey: ["invoice-unit-ph", unitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("units")
        .select("ph_enabled, ph_multiplier, ph_day_value" as never)
        .eq("id", unitId)
        .maybeSingle();
      const row = (data ?? null) as {
        ph_enabled?: boolean | null;
        ph_multiplier?: number | null;
        ph_day_value?: number | string | null;
      } | null;
      const dv = row?.ph_day_value;
      return {
        enabled: Boolean(row?.ph_enabled),
        multiplier: Number(row?.ph_multiplier ?? 1) || 1,
        dayValue: dv == null || Number.isNaN(Number(dv)) ? null : Number(dv),
      };
    },
  });
  const phConfig = useMemo(() => {
    if (!unitPh?.enabled) return null;
    const map = holidayMapForDates(periodDates, publicHolidays);
    if (map.size === 0) return null;
    return { dates: Array.from(map.keys()), multiplier: unitPh.multiplier };
  }, [unitPh, periodDates, publicHolidays]);

  const { data: unit } = useQuery({
    queryKey: ["payroll-unit", unitId],
    queryFn: async () => {
      await supabaseSessionReady();
      const { data: rawUnit } = await supabase
        .from("units")
        .select(
          "id, code, name, customer_id, epf_cap_enabled, gst_number, zone, branch_sap_code, billing_address1, billing_address2, billing_city, billing_district, billing_state, billing_pincode, billing_country" as never,
        )
        .eq("id", unitId)
        .maybeSingle();
      const data = (rawUnit ?? null) as {
        id: string;
        code: string | null;
        name: string | null;
        customer_id: string | null;
        epf_cap_enabled: boolean | null;
        gst_number: string | null;
        zone: string | null;
        branch_sap_code: string | null;
        billing_address1: string | null;
        billing_address2: string | null;
        billing_city: string | null;
        billing_district: string | null;
        billing_state: string | null;
        billing_pincode: string | null;
        billing_country: string | null;
      } | null;
      if (!data) return null;
      const { data: cust } = await supabase
        .from("customers")
        .select(
          "name, billing_address1, billing_address2, billing_city, billing_district, billing_state, billing_pincode, billing_country",
        )
        .eq("id", data.customer_id ?? "")
        .maybeSingle();
      const { data: gsts } = await supabase
        .from("customer_gst_numbers")
        .select("gstin, state_name")
        .eq("customer_id", data.customer_id ?? "");
      const stateGstin =
        (gsts ?? []).find(
          (g) => (g.state_name ?? "").toLowerCase() === (data.billing_state ?? "").toLowerCase(),
        )?.gstin ??
        (gsts ?? [])[0]?.gstin ??
        data.gst_number ??
        "";
      return {
        ...data,
        customer_name: cust?.name ?? "",
        customer: cust ?? null,
        gstin: stateGstin,
      };
    },
  });

  // Organizations marked "MIS not applicable" get no MIS download at all.
  const { data: misDisabledCustomers } = useQuery({
    queryKey: ["admin", "mis-disabled-customers"],
    queryFn: loadMisDisabledCustomerIds,
    staleTime: 5 * 60 * 1000,
  });
  const misApplicable = !misDisabledCustomers?.has(String(unit?.customer_id ?? ""));

  const { data: sheet } = useQuery({
    queryKey: ["payroll-sheet", unitId, start, end],
    queryFn: async () => {
      await supabaseSessionReady();
      const { data } = await supabase
        .from("attendance_sheets" as never)
        .select("id, status, approved_at, tally_invoice_path, tally_invoice_name, tally_invoice_uploaded_at")
        .eq("unit_id", unitId)
        .eq("period_start", start)
        .eq("period_end", end)
        .maybeSingle();
      return data as unknown as {
        id: string;
        status: string;
        approved_at: string | null;
        tally_invoice_path: string | null;
        tally_invoice_name: string | null;
        tally_invoice_uploaded_at: string | null;
      } | null;
    },
  });

  const { data: ptSlabs } = useQuery({
    queryKey: ["pt_slabs_invoice"],
    queryFn: async (): Promise<PtSlabLike[]> => {
      const { data, error } = await supabase
        .from("professional_tax_slabs")
        .select("id, state, region_label, salary_min, salary_max, tax_per_month, gender");
      if (error) throw error;
      return (data ?? []) as PtSlabLike[];
    },
  });

  const { data: pincodeRanges } = useQuery({
    queryKey: ["pincode_ranges_invoice"],
    queryFn: async (): Promise<PincodeRangeLike[]> => {
      const { data, error } = await supabase
        .from("pincode_ranges")
        .select("state, region_label, range_start, range_end, is_excluded");
      if (error) throw error;
      return (data ?? []) as PincodeRangeLike[];
    },
  });

  const { data: lwfRows } = useQuery({
    queryKey: ["labour_welfare_funds_invoice"],
    queryFn: async (): Promise<LwfRow[]> => {
      const { data, error } = await supabase
        .from("labour_welfare_funds")
        .select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes");
      if (error) throw error;
      return (data ?? []) as LwfRow[];
    },
  });

  const unitState = (unit as { billing_state?: string | null } | null | undefined)?.billing_state ?? null;
  const unitPincode = (unit as { billing_pincode?: string | null } | null | undefined)?.billing_pincode ?? null;
  const epfCapEnabled =
    (unit as { epf_cap_enabled?: boolean | null } | null | undefined)?.epf_cap_enabled ?? true;

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice-compute", unitId, start, end, unitState, unitPincode, epfCapEnabled, (phConfig?.dates.length ?? 0), (phConfig?.multiplier ?? 0), (ptSlabs?.length ?? 0), (pincodeRanges?.length ?? 0), (lwfRows?.length ?? 0)],
    // Wait for `unit` (PT state / pincode / EPF cap) before computing, else the
    // first render is wrong/zero until a manual refresh.
    enabled: unit !== undefined && !!ptSlabs && !!pincodeRanges && !!lwfRows,
    queryFn: async () => {
      await supabaseSessionReady();
      // 1. Roster: candidates mapped to this unit (primary + secondary).
      const [primaryRes, linksRes] = await Promise.all([
        supabase
          .from("candidates")
          .select("id, employee_code, full_name, designation_id, gender, is_disabled, preferred_joining_date")
          .eq("unit_id", unitId)
          .eq("is_enabled", true)
          .eq("status", "active"),
        supabase.from("candidate_units").select("candidate_id").eq("unit_id", unitId),
      ]);
      if (primaryRes.error) throw primaryRes.error;
      if (linksRes.error) throw linksRes.error;
      const primary = primaryRes.data;
      const links = linksRes.data;
      const linkIds = (links ?? []).map((l) => l.candidate_id);
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
        .select("id, payroll_window_id, billing_type_id")
        .eq("unit_id", unitId)
        .eq("record_type", "client")
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1);
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
            "designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id, billing_day_base_id, shift_hours",
          )
          .eq("contract_id", contractId);
        resources = (r ?? []) as unknown as Record<string, unknown>[];
      }

      // 3b. Per-employee Additions & Deductions in the invoice window.
      // Mirrors admin.payroll.$unitId.tsx so invoice employer-cost lines up
      // 1:1 with the payroll register (previously omitted).
      const candidateIds = roster.map((c) => c.id);
      type PerEmpItem = { name: string; amount: number };
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
            .select("candidate_id, addition_type_id, addition_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for")
            .in("candidate_id", candidateIds)
            .gte("addition_date", start)
            .lte("addition_date", end)
            .eq("status", "active"),
          supabase
            .from("deductions" as never)
            .select("candidate_id, deduction_name, calculation_type, amount, installments, status, entry_mode, days, include_in_total_days, affects_days_for")
            .in("candidate_id", candidateIds)
            .gte("deduction_date", start)
            .lte("deduction_date", end)
            .eq("status", "active"),
          supabase.from("addition_types").select("id, code"),
        ]);
        const phTypeIds = new Set<string>(
          ((addTypesRes.data ?? []) as { id: string; code: string | null }[])
            .filter((t) => (t.code ?? "").toLowerCase() === "paid_holidays")
            .map((t) => t.id),
        );
        type RawAdd = { candidate_id: string; addition_type_id?: string | null; addition_name: string; calculation_type: string; amount: number | string; installments: number; entry_mode?: string | null; days?: number | string | null; include_in_total_days?: boolean | null; affects_days_for?: string[] | null };
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
            arr.push({ name: cleanLedgerName(a.addition_name), amount: Math.round(amt * 100) / 100 });
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
      type PdbMethod = "actual_days" | "fixed_days" | "actual_minus_weekly_off" | "custom_weekdays" | "fixed_annual_average";
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
      for (const r of resources) {
        const did = String(r.designation_id ?? "");
        if (!did) continue;
        resourceByDesignation.set(did, {
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
          payrollDayBase: r.payroll_day_base_id
            ? pdbMap.get(String(r.payroll_day_base_id)) ?? null
            : null,
        });
      }

      // Overlay latest formula_mode/expression/version from Control Center
      // masters so paysheets/invoices reflect master-formula edits without
      // requiring contracts to be re-saved.
      const hydratedList = (
        await hydrateFormulasFromMaster(Array.from(resourceByDesignation.values()))
      ).map(refreshBillingAddOns);
      for (const r of hydratedList) {
        resourceByDesignation.set(r.designationId, r);
      }

      // 4. Build line items per (candidate, designation_id).
      // Each candidate gets a primary line (their own designation) plus an extra
      // line for any other designation found in their attendance entries.
      const rosterById = new Map(roster.map((c) => [c.id, c]));
      const pairKey = (cid: string, did: string | null) => `${cid}|${did ?? "__none__"}`;
      const pairs = new Map<string, { candidateId: string; designationId: string | null }>();

      for (const c of roster) {
        const k = pairKey(c.id, c.designation_id ?? null);
        pairs.set(k, { candidateId: c.id, designationId: c.designation_id ?? null });
      }
      for (const e of entries) {
        if (!rosterById.has(e.candidate_id)) continue;
        const k = pairKey(e.candidate_id, e.designation_id);
        if (!pairs.has(k)) pairs.set(k, { candidateId: e.candidate_id, designationId: e.designation_id });
      }

      const rows = Array.from(pairs.values()).map((p) => {
        const c = rosterById.get(p.candidateId)!;
        const did = p.designationId ? String(p.designationId) : "";
        const designationName = (p.designationId && desigMap.get(p.designationId)) || "—";
        // Filter entries to just this (candidate, designation) pair so totals reflect only that line.
        const lineEntries = entries.filter(
          (e) => e.candidate_id === p.candidateId && (e.designation_id ?? null) === p.designationId,
        );
        const isPrimary = (c.designation_id ?? null) === p.designationId;
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
        const resource = resourceByDesignation.get(did);
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
          (wages as unknown as { additions: PerEmpItem[] }).additions = extraAdds;
          if (extraDeds.length > 0) {
            wages.deductions = [...wages.deductions, ...extraDeds];
          }
          const addTotal = extraAdds.reduce((s, a) => s + a.amount, 0);
          wages.earnedGross = Math.round((wages.earnedGross + addTotal) * 100) / 100;
          Object.assign(wages, applyEsiToWageComputation(wages, { isDisabled: candidateIsDisabled }));
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
            const lwfRes = resolveLwf(String(unitPincode ?? ""), pincodeRanges as never, lwfRows);
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
              components: mergeByCanonicalName(resource.components),
              benefits: mergeByCanonicalName(resource.benefits ?? []),
              deductions: mergeByCanonicalName(resource.deductions ?? []),
              employerContributions: mergeByCanonicalName(resource.employerContributions ?? []),
            }
          : null;
        if (wages) {
          wages.components = mergeByCanonicalName(wages.components) as typeof wages.components;
          wages.deductions = mergeByCanonicalName(wages.deductions) as typeof wages.deductions;
          wages.employerContributions = mergeByCanonicalName(wages.employerContributions) as typeof wages.employerContributions;
        }
        return {
          id: c.id,
          rowKey: pairKey(c.id, p.designationId),
          employeeCode: c.employee_code || "",
          joiningDate:
            ((c as { preferred_joining_date?: string | null }).preferred_joining_date ?? null) as string | null,
          name: c.full_name || "—",
          designation: designationName,
          designationId: p.designationId,
          isPrimary,
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
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
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
    },
  });



  const rows = data?.rows ?? [];
  const billingMode = data?.billingMode ?? "man_days";
  const contractId = data?.contractId ?? null;
  const shiftHoursByDesignation = data?.shiftHoursByDesignation ?? new Map<string, number>();
  const billingDayBaseByDesignation =
    data?.billingDayBaseByDesignation ?? new Map<string, NonNullable<ContractResourceLike["payrollDayBase"]>>();


  useEffect(() => {
    if (!highlightCandidate || rows.length === 0) return;
    const el = document.getElementById(`invoice-row-${highlightCandidate}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightCandidate, rows.length]);



  const { data: orgSettings } = useOrgSettings();
  const { data: gstBranches = [] } = useGstBillingBranches();
  const supplierBranch = resolveGstBillingBranch(gstBranches, unitState, orgSettings);
  const COMPANY_STATE = (supplierBranch?.stateName ?? orgSettings?.company_state ?? "Maharashtra").trim();
  const COMPANY_STATE_SHORT = COMPANY_STATE.slice(0, 4);
  const isIntraState = normalizeState(unitState) === normalizeState(COMPANY_STATE);

  // ---------------------------------------------------------------------
  // SIMPLIFIED INVOICE MODEL
  // Contracted invoice = full contract billable value for the designation
  //   (all salary components + employer contributions).
  // Payroll days       = the contract's payroll-day base for this period
  //   (e.g. 26 fixed, actual days, actual minus weekly off) — never hard-coded.
  // Actual invoice     = contracted / payroll days × days actually billed
  //   (T days = present + paid holidays + other paid + OT days).
  // 26 days billed on a 26-day base → exactly the contract amount.
  // 28 days billed on a 26-day base → contract / 26 × 28.
  // ---------------------------------------------------------------------

  const invoiceMathFor = (r: (typeof rows)[number]) => {
    const contracted = r.resource ? contractBillableMonthly(r.resource as never) : 0;

    const payrollDays =
      resolvePayrollDayCount(r.resource?.payrollDayBase ?? null, periodDates) ??
      (r.wages?.baseDays || periodDates.length || 30);
    // Days printed on the invoice always come from the payroll-days rule.
    // The hourly-rate divisor uses the billing-days rule when configured.
    const billingDays =
      resolvePayrollDayCount(
        billingDayBaseByDesignation.get(String(r.designationId ?? "")) ?? r.resource?.payrollDayBase ?? null,
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
    const shiftHours = shiftHoursByDesignation.get(String(r.designationId ?? "__none__")) ?? 8;
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



  const billableFor = (r: (typeof rows)[number]): number => invoiceMathFor(r).actual;


  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (!r.wages) return acc;
        const m = invoiceMathFor(r);
        acc.projectedTotal += m.contracted;
        acc.actualTotal += m.actual;
        acc.tDays += r.totals.tDays;
        acc.payrollDays += m.payrollDays;
        acc.otHours += r.totals.otHours;
        return acc;
      },
      { projectedTotal: 0, actualTotal: 0, tDays: 0, payrollDays: 0, otHours: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, billingMode]);

  /** One row per designation: headcount, billed hours, per-hour rate and money. */
  const designationRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        designation: string;
        headcount: number;
        billedDays: number;
        billedHours: number;
        perHour: number;
        contracted: number;
        actual: number;
      }
    >();
    for (const r of rows) {
      if (!r.wages) continue;
      const m = invoiceMathFor(r);
      const key = String(r.designationId ?? "__none__");
      const existing =
        map.get(key) ??
        {
          key,
          designation: r.designation,
          headcount: 0,
          billedDays: 0,
          billedHours: 0,
          perHour: m.unitRate,
          contracted: 0,
          actual: 0,
        };
      existing.headcount += 1;
      existing.billedDays = Math.round((existing.billedDays + m.billedDays) * 100) / 100;
      existing.billedHours = Math.round((existing.billedHours + m.billedHours) * 100) / 100;
      existing.perHour = m.unitRate || existing.perHour;
      existing.contracted = Math.round((existing.contracted + m.contracted) * 100) / 100;
      existing.actual = Math.round((existing.actual + m.actual) * 100) / 100;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.designation.localeCompare(b.designation));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, billingMode]);


  const GST_RATE = 18;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  // Configured extra charges for this unit + period (e.g. Technical Allowance).
  const { data: extraCharges = [] } = useInvoiceExtraCharges(unitId, start, end);
  const activeExtras = extraCharges.filter((c) => c.enabled);
  const extrasTotal = r2(activeExtras.reduce((s, c) => s + c.amount, 0));
  const taxableValue = r2(totals.actualTotal + extrasTotal);
  const tax = taxSplit(taxableValue, isIntraState);
  const cgstAmount = tax.cgst;
  const sgstAmount = tax.sgst;
  const igstAmount = tax.igst;
  const gstAmount = tax.total;
  const grandTotal = r2(taxableValue + gstAmount);
  const roundedGrandTotal = Math.round(grandTotal);
  const roundingOff = r2(roundedGrandTotal - grandTotal);

  // Printed tax invoice: one line per designation × hourly rate, billed on hours.
  const invoiceSheetData: TaxInvoiceData | null = useMemo(() => {
    const billable = rows.filter((r) => r.wages && r.resource);
    if (billable.length === 0) return null;
    const hsn = orgSettings?.default_hsn_sac ?? "";
    type Group = {
      designation: string;
      monthly: number;
      payrollDays: number;
      shiftHours: number;
      unitRate: number;
      unitLabel: string;
      quantity: number;
      amount: number;
    };
    const groups = new Map<string, Group>();
    for (const r of billable) {
      const m = invoiceMathFor(r);
      const key = `${r.designation}|${m.unitRate}|${m.shiftHours}|${m.payrollDays}`;
      const g = groups.get(key) ?? {
        designation: r.designation,
        monthly: m.contracted,
        payrollDays: m.payrollDays,
        shiftHours: m.shiftHours,
        unitRate: m.unitRate,
        unitLabel: m.unitLabel,
        quantity: 0,
        amount: 0,
      };
      g.quantity = r2(g.quantity + m.unitQuantity);
      g.amount = r2(g.amount + m.actual);
      groups.set(key, g);
    }
    const list = Array.from(groups.values());
    const totalQuantity = r2(list.reduce((s, g) => s + g.quantity, 0));
    const quantityUnit = list[0]?.unitLabel ?? "Duty";
    const monthIdx = Number(start.split("-")[1]) - 1;
    const monthAbbr = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][monthIdx] ?? "";
    return {
      invoiceNumber:
        finalInvoice?.invoice_no ??
        `PROVISIONAL ${monthAbbr}${start.slice(2, 4)} ${(unit?.code ?? "UNIT").toUpperCase()}`,
      invoiceDate: fmtPretty(end),
      periodLabel: `${start.split("-").reverse().join("-")} To ${end.split("-").reverse().join("-")}`,
      company: {
        name: orgSettings?.company_name ?? "",
        registeredAddress: supplierBranch?.registeredAddress ?? orgSettings?.registered_address ?? "",
        corporateAddress: supplierBranch?.corporateAddress ?? orgSettings?.corporate_address ?? "",
        gstin: supplierBranch?.gstin ?? orgSettings?.company_gstin ?? "",
        stateName: COMPANY_STATE,
        stateCode: supplierBranch?.stateCode ?? orgSettings?.company_state_code ?? "",
        cin: orgSettings?.cin ?? "",
        pan: orgSettings?.pan ?? "",
        email: orgSettings?.email ?? "",
        phone: orgSettings?.phone ?? "",
        bankName: orgSettings?.bank_name ?? "",
        bankAccountNo: orgSettings?.bank_account_no ?? "",
        bankBranch: orgSettings?.bank_branch ?? "",
        bankIfsc: orgSettings?.bank_ifsc ?? "",
        supplierType: orgSettings?.supplier_type ?? "",
        msmeUdyamNo: orgSettings?.msme_udyam_no ?? "",
        pfNumber: orgSettings?.pf_number ?? "",
        esicNumber: orgSettings?.esic_number ?? "",
        declaration: orgSettings?.invoice_declaration ?? "",
        note: orgSettings?.invoice_note ?? "",
      },
      party: {
        name: [unit?.customer_name, unit?.name].filter(Boolean).join("_"),
        addressLines: [
          unit?.billing_address1 ?? unit?.customer?.billing_address1 ?? "",
          unit?.billing_address2 ?? unit?.customer?.billing_address2 ?? "",
          [
            unit?.billing_city ?? unit?.customer?.billing_city,
            unit?.billing_district ?? unit?.customer?.billing_district,
            unit?.billing_pincode ?? unit?.customer?.billing_pincode,
          ].filter(Boolean).join(", "),
        ],
        gstin: unit?.gstin ?? "",
        stateName: unitState ?? "",
        stateCode: gstinStateCode(unit?.gstin ?? "") || "",
      },
      lines: [
        ...list.map((g, i) => ({
          id: `${g.designation}-${i}`,
          description:
            g.unitLabel === "hrs"
              ? `${g.designation} @ Rs. ${g.unitRate.toFixed(2)} Per Hour for ${g.payrollDays} Days For ${String(g.shiftHours).padStart(2, "0")} Hrs Duty`
              : `${g.designation} @ Rs ${Math.round(g.monthly)}/-`,
          hsnSac: hsn,
          quantityLabel: g.unitLabel === "hrs" ? `${g.quantity.toFixed(2)} hrs` : g.quantity.toFixed(2),
          rate: g.unitRate,
          per: g.unitLabel === "hrs" ? "hrs" : "Duty",
          amount: g.amount,
        })),
        // Configured additional charges print as their own invoice lines.
        ...activeExtras.map((c) => ({
          id: c.id,
          description: c.description,
          hsnSac: c.hsnSac || hsn,
          quantityLabel: `${c.quantity}`,
          rate: c.rate,
          per: c.perLabel,
          amount: c.amount,
        })),
      ],
      totalQuantityLabel:
        quantityUnit === "hrs"
          ? `${r2(totalQuantity + activeExtras.reduce((n, c) => n + c.quantity, 0)).toFixed(2)} hrs`
          : `${r2(totalQuantity + activeExtras.reduce((n, c) => n + c.quantity, 0)).toFixed(2)} Duty`,
      taxableValue,
      cgstRate: GST_RATE / 2,
      sgstRate: GST_RATE / 2,
      cgst: cgstAmount,
      sgst: sgstAmount,
      igstRate: isIntraState ? 0 : GST_RATE,
      igst: igstAmount,
      roundingOff,
      grandTotal: roundedGrandTotal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orgSettings, supplierBranch, unit, unitState, activeExtras, taxableValue, cgstAmount, sgstAmount, igstAmount, isIntraState, roundingOff, roundedGrandTotal, start, end, finalInvoice]);


  /**
   * Manpower-wise MIS export — exactly the client MIS workbook layout
   * (Sr. No … Grand Total). Every value is pulled from the open client's own
   * roster, contract rate card and approved attendance for this period.
   */
  const exportMisFormat = async () => {
    const dmy = (iso: string | null | undefined) => {
      const s = String(iso ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
      const [y, m, d] = s.split("-");
      return `${d}-${m}-${y}`;
    };
    const monthAbbr = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const [ys, ms] = start.split("-").map(Number);
    const fyEnd = (ms >= 4 ? ys : ys - 1) + 1;
    const invoiceNo =
      invoiceSheetData?.invoiceNumber ??
      `${monthAbbr[ms - 1]}${String(ys).slice(2)}-${String(fyEnd).slice(2)}${(unit?.code ?? "").toUpperCase()}`;
    const entity = orgSettings?.company_name || "Radiant";
    const siteLabel = unit?.name || unit?.code || "";
    const clientLabel = unit?.customer_name ?? "";
    // The client's own MIS prints "<entity>, <branch>". Avoid repeating the client
    // name when the site name already carries it.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const branchName =
      clientLabel && !norm(siteLabel).includes(norm(clientLabel))
        ? [clientLabel, siteLabel].filter(Boolean).join(", ")
        : siteLabel;
    const stateName = unit?.billing_state ?? "";
    const sapCode = (unit as { branch_sap_code?: string | null } | null | undefined)?.branch_sap_code ?? "";
    const zone = (unit as { zone?: string | null } | null | undefined)?.zone ?? "";
    const monthDays = periodDates.length;

    // Columns, order and headings come from the organization's MIS format
    // (Control Center → MIS); custom columns print the value saved for this site.
    const template = await loadMisTemplateForCustomer(unit?.customer_id ?? null);
    const unitValues = template ? await loadMisUnitValues(template.id, [unitId]) : undefined;

    const billable = rows.filter((r) => r.wages && r.resource);
    const sourceRows = billable.map((r, i) => {
      const m = invoiceMathFor(r);
      // Everything below comes straight from the invoice: the per-duty rate the
      // invoice bills, and Extra Duty at that very same rate.
      const line = misBillingLine({
        perDay: m.perDay,
        billedDays: m.billedDays ?? 0,
        otDays: r.totals.otDays ?? 0,
        total: m.actual,
        intraState: isIntraState,
        maxWorkingDays: m.billingDays,
      });

      const otDays = line.otDays;
      const workingDays = line.workingDays;
      const otHours = otDays;
      // OT rate is hourly: the invoice's per-duty rate divided by the
      // contractual shift length (8h or 12h unit).
      const otRate = r2(line.otRate / (m.shiftHours > 0 ? m.shiftHours : 8));
      const otAmount = line.otAmount;
      const regular = line.regularBilling;
      const otBilling = line.otBilling;
      const totalBilling = line.totalBilling;
      const { cgst, sgst, igst } = line;
      // Annexure sheets split duties between staff on the starting rate and
      // staff who have completed a year of service (incremented rate).
      const joined = String(r.joiningDate ?? "").slice(0, 10);
      const hasIncrement = !!joined && new Date(joined) <= new Date(new Date(start).setFullYear(new Date(start).getFullYear() - 1));
      return {
        unitId,
        values: {
          sr_no: i + 1,
          invoice_no: invoiceNo,
          invoice_date: dmy(end),
          emp_code: r.employeeCode,
          employee_name: r.name,
          regular_reliever: r.isPrimary ? "Regular" : "Reliever",
          doj: dmy(r.joiningDate),
          entity,
          designation: `${r.designation} @ (${m.shiftHours})`,
          branch_name: branchName,
          state: stateName,
          branch_sap_code: sapCode,
          zone,
          month_days: monthDays,
          month_rate: m.payrollDays,
          billing_rate: r2(m.contracted),
          billing_rate_per_day: m.perDay,
          ot_rate: otRate,
          working_days: workingDays,
          ot_duties: otDays,
          ot_amount: otAmount,
          working_days_billing_with_ot: r2(regular + otBilling),
          total_regular_billing: regular,
          ot_billing: otBilling,
          total_billing: totalBilling,
          cgst,
          sgst,
          igst,
          grand_total: r2(totalBilling + line.gstTotal),
          // Billing-annexure fields (site-summary formats)
          cli_id: unit?.code ?? "",
          vendor_name: entity,
          district: unit?.billing_district ?? unit?.billing_city ?? "",
          pin_code: unit?.billing_pincode ?? "",
          address: [unit?.billing_address1, unit?.billing_address2].filter(Boolean).join(", "),
          gst_no: unit?.gst_number ?? "",
          invoice_month: `${dmy(start)} To ${dmy(end)}`,
          sg_count: 1,
          regular_rate: r2(m.contracted),
          increment_rate: hasIncrement ? r2(m.contracted) : 0,
          regular_duties: hasIncrement ? 0 : workingDays,
          increment_duties: hasIncrement ? workingDays : 0,
          regular_ot_hours: hasIncrement ? 0 : otHours,
          increment_ot_hours: hasIncrement ? otHours : 0,
          service_charge_claimed: totalBilling,
          gst_18: line.gstTotal,
          invoice_value: r2(totalBilling + line.gstTotal),
          total_duties: r2(workingDays + otDays),
          total_ot_hours: otHours,
          remarks: "",
          sg_rate: r2(m.contracted),
          worked_days: r2(workingDays + otDays),
          service_start_date: dmy(start),
          service_end_date: dmy(end),
          basic_billing_claimed: totalBilling,
        },
      };
    });

    const sheet = buildMisSheet({ template, sourceRows, unitValues });

    await writeXlsx({
      filename: `MIS_${(unit?.code || unitId).toUpperCase()}_${start}_to_${end}`,
      rows: sheet.rows,
      columns: sheet.columns,
    });
  };

  const exportTallyBilling = async () => {
    if (!unit) return;
    const { data: contracts } = await supabase
      .from("client_contracts")
      .select("service_type_id")
      .eq("unit_id", unitId)
      .eq("record_type", "client")
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);
    const serviceTypeId = contracts?.[0]?.service_type_id ?? null;
    let serviceTypeName = "Security Guard";
    if (serviceTypeId) {
      const { data: serviceType } = await supabase
        .from("service_types")
        .select("name")
        .eq("id", serviceTypeId)
        .maybeSingle();
      if (serviceType?.name) serviceTypeName = String(serviceType.name);
    }

    const lines = rows
      .filter((row) => row.wages && row.resource)
      .map((row) => {
        const math = invoiceMathFor(row);
        if (billingMode === "lumpsum") {
          return { qty: 1, rate: math.actual, amount: math.actual, monthly: math.contracted };
        }
        return {
          qty: math.unitQuantity,
          rate: math.unitRate,
          amount: math.actual,
          monthly: math.contracted,
        };
      })
      .filter((line) => line.amount > 0);

    if (lines.length === 0) {
      toast.error("No billable rows for this period yet.");
      return;
    }
    const stateCode = gstinStateCode(unit.gstin ?? "") || "00";
    await writeTallyBillingXlsx(
      `Billing File_${end}_${(unit.code || unitId).toUpperCase()}_${stateCode}`,
      buildTallyVoucherRows({
        unit,
        companyState: COMPANY_STATE,
        periodStart: start,
        periodEnd: end,
        serviceTypeName,
        lines,
      }),
    );
  };

  const uploadTallyInvoice = async (file: File) => {
    if (!sheet?.id || !canUploadTallyInvoice) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("The Tally invoice must be 20 MB or smaller");
      return;
    }
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    if (!allowedTypes.has(file.type)) {
      toast.error("Upload a PDF, image, XLS, or XLSX file");
      return;
    }
    if (!window.confirm(sheet.tally_invoice_path ? "Replace the uploaded Tally invoice?" : "Upload this Tally invoice?")) return;

    setUploadingTallyInvoice(true);
    const oldPath = sheet.tally_invoice_path;
    try {
      const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const extension = rawExtension.replace(/[^a-z0-9]/g, "") || "pdf";
      const path = `${sheet.id}/tally-invoice-${Date.now()}.${extension}`;
      const uploadResult = await supabase.storage
        .from("tally-invoices")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadResult.error) throw uploadResult.error;

      const { data: auth } = await supabase.auth.getUser();
      const uploadedAt = new Date().toISOString();
      const updateResult = await supabase
        .from("attendance_sheets" as never)
        .update({
          tally_invoice_path: path,
          tally_invoice_name: file.name,
          tally_invoice_uploaded_at: uploadedAt,
          tally_invoice_uploaded_by: auth.user?.id ?? null,
        } as never)
        .eq("id", sheet.id);
      if (updateResult.error) {
        await supabase.storage.from("tally-invoices").remove([path]);
        throw updateResult.error;
      }
      if (oldPath && oldPath !== path) {
        await supabase.storage.from("tally-invoices").remove([oldPath]);
      }
      await logActivity({
        module: "Invoice",
        action: oldPath ? "update" : "upload",
        entityType: "attendance_sheets",
        entityId: sheet.id,
        entityLabel: `${unit?.code ?? unitId} · ${start} to ${end}`,
        details: { document: "Tally invoice", filename: file.name },
      });
      await queryClient.invalidateQueries({ queryKey: ["payroll-sheet", unitId, start, end] });
      await queryClient.invalidateQueries({ queryKey: [PERIOD_STATUS_QK] });
      toast.success(oldPath ? "Tally invoice replaced" : "Tally invoice uploaded — invoice processed");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Could not upload Tally invoice");
    } finally {
      setUploadingTallyInvoice(false);
      if (tallyInvoiceInputRef.current) tallyInvoiceInputRef.current.value = "";
    }
  };

  const viewTallyInvoice = async () => {
    if (!sheet?.tally_invoice_path) return;
    const invoiceWindow = window.open("about:blank", "_blank");
    if (invoiceWindow) invoiceWindow.opener = null;
    const { data: signed, error: signedError } = await supabase.storage
      .from("tally-invoices")
      .createSignedUrl(sheet.tally_invoice_path, 300);
    if (signedError || !signed?.signedUrl) {
      invoiceWindow?.close();
      toast.error("Could not open the Tally invoice");
      return;
    }
    if (invoiceWindow) invoiceWindow.location.href = signed.signedUrl;
    else window.location.href = signed.signedUrl;
  };

  const invoiceUnlocked = sheet?.status === "approved";
  if (!invoiceUnlocked) {
    const attStatus = sheet?.status ?? null;
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin/invoice" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Back to invoice units
          </Link>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em]">Invoice locked</div>
          <h1 className="mt-1 text-2xl font-semibold">{unit?.name || unit?.code || "Client"}</h1>
          <p className="mt-3 text-sm">
            Invoice for {fmtPretty(start)} – {fmtPretty(end)} cannot be generated because attendance is
            {attStatus ? ` "${attStatus}"` : " not yet submitted"}. Invoices only run against <strong>approved</strong> attendance.
          </p>
          <div className="mt-4">
            <Link to="/admin/attendance/$unitId" params={{ unitId }} search={{ month: new Date(start).getMonth(), year: new Date(start).getFullYear() }}>
              <Button size="sm">Open attendance sheet</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/invoice"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to invoice units
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={tallyInvoiceInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadTallyInvoice(file);
            }}
          />
          {sheet?.tally_invoice_path && (
            <Button variant="outline" size="sm" onClick={() => void viewTallyInvoice()}>
              <Eye className="mr-1.5 h-4 w-4" /> View Tally Invoice
            </Button>
          )}
          {canUploadTallyInvoice && !sheet?.tally_invoice_path && (
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingTallyInvoice}
              onClick={() => tallyInvoiceInputRef.current?.click()}
            >
              {uploadingTallyInvoice ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Upload Tally Invoice
            </Button>
          )}
          {can("invoice", "edit") && !finalInvoice && (
            <Button size="sm" disabled={sheet?.status !== "approved"} onClick={() => setFinalDialogOpen(true)}>
              <FileCheck2 className="mr-1.5 h-4 w-4" /> Generate Final Invoice
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void exportTallyBilling()}>
            <Download className="mr-1.5 h-4 w-4" /> Download Tally Format
          </Button>
          {misApplicable && (
            <Button variant="outline" size="sm" onClick={exportMisFormat}>
              <Download className="mr-1.5 h-4 w-4" /> MIS Format
            </Button>
          )}
        </div>
      </div>



      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer invoice</div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{unit?.name || unit?.code || "Client"}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {unit?.customer_name} · Period {fmtPretty(start)} – {fmtPretty(end)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sheet?.status === "approved" && (
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Attendance approved
              </span>
            )}
            {finalInvoice ? (
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tabular-nums text-emerald-700">
                Invoice {finalInvoice.invoice_no} · {finalInvoice.invoice_date}
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
                Not finalised — no invoice number yet
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 font-semibold uppercase tracking-wider text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
            Billing mode: {billingMode.replace("_", " ")}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            title={`Company state: ${COMPANY_STATE} · Client state: ${unitState ?? "—"}`}
          >
            {isIntraState ? "CGST 9% + SGST 9%" : "IGST 18%"}
          </span>
          {(supplierBranch?.gstin ?? orgSettings?.company_gstin) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-mono font-semibold tracking-wider text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
              Company GSTIN: {supplierBranch?.gstin ?? orgSettings?.company_gstin}
            </span>
          )}
          {unit?.gstin && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-2.5 py-1 font-mono font-semibold tracking-wider text-teal-800 dark:bg-teal-500/20 dark:text-teal-200">
              Customer GSTIN: {unit.gstin}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Days billed" value={String(Math.round(totals.tDays * 100) / 100)} />
          <Stat label="Payroll days (sum)" value={String(Math.round(totals.payrollDays * 100) / 100)} />
          <Stat label="Contracted invoice" value={fmtINR(totals.projectedTotal)} />
          <Stat label="Actual invoice" value={fmtINR(totals.actualTotal)} tone="emerald" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Additional charges" value={fmtINR(extrasTotal)} />
          <Stat label="Taxable value" value={fmtINR(taxableValue)} tone="emerald" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {isIntraState ? <>
            <Stat label={`CGST @ ${GST_RATE / 2}%`} value={fmtINR(cgstAmount)} />
            <Stat label={`SGST @ ${GST_RATE / 2}%`} value={fmtINR(sgstAmount)} />
          </> : <Stat label={`IGST @ ${GST_RATE}%`} value={fmtINR(igstAmount)} />}
          <Stat label={`Total GST @ ${GST_RATE}%`} value={fmtINR(gstAmount)} />
          <Stat label="Invoice grand total" value={fmtINR(grandTotal)} tone="emerald" />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="overflow-x-clip">
          <table className="ios-table min-w-full table-auto text-sm">
            <thead className="border-b border-border/60 bg-secondary/40">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 text-right font-medium" title="Number of resources billed under this designation">Count</th>
                <th className="px-4 py-3 text-right font-medium" title="Total days billed across all resources of this designation">Days billed</th>
                <th className="px-4 py-3 text-right font-medium" title="Days billed × contracted shift hours">Hours billed</th>
                <th className="px-4 py-3 text-right font-medium" title="Contracted invoice ÷ billing days (÷ shift hours when the contract bills man hours)">{billingMode === "man_hours" ? "Per hour" : "Per duty"}</th>
                <th className="px-4 py-3 text-right font-medium" title="Full contract value for this designation">Contracted invoice</th>
                <th className="px-4 py-3 text-right font-medium" title="Per hour × hours billed">Actual invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Computing invoice…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-destructive">{error instanceof Error ? error.message : "Failed"}</td></tr>
              ) : designationRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No billable resources for this period.</td></tr>
              ) : designationRows.map((g) => (
                <tr key={g.key} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{g.designation}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{g.headcount}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{g.billedDays}</td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">{g.billedHours} hrs</td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">₹{g.perHour.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtINR(g.contracted)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">{fmtINR(g.actual)}</td>
                </tr>
              ))}
            </tbody>
            {designationRows.length > 0 && (
              <tfoot className="border-t border-border/60 bg-secondary/30 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-3">Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{designationRows.reduce((s, g) => s + g.headcount, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Math.round(designationRows.reduce((s, g) => s + g.billedDays, 0) * 100) / 100}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Math.round(designationRows.reduce((s, g) => s + g.billedHours, 0) * 100) / 100} hrs</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmtINR(totals.projectedTotal)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmtINR(totals.actualTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>


      <InvoiceExtraChargesCard
        unitId={unitId}
        contractId={contractId}
        start={start}
        end={end}
        charges={extraCharges}
      />

      {invoiceSheetData && <TaxInvoiceSheet data={invoiceSheetData} />}

      <FinalInvoiceDialog
        open={finalDialogOpen}
        onOpenChange={setFinalDialogOpen}
        targets={
          [
            {
              unitId,
              unitLabel: unit?.name || unit?.code || "Site",
              customerId: unit?.customer_id ?? null,
              customerName: unit?.customer_name ?? "",
              billingState: unitState ?? null,
              periodStart: start,
              periodEnd: end,
              taxableValue,
            },
          ] satisfies FinalInvoiceTarget[]
        }
      />

      <div className="space-y-4">


        {rows.filter((r) => !r.wages).length > 0 && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">
            {rows.filter((r) => !r.wages).length} employee(s) have no contract mapped for their designation and were excluded from the breakdown.
          </div>
        )}
      </div>
    </div>
  );
}


function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-background px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
