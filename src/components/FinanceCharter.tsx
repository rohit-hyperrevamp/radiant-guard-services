import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, ChevronDown, Download, Gauge, IndianRupee, Lock, LockOpen, MapPinned, Receipt, Search, Users, Wallet } from "lucide-react";
import { CharterTile, CharterTileGrid } from "@/components/CharterTiles";
import { CharterPagination } from "@/components/CharterPagination";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, writeXlsx } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { fetchUnitFinance, rateFor, fmtMoney, fmtMoneyCompact, type UnitFinance } from "@/lib/contract-finance";
import {
  fetchPeriodStatusesForUnitPeriods,
  PERIOD_STATUS_QK,
  setMoneyStatus,
  useAttendanceMoneyRealtime,
  type MoneyStatus,
  type PeriodStatus,
} from "@/lib/period-status";
import { AttendanceStatusBadge, MoneyStatusBadge } from "@/components/PeriodStatusBadge";
import { useCurrentPermissions } from "@/lib/rbac";
import type { CharterUnitRow } from "@/lib/charter-units";
import { payrollPeriodForMonth, type PayrollWindow } from "@/lib/payroll-period";


// ---------------------------------------------------------------------------
// Finance charter — the shared Invoice / Payroll landing view.
// Reads exactly like the attendance charter, but the currency is money instead
// of days: contracted value, period-to-date invoice value, and the payroll
// (gross) that sits behind it, so the margin is visible on both surfaces.
// ---------------------------------------------------------------------------

type CodeRow = { code: string; counts_as_present: boolean; is_paid: boolean; day_value: number | string | null };

type PersonMoney = {
  id: string;
  name: string;
  designationId: string | null;
  designationName: string;
  paidDays: number;
  otDays: number;
  /** Flat contracted monthly gross per head — no OT, no pro-rating. */
  contractedGross: number;
  /** Flat contracted monthly bill rate per head — no OT, no pro-rating. */
  contractedBill: number;
  invoiceAmount: number;
  /** Earned gross wages for the days paid. */
  payrollAmount: number;
  /** Contract-level statutory / recurring deductions earned in the period. */
  deductionAmount: number;
  /** Net payable = gross − deductions. */
  netPayrollAmount: number;
};


function pct(actual: number, projected: number) {
  if (projected <= 0) return 0;
  return Math.round((actual / projected) * 100);
}

function toneFor(value: number) {
  if (value >= 100) return "emerald";
  if (value >= 85) return "amber";
  return "rose";
}

function Dial({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 130));
  const tone = toneFor(value);
  const stroke =
    tone === "emerald"
      ? "var(--color-emerald-500, #10b981)"
      : tone === "amber"
        ? "var(--color-amber-500, #f59e0b)"
        : "hsl(var(--destructive))";
  const r = 17;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(clamped, 100) / 100) * c;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-border" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">
        {value}%
      </span>
    </div>
  );
}

function MarginChip({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[52px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        value >= 20 && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
        value >= 0 && value < 20 && "border-amber-500/25 bg-amber-500/10 text-amber-600",
        value < 0 && "border-destructive/25 bg-destructive/10 text-destructive",
      )}
    >
      {value}%
    </span>
  );
}

const PAGE_SIZE = 25;

export function FinanceCharter({
  mode,
  units,
  monthIdx,
  year,
  query,
  onQueryChange,
  organizationCount,
  activeEmployees,
  filters,
  windowsByUnit,
  statusFilter = "all",
  onStatusFilterChange,
}: {
  mode: "invoice" | "payroll";
  units: CharterUnitRow[];
  monthIdx: number;
  year: number;
  query: string;
  onQueryChange: (v: string) => void;
  organizationCount?: number;
  activeEmployees?: number;
  filters?: ReactNode;
  windowsByUnit: Map<string, PayrollWindow>;
  statusFilter?: "all" | MoneyStatus;
  onStatusFilterChange?: (value: "all" | MoneyStatus) => void;
}) {

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Search, then paginate, then load money for the visible page only. Contract
  // rates, attendance entries and period statuses are all fetched for these 25
  // units — never for the whole charter.
  const searchedUnits = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? units.filter((u) =>
          [u.name, u.code, u.customer_name, ...u.contract_codes]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
        )
      : units.slice();
    return list.sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code));
  }, [units, query]);

  const [page, setPage] = useState(0);
  // The stage tile reflects the whole charter, not just the visible page, so
  // windows and period statuses are also fetched (ids + status only — cheap)
  // for every searched unit. This also lets status filtering happen before pagination.
  const allUnitIds = useMemo(() => searchedUnits.map((u) => u.id), [searchedUnits]);
  const qc = useQueryClient();
  const { can, isSuperAdmin } = useCurrentPermissions();
  const canProcess = isSuperAdmin || can(mode === "invoice" ? "invoice" : "payroll", "approve");

  // Attendance edits (including overtime) push straight through to these
  // numbers — no refresh, no stale cache.
  useAttendanceMoneyRealtime();

  const codesQ = useQuery({
    queryKey: ["attendance-codes-charter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_codes" as never)
        .select("code, counts_as_present, is_paid, day_value");
      return ((data ?? []) as unknown) as CodeRow[];
    },
  });

  const allPeriodsByUnit = useMemo(() => {
    const out = new Map<string, ReturnType<typeof payrollPeriodForMonth>>();
    for (const unitId of allUnitIds) out.set(unitId, payrollPeriodForMonth(year, monthIdx, windowsByUnit.get(unitId)));
    return out;
  }, [allUnitIds, year, monthIdx, windowsByUnit]);
  const allPeriodKey = useMemo(
    () => Array.from(allPeriodsByUnit, ([unitId, p]) => `${unitId}:${p.start}:${p.end}`).join("|"),
    [allPeriodsByUnit],
  );
  const allStatusQ = useQuery({
    queryKey: [PERIOD_STATUS_QK, "charter-all", allPeriodKey],
    enabled: allUnitIds.length > 0,
    staleTime: 0,
    queryFn: () => fetchPeriodStatusesForUnitPeriods(allPeriodsByUnit),
  });

  const matchedUnits = useMemo(() => {
    if (statusFilter === "all") return searchedUnits;
    return searchedUnits.filter((unit) => {
      const status = mode === "invoice"
        ? allStatusQ.data?.get(unit.id)?.invoice ?? "open"
        : allStatusQ.data?.get(unit.id)?.payroll ?? "open";
      if (mode === "payroll" && statusFilter === "open") return status !== "processed";
      return status === statusFilter;
    });
  }, [allStatusQ.data, mode, searchedUnits, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(matchedUnits.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => setPage(0), [query, statusFilter, units.length, monthIdx, year]);
  const pageUnits = useMemo(
    () => matchedUnits.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [matchedUnits, safePage],
  );
  const unitIds = useMemo(() => pageUnits.map((u) => u.id), [pageUnits]);

  const periodsByUnit = useMemo(() => {
    const out = new Map<string, ReturnType<typeof payrollPeriodForMonth>>();
    for (const unitId of unitIds) out.set(unitId, payrollPeriodForMonth(year, monthIdx, windowsByUnit.get(unitId)));
    return out;
  }, [unitIds, year, monthIdx, windowsByUnit]);
  const periodKey = useMemo(
    () => Array.from(periodsByUnit, ([unitId, p]) => `${unitId}:${p.start}:${p.end}`).join("|"),
    [periodsByUnit],
  );

  const financeQ = useQuery({
    queryKey: ["finance-charter-contracts", unitIds.join(",")],
    enabled: unitIds.length > 0,
    queryFn: () => fetchUnitFinance(unitIds),
  });

  const entriesQ = useQuery({
    queryKey: ["finance-charter-entries", periodKey],
    enabled: unitIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const groups = new Map<string, { start: string; end: string; unitIds: string[] }>();
      for (const [unitId, period] of periodsByUnit) {
        const key = `${period.start}|${period.mtdEnd}`;
        const group = groups.get(key) ?? { start: period.start, end: period.mtdEnd, unitIds: [] };
        group.unitIds.push(unitId);
        groups.set(key, group);
      }
      const pages = await Promise.all(
        Array.from(groups.values()).map((group) =>
          fetchAttendanceEntriesForPeriod({ unitIds: group.unitIds, start: group.start, end: group.end, includeUnitId: true }),
        ),
      );
      return pages.flat();
    },
  });

  const statusQ = useQuery({
    queryKey: [PERIOD_STATUS_QK, periodKey],
    enabled: unitIds.length > 0,
    staleTime: 0,
    queryFn: () => fetchPeriodStatusesForUnitPeriods(periodsByUnit),
  });

  const processMutation = useMutation({
    mutationFn: (vars: { unitId: string; next: "processed" | "open" }) =>
      setMoneyStatus({
        unitId: vars.unitId,
        periodStart: periodsByUnit.get(vars.unitId)?.start ?? payrollPeriodForMonth(year, monthIdx).start,
        periodEnd: periodsByUnit.get(vars.unitId)?.end ?? payrollPeriodForMonth(year, monthIdx).end,
        kind: mode,
        next: vars.next,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [PERIOD_STATUS_QK] });
      toast.success(
        vars.next === "processed"
          ? `${mode === "invoice" ? "Invoice" : "Payroll"} marked processed`
          : `${mode === "invoice" ? "Invoice" : "Payroll"} reopened`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update status"),
  });


  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of units) for (const g of u.security_guards) m.set(g.id, g.name);
    return m;
  }, [units]);

  const codeMap = useMemo(() => {
    const m = new Map<string, CodeRow>();
    for (const c of codesQ.data ?? []) m.set(c.code, c);
    return m;
  }, [codesQ.data]);

  const statsByUnit = useMemo(() => {
    const out = new Map<string, Map<string, PersonMoney>>();
    for (const e of entriesQ.data ?? []) {
      const unitId = e.unit_id ?? "";
      if (!unitId) continue;
      const finance = financeQ.data?.get(unitId);
      const rate = rateFor(finance, e.designation_id);
      const periodDays = periodsByUnit.get(unitId)?.totalDays ?? 1;
      if (!out.has(unitId)) out.set(unitId, new Map());
      const bucket = out.get(unitId)!;
      let person = bucket.get(e.candidate_id);
      if (!person) {
        person = {
          id: e.candidate_id,
          name: nameById.get(e.candidate_id) ?? "—",
          designationId: e.designation_id,
          designationName: rate?.designationName ?? "—",
          paidDays: 0,
          otDays: 0,
          contractedGross: rate?.grossRate ?? 0,
          contractedBill: rate?.billRate ?? 0,
          invoiceAmount: 0,
          payrollAmount: 0,
          deductionAmount: 0,
          netPayrollAmount: 0,
        };
        bucket.set(e.candidate_id, person);
      }
      const code = codeMap.get(e.code);
      const raw = code?.day_value;
      const dayValue = raw == null || Number.isNaN(Number(raw)) ? 1 : Math.max(0, Number(raw));
      const counted = code ? (code.counts_as_present || code.is_paid ? dayValue : 0) : 0;
      const ot = Number(e.ot_hours) || 0;
      person.paidDays += counted;
      person.otDays += ot;
      const payable = counted + ot;
      if (rate) {
        person.invoiceAmount += (rate.billRate / periodDays) * payable;
        person.payrollAmount += (rate.grossRate / periodDays) * payable;
        person.deductionAmount += (rate.deductionRate / periodDays) * payable;
        person.netPayrollAmount = Math.max(0, person.payrollAmount - person.deductionAmount);
      }
    }

    return out;
  }, [entriesQ.data, financeQ.data, codeMap, nameById, periodsByUnit]);

  const rows = useMemo(() => {
    return pageUnits
      .map((u) => {
        const finance: UnitFinance | undefined = financeQ.data?.get(u.id);
        const period = periodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const people = Array.from(statsByUnit.get(u.id)?.values() ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        const monthlyContracted = finance?.monthlyContracted ?? 0;
        const contractedMtd = (monthlyContracted / period.totalDays) * period.elapsedDays;
        const invoiceAmount = people.reduce((s, p) => s + p.invoiceAmount, 0);
        const payrollAmount = people.reduce((s, p) => s + p.payrollAmount, 0);
        const deductionAmount = people.reduce((s, p) => s + p.deductionAmount, 0);
        const netPayrollAmount = Math.max(0, payrollAmount - deductionAmount);
        const status: PeriodStatus = statusQ.data?.get(u.id) ?? {
          unitId: u.id,
          attendance: "none",
          handedOff: false,
          payroll: "open",
          invoice: "open",
          runId: null,
        };
        return {
          unit: u,
          contractCode: finance?.contractCode ?? u.contract_codes[0] ?? "—",
          committed: finance?.committed ?? 0,
          actual: u.security_guards.length,
          rates: finance?.rates ?? [],
          people,
          monthlyContracted,
          contractedMtd,
          invoiceAmount,
          payrollAmount,
          deductionAmount,
          netPayrollAmount,
          status,
          margin: invoiceAmount - payrollAmount,
          marginPct: invoiceAmount > 0 ? Math.round(((invoiceAmount - payrollAmount) / invoiceAmount) * 100) : 0,
          realisationPct: pct(invoiceAmount, contractedMtd),
          period,
        };
      });
  }, [pageUnits, financeQ.data, statsByUnit, statusQ.data, periodsByUnit, year, monthIdx]);


  const totals = useMemo(() => {
    const monthlyContracted = rows.reduce((s, r) => s + r.monthlyContracted, 0);
    const contractedMtd = rows.reduce((s, r) => s + r.contractedMtd, 0);
    const invoiceAmount = rows.reduce((s, r) => s + r.invoiceAmount, 0);
    const payrollAmount = rows.reduce((s, r) => s + r.payrollAmount, 0);
    const deductionAmount = rows.reduce((s, r) => s + r.deductionAmount, 0);
    return {
      monthlyContracted,
      contractedMtd,
      invoiceAmount,
      payrollAmount,
      deductionAmount,
      netPayrollAmount: Math.max(0, payrollAmount - deductionAmount),
      margin: invoiceAmount - payrollAmount,
      marginPct: invoiceAmount > 0 ? Math.round(((invoiceAmount - payrollAmount) / invoiceAmount) * 100) : 0,
      realisationPct: pct(invoiceAmount, contractedMtd),
    };
  }, [rows]);

  // Register counts for the selected payroll period across the WHOLE charter (not just
  // the visible page): where every unit sits in the open → ready → processed
  // lifecycle.
  const registers = useMemo(() => {
    let open = 0;
    let ready = 0;
    let processed = 0;
    for (const u of searchedUnits) {
      const status = allStatusQ.data?.get(u.id);
      const st = mode === "invoice" ? status?.invoice : status?.payroll;
      if (st === "processed") processed += 1;
      else if (st === "ready" && mode === "invoice") ready += 1;
      else open += 1;
    }
    return { total: searchedUnits.length, open, ready, processed };
  }, [searchedUnits, allStatusQ.data, mode]);


  const exportCsv = () => {
    const rowsForCsv = rows.map((r) => {
      const base = {
        Contract: r.contractCode,
        Organisation: r.unit.customer_name,
        Unit: r.unit.name || r.unit.code,
        Committed: r.committed,
        Deployed: r.actual,
        "Payroll gross (period to date)": Math.round(r.payrollAmount),
      };
      if (mode === "invoice") {
        return {
          ...base,
          "Contracted value (period)": Math.round(r.monthlyContracted),
          "Contracted value (period to date)": Math.round(r.contractedMtd),
          "Invoice value (period to date)": Math.round(r.invoiceAmount),
          "Deductions (period to date)": Math.round(r.deductionAmount),
          "Net payable (period to date)": Math.round(r.netPayrollAmount),
          Margin: Math.round(r.margin),
          "Margin %": r.marginPct,
        };
      }
      return {
        ...base,
        "Deductions (period to date)": Math.round(r.deductionAmount),
        "Net payable (period to date)": Math.round(r.netPayrollAmount),
      };
    });
    downloadCsv(mode === "invoice" ? "invoice-charter" : "payroll-charter", rowsForCsv);
  };

  // Combined manpower MIS: one workbook for every filtered invoice, using the
  // same columns and attendance/rate-card maths as the per-invoice MIS export.
  const [misBusy, setMisBusy] = useState(false);
  const exportMisCombined = async () => {
    const targets = matchedUnits;
    if (targets.length === 0) {
      toast.error("No units in the current filter.");
      return;
    }
    setMisBusy(true);
    try {
      const chunkOf = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const ids = targets.map((u) => u.id);

      const { data: org } = await supabase
        .from("org_settings")
        .select("company_name")
        .limit(1)
        .maybeSingle();
      const entity = String((org as { company_name?: string } | null)?.company_name ?? "Radiant").trim();

      const financeMap = new Map<string, UnitFinance>();
      for (const chunkIds of chunkOf(ids, 100)) {
        const part = await fetchUnitFinance(chunkIds);
        for (const [k, v] of part) financeMap.set(k, v);
      }

      // Attendance entries, grouped by each unit's payroll window.
      const groups = new Map<string, { start: string; end: string; unitIds: string[] }>();
      for (const u of targets) {
        const period = allPeriodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const key = `${period.start}|${period.mtdEnd}`;
        const group = groups.get(key) ?? { start: period.start, end: period.mtdEnd, unitIds: [] };
        group.unitIds.push(u.id);
        groups.set(key, group);
      }
      const entriesPages = await Promise.all(
        Array.from(groups.values()).flatMap((group) =>
          chunkOf(group.unitIds, 100).map((unitIds) =>
            fetchAttendanceEntriesForPeriod({ unitIds, start: group.start, end: group.end, includeUnitId: true }),
          ),
        ),
      );
      const entries = entriesPages.flat();

      // Site fields printed in the client MIS.
      const unitRows: any[] = [];
      for (const chunkIds of chunkOf(ids, 100)) {
        const { data, error: unitsErr } = await supabase
          .from("units")
          .select("id, code, name, customer_id, billing_state, branch_sap_code, zone")
          .in("id", chunkIds);
        if (unitsErr) throw new Error(unitsErr.message);
        unitRows.push(...((data ?? []) as any[]));
      }
      const candidateIds = Array.from(new Set(entries.map((e) => e.candidate_id).filter(Boolean)));
      const candidateRows: any[] = [];
      for (const chunkIds of chunkOf(candidateIds, 100)) {
        const { data, error } = await supabase
          .from("candidates")
          .select("id, employee_code, full_name, preferred_joining_date, designation_id")
          .in("id", chunkIds);
        if (error) throw new Error(error.message);
        candidateRows.push(...((data ?? []) as any[]));
      }
      const candidateById = new Map(candidateRows.map((candidate) => [String(candidate.id), candidate]));

      type MisBucket = { candidateId: string; designationId: string | null; workingDays: number; otDays: number; otHours: number };
      const linesByUnit = new Map<string, Map<string, MisBucket>>();
      for (const e of entries) {
        const unitId = e.unit_id ?? "";
        if (!unitId) continue;
        const finance = financeMap.get(unitId);
        const rate = rateFor(finance, e.designation_id);
        if (!rate) continue;
        const code = codeMap.get(e.code);
        const raw = code?.day_value;
        const dayValue = raw == null || Number.isNaN(Number(raw)) ? 1 : Math.max(0, Number(raw));
        const counted = code ? (code.counts_as_present || code.is_paid ? dayValue : 0) : 0;
        const otDays = Number(e.ot_hours) || 0;
        if (counted + otDays <= 0) continue;
        if (!linesByUnit.has(unitId)) linesByUnit.set(unitId, new Map());
        const bucket = linesByUnit.get(unitId)!;
        const key = `${e.candidate_id}|${e.designation_id ?? ""}`;
        const line = bucket.get(key) ?? {
          candidateId: e.candidate_id,
          designationId: e.designation_id,
          workingDays: 0,
          otDays: 0,
          otHours: 0,
        };
        line.workingDays += counted;
        line.otDays += otDays;
        line.otHours += otDays * (rate.shiftHours || 8);
        bucket.set(key, line);
      }

      const unitById = new Map(unitRows.map((u) => [u.id, u]));
      // One combined workbook uses the MIS format of the organization being
      // exported; a mixed selection falls back to the standard layout.
      const customerIds = Array.from(
        new Set(unitRows.map((u) => String(u.customer_id ?? "")).filter(Boolean)),
      );
      const template = customerIds.length === 1 ? await loadMisTemplateForCustomer(customerIds[0]) : null;
      const unitValues = template ? await loadMisUnitValues(template.id, ids) : undefined;
      const sourceRows: MisSourceRow[] = [];
      let serial = 1;
      for (const u of targets) {
        const lines = linesByUnit.get(u.id);
        if (!lines || lines.size === 0) continue;
        const unitRow = unitById.get(u.id);
        if (!unitRow) continue;
        const period = allPeriodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const periodDays = period.totalDays || 1;
        const [py, pm, pd] = period.end.split("-");
        const invoiceDate = `${pd}-${pm}-${py}`;
        const invoiceNo = `${String(period.end).slice(5, 7)}${String(period.end).slice(2, 4)}-${String(Number(py) + 1).slice(2)}${u.code.toUpperCase()}`;
        const siteNorm = String(unitRow.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const clientNorm = String(u.customer_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const branchName = clientNorm && !siteNorm.includes(clientNorm)
          ? [u.customer_name, unitRow.name].filter(Boolean).join(", ")
          : unitRow.name || unitRow.code;
        for (const line of lines.values()) {
          const finance = financeMap.get(u.id);
          const rate = rateFor(finance, line.designationId);
          if (!rate) continue;
          const candidate = candidateById.get(line.candidateId);
          const perDay = rate.billRate / periodDays;
          const otRate = perDay / 8;
          const otAmount = otRate * line.otHours;
          const regular = perDay * line.workingDays;
          const otBilling = perDay * line.otDays;
          const totalBilling = regular + otBilling + otAmount;
          const cgst = totalBilling * 0.09;
          const sgst = totalBilling * 0.09;
          const igst = cgst + sgst;
          const round = (value: number) => Math.round(value * 100) / 100;
          const doj = String(candidate?.preferred_joining_date ?? "").slice(0, 10);
          const [jy, jm, jd] = doj.split("-");
          sourceRows.push({
            unitId: u.id,
            values: {
              sr_no: serial++, invoice_no: invoiceNo, invoice_date: invoiceDate,
              emp_code: candidate?.employee_code ?? "",
              employee_name: candidate?.full_name ?? nameById.get(line.candidateId) ?? "",
              regular_reliever: candidate?.designation_id === line.designationId ? "Regular" : "Reliever",
              doj: jd && jm && jy ? `${jd}-${jm}-${jy}` : "", entity,
              designation: `${rate.designationName} @ (${rate.shiftHours})`, branch_name: branchName,
              state: unitRow.billing_state ?? "", branch_sap_code: unitRow.branch_sap_code ?? "", zone: unitRow.zone ?? "",
              month_days: periodDays, month_rate: periodDays, billing_rate: rate.billRate,
              billing_rate_per_day: round(perDay), ot_rate: round(otRate), working_days: round(line.workingDays),
              ot_duties: round(line.otDays), ot_amount: round(otAmount),
              working_days_billing_with_ot: round(regular + otBilling), total_regular_billing: round(regular),
              ot_billing: round(otBilling + otAmount), total_billing: round(totalBilling),
              cgst: round(cgst), sgst: round(sgst), igst: round(igst),
              grand_total: round(totalBilling + igst),
            },
          });
        }
      }

      if (sourceRows.length === 0) {
        toast.error("No billable attendance for the filtered units in this period.");
        return;
      }
      const sheet = buildMisSheet({ template, sourceRows, unitValues });
      await writeXlsx({
        filename: `MIS_${year}-${String(monthIdx + 1).padStart(2, "0")}_${targets.length}_units`,
        rows: sheet.rows,
        columns: sheet.columns,
      });
      toast.success(`MIS export ready — ${sourceRows.length} billable employee rows in one file.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MIS export failed");
    } finally {
      setMisBusy(false);
    }
  };

  const loading = entriesQ.isLoading || financeQ.isLoading;
  const linkTo = mode === "invoice" ? "/admin/invoice/$unitId" : "/admin/payroll/$unitId";
  const registerLabel = mode === "invoice" ? "Invoices" : "Payroll runs";

  return (
    <div className="space-y-4">
      <CharterTileGrid>
        <CharterTile
          label="Organizations"
          sub={mode === "invoice" ? "clients billed this period" : "clients with payroll this period"}
          countTo={organizationCount ?? new Set(units.map((u) => u.customer_id || u.customer_name)).size}
          icon={Building2}
          accent="violet"
        />
        <CharterTile
          label="Clients"
          sub="sites in this charter"
          countTo={units.length}
          icon={MapPinned}
          accent="cyan"
        />
        <CharterTile
          label="Active employees"
          sub="deployed across clients"
          countTo={activeEmployees ?? units.reduce((s, u) => s + u.active_employee_count, 0)}
          icon={Users}
          accent="sky"
        />
        <CharterTile
          label={registerLabel}
          sub="all units, by stage"
          countTo={registers.total}
          icon={mode === "invoice" ? Receipt : Wallet}
          accent="lime"
          segments={[
            { label: "Open", value: registers.open, tone: "open" },
            ...(mode === "invoice" ? [{ label: "Ready", value: registers.ready, tone: "ready" as const }] : []),
            { label: "Processed", value: registers.processed, tone: "done" },
          ]}
        />
        {mode === "invoice" && (
          <>
            <CharterTile
              label="Contracted value"
              sub={`${fmtMoneyCompact(totals.contractedMtd)} till date`}
              value={fmtMoneyCompact(totals.monthlyContracted)}
              icon={IndianRupee}
              accent="indigo"
            />
            <CharterTile
              label="Invoice value to date"
              sub={`${totals.realisationPct}% of contracted till date`}
              value={fmtMoneyCompact(totals.invoiceAmount)}
              icon={Receipt}
              accent="emerald"
            />
            <CharterTile
              label="Payroll gross to date"
              sub={`less ${fmtMoneyCompact(totals.deductionAmount)} deductions`}
              value={fmtMoneyCompact(totals.payrollAmount)}
              icon={Wallet}
              accent="amber"
            />
            <CharterTile
              label="Margin"
              sub={`${totals.marginPct}% · current payroll periods`}
              value={fmtMoneyCompact(totals.margin)}
              icon={Gauge}
              accent="rose"
            />
          </>
        )}
        {mode === "payroll" && (
          <CharterTile
            label="Payroll gross to date"
            sub={`less ${fmtMoneyCompact(totals.deductionAmount)} deductions`}
            value={fmtMoneyCompact(totals.payrollAmount)}
            icon={Wallet}
            accent="amber"
          />
        )}
      </CharterTileGrid>

      {filters}





      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:basis-auto sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search…"
            className="h-9 rounded-xl pl-9"
          />
        </div>
        {onStatusFilterChange && (
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusFilterChange(value as "all" | MoneyStatus)}
          >
            <SelectTrigger className="h-9 w-full rounded-xl sm:w-48" aria-label={`${mode === "invoice" ? "Invoice" : "Payroll"} status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mode === "invoice" ? (
                <>
                  <SelectItem value="all">All invoices</SelectItem>
                  <SelectItem value="ready">Invoice ready</SelectItem>
                  <SelectItem value="open">Invoice open</SelectItem>
                  <SelectItem value="processed">Invoice processed</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="all">All payroll</SelectItem>
                  <SelectItem value="open">Payroll open</SelectItem>
                  <SelectItem value="processed">Payroll processed</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}
        <div className="hidden flex-1 sm:block" />
        {mode === "invoice" && (
          <Button
            variant="outline"
            className="h-9 rounded-xl"
            disabled={misBusy}
            onClick={() => void exportMisCombined()}
          >
            <Receipt className="mr-1.5 h-4 w-4" /> {misBusy ? "Preparing…" : "MIS Format (XLSX)"}
          </Button>
        )}
        <Button variant="outline" className="h-9 rounded-xl" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" /> Export
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Loading period-to-date {mode === "invoice" ? "invoice" : "payroll"} values…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No units match this search.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isOpen = !!expanded[r.unit.id];
            return (
              <div
                key={r.unit.id}
                className={cn(
                  "group overflow-hidden rounded-2xl border border-border/70 bg-card transition-all",
                  "hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45)]",
                  isOpen && "border-primary/40",
                )}
              >
                <div className="flex items-stretch">
                  <Link
                    to={linkTo}
                    params={{ unitId: r.unit.id }}
                    search={{ start: r.period.start, end: r.period.end }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:px-4"
                  >
                    {mode === "invoice" && <Dial value={r.realisationPct} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-semibold group-hover:text-primary">
                          {r.unit.name || r.unit.code}
                        </span>
                        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {r.actual}/{r.committed} deployed
                        </span>
                        <AttendanceStatusBadge status={r.status.attendance} />
                        <MoneyStatusBadge kind={mode} status={mode === "invoice" ? r.status.invoice : r.status.payroll} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.unit.customer_name} · {r.contractCode}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-muted-foreground sm:hidden">
                        {mode === "invoice" ? (
                          <>
                            <span className="whitespace-nowrap">Inv {fmtMoneyCompact(r.invoiceAmount)}</span>
                            <span>·</span>
                            <span className="whitespace-nowrap">Pay {fmtMoneyCompact(r.payrollAmount)}</span>
                            <span>·</span>
                            <span className="whitespace-nowrap">{r.marginPct}% margin</span>
                          </>
                        ) : (
                            <span className="whitespace-nowrap">Payroll to date {fmtMoneyCompact(r.payrollAmount)}</span>
                        )}
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-5 pr-1 text-sm tabular-nums sm:flex">
                      {mode === "invoice" && (
                        <>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contracted</div>
                            <div className="whitespace-nowrap font-semibold">{fmtMoneyCompact(r.monthlyContracted)}</div>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Invoice to date</div>
                            <div className="whitespace-nowrap font-semibold">{fmtMoneyCompact(r.invoiceAmount)}</div>
                          </div>
                        </>
                      )}
                      <div className="text-right">
                         <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Payroll to date</div>
                        <div className="whitespace-nowrap font-semibold">{fmtMoneyCompact(r.payrollAmount)}</div>
                      </div>
                      {mode === "invoice" && <MarginChip value={r.marginPct} />}
                    </div>
                  </Link>

                  <button
                    type="button"
                    aria-label={isOpen ? "Hide breakdown" : "Show breakdown"}
                    onClick={() => setExpanded((p) => ({ ...p, [r.unit.id]: !p[r.unit.id] }))}
                    className="flex w-11 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-border/60 bg-muted/25 px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                        {r.status.attendance !== "approved" ? (
                          <>
                            <span className="font-semibold text-destructive">
                              {mode === "invoice" ? "Invoice" : "Payroll"} is open.
                            </span>{" "}
                            Attendance for this period is{" "}
                            {r.status.attendance === "submitted" ? "awaiting approval" : "still being marked"} — values
                            keep moving until it is approved and locked.
                          </>
                        ) : (mode === "invoice" ? r.status.invoice : r.status.payroll) === "processed" ? (
                          <>
                            <span className="font-semibold text-emerald-600">Processed and locked.</span> Attendance is
                            approved and this period has been run. An admin can reopen it if something must change.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-amber-600">Ready to process.</span> Attendance is
                            approved and locked — the {mode === "invoice" ? "invoice" : "payroll"} can be run.
                          </>
                        )}
                      </div>
                      {canProcess && mode === "payroll" && (
                        <div className="flex shrink-0 items-center gap-2">
                          {r.status.payroll === "processed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl"
                              disabled={processMutation.isPending}
                              onClick={() => processMutation.mutate({ unitId: r.unit.id, next: "open" })}
                            >
                              <LockOpen className="mr-1.5 h-3.5 w-3.5" /> Reopen
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 rounded-xl"
                              disabled={processMutation.isPending || r.status.attendance !== "approved"}
                              onClick={() => processMutation.mutate({ unitId: r.unit.id, next: "processed" })}
                            >
                              <Lock className="mr-1.5 h-3.5 w-3.5" /> Mark{" "}
                              payroll processed
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {r.rates.length > 0 && (

                      <div>
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Contracted rate card
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {r.rates.map((rate) => (
                            <div
                              key={`${rate.designationId ?? rate.designationName}`}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2"
                            >
                              <span className="truncate text-xs font-medium">
                                {rate.designationName}
                                <span className="ml-1 text-muted-foreground">×{rate.quantity}</span>
                              </span>
                              <span className="flex items-center gap-2 whitespace-nowrap text-xs tabular-nums">
                                <span className="font-semibold">{fmtMoney(rate.billRate)}</span>
                                <span className="text-muted-foreground">/ {fmtMoney(rate.grossRate)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                         Period-to-date per employee
                      </div>
                      {r.people.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                           No attendance marked for this unit yet this period.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/70">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Employee</th>
                                <th className="px-2 py-2 text-right font-medium">Paid days</th>
                                <th className="px-2 py-2 text-right font-medium">ED days</th>
                                {mode === "payroll" ? (
                                  <>
                                    <th className="px-2 py-2 text-right font-medium">Contracted</th>
                                    <th className="px-2 py-2 text-right font-medium">Gross</th>
                                    <th className="px-2 py-2 text-right font-medium">Deductions</th>
                                    <th className="px-2 py-2 text-right font-medium">Net pay</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="px-2 py-2 text-right font-medium">Contracted</th>
                                    <th className="px-2 py-2 text-right font-medium">Invoice</th>
                                    <th className="px-2 py-2 text-right font-medium">Payroll</th>
                                    <th className="px-2 py-2 text-right font-medium">Margin</th>
                                  </>
                                )}
                                <th className="px-3 py-2 text-right font-medium">
                                  {mode === "payroll" ? "Pay sheet" : "Invoice line"}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.people.map((p) => (
                                <tr key={p.id} className="border-t border-border/50 hover:bg-muted/40">
                                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{p.paidDays}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{p.otDays}</td>
                                  {mode === "payroll" ? (
                                    <>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {fmtMoney(p.contractedGross)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(p.payrollAmount)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {p.deductionAmount > 0 ? `− ${fmtMoney(p.deductionAmount)}` : fmtMoney(0)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">
                                        {fmtMoney(p.netPayrollAmount)}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {fmtMoney(p.contractedBill)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                                        {fmtMoney(p.invoiceAmount)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {fmtMoney(p.payrollAmount)}
                                      </td>
                                      <td className="px-2 py-1.5 text-right">
                                        <MarginChip
                                          value={
                                            p.invoiceAmount > 0
                                              ? Math.round(
                                                  ((p.invoiceAmount - p.payrollAmount) / p.invoiceAmount) * 100,
                                                )
                                              : 0
                                          }
                                        />
                                      </td>
                                    </>
                                  )}
                                  <td className="px-3 py-1.5 text-right">
                                    <Link
                                      to={linkTo}
                                      params={{ unitId: r.unit.id }}
                                      search={{ start: r.period.start, end: r.period.end, candidate: p.id }}
                                      className="text-xs font-medium text-primary hover:underline"
                                    >
                                      View
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <CharterPagination
            page={safePage}
            pageCount={pageCount}
            total={matchedUnits.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
