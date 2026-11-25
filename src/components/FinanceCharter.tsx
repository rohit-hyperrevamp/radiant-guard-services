import { useRegisterPeriods } from "@/lib/use-register-periods";
import { summarizeRegisterStatuses } from "@/lib/register-summary";
import { allocateInvoiceEntries } from "@/lib/invoice-present-cap";
import { computeDashboardUnitFinance, type DashboardUnitFinance } from "@/lib/dashboard-finance";
import { computePayrollUnitsTotals, type PayrollUnitTotals } from "@/lib/payroll-engine";
import { readRegisterSavedTotals, requestFinanceRecompute } from "@/lib/finance-summary-compute";
import { financeSummaryAmount, registerMoney } from "@/lib/finance-totals";
import { getFinanceSharedContext, type FinanceSharedContext } from "@/lib/finance-shared-context";
import { createPool } from "@/lib/supabase-batch";
import { getReference } from "@/lib/reference-data";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, ChevronDown, Download, FileCheck2, Gauge, IndianRupee, MapPinned, Receipt, Search, Users, Wallet } from "lucide-react";
import { CharterTile, CharterTileGrid } from "@/components/CharterTiles";
import { CharterPagination } from "@/components/CharterPagination";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv, writeXlsx } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { fetchPeriodContractCodes, fetchUnitFinance, rateFor, fmtMoney, fmtMoneyCompact, type UnitFinance } from "@/lib/contract-finance";
import {
  fetchPeriodStatusesForUnitPeriods,
  PERIOD_STATUS_QK,
  useAttendanceMoneyRealtime,
  type MoneyStatus,
  type RealtimeTarget,
  type PeriodStatus,
} from "@/lib/period-status";
import { MoneyStatusBadge } from "@/components/PeriodStatusBadge";
import { useCurrentPermissions } from "@/lib/rbac";
import type { CharterUnitRow } from "@/lib/charter-units";
import { payrollPeriodForMonth, type PayrollWindow } from "@/lib/payroll-period";
import { buildMisSheet, loadMisDisabledCustomerIds, loadSharedMisTemplate, type MisSourceRow } from "@/lib/mis-template";
import { billingRatePerDay, misBillingLine, periodDateList, resolveBillingDivisor } from "@/lib/mis-billing";
import { splitInvoiceDuties } from "@/lib/invoice-duty-rates";
import { buildTallyVoucherRows, writeTallyBillingXlsx } from "@/lib/tally-billing";
import { loadGstBillingBranches, normalizeState, resolveGstBillingBranch } from "@/lib/gst-billing";
import { invoiceCompanyState, isIntraStateSupply } from "@/lib/gst-tax";
import { roundDutyDays } from "@/lib/duty-days";
import { useFinalInvoicesForUnits, unitPeriodKey } from "@/lib/final-invoice";
import { FinalInvoiceDialog, type FinalInvoiceTarget } from "@/components/FinalInvoiceDialog";
import { EXCLUDE, isSplit, loadOrgInvoiceSplit, type InvoiceItemKey, type InvoiceSplit } from "@/lib/invoice-split";
import { Checkbox } from "@/components/ui/checkbox";
import { loadPeriodGstOptions } from "@/lib/contract-gst";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import { invoiceQueryFreshness } from "@/lib/invoice-query-freshness";


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
  /** Actual employer costs, excluding all commercial billing add-ons. */
  employerCost: number;
  /** Net payable = gross − deductions. */
  netPayrollAmount: number;
};


/** A money total over the sites that have one; "—" when none do (unavailable is not ₹0). */
function fmtSummary(value: number, readyCount: number) {
  const amount = financeSummaryAmount(value, readyCount);
  return amount === null ? "—" : fmtMoneyCompact(amount);
}

function pct(actual: number, projected: number) {
  if (projected <= 0) return 0;
  return Math.round((actual / projected) * 100);
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

/** Stale sites per live-compute batch (= one invoice_period_entries batch). */
const LIVE_BATCH_SIZE = 120;
/** Live-compute batches in flight at once, across every register on the page. */
const liveComputePool = createPool(3);

type LiveResult = { engine: Map<string, DashboardUnitFinance>; pay: Map<string, PayrollUnitTotals> };
type RegisterPeriod = ReturnType<typeof payrollPeriodForMonth>;

type GetContext = () => Promise<FinanceSharedContext | null>;

/**
 * The invoice page's and payroll page's own calculations for these site periods.
 * `context` = the register's shared period-wide reads (loaded once, not per batch).
 */
async function computeRegisterLive(periods: Map<string, { start: string; end: string }>, context?: FinanceSharedContext | null): Promise<LiveResult> {
  const [engine, pay] = await Promise.all([computeDashboardUnitFinance(periods, undefined, context), computePayrollUnitsTotals(periods, undefined, context)]);
  return { engine, pay };
}

type SavedTotals = Awaited<ReturnType<typeof readRegisterSavedTotals>>;
type PolledTotals = { ready: SavedTotals["ready"]; failed: string[] };
const NO_POLLED_TOTALS: PolledTotals = { ready: new Map(), failed: [] };

type EntryTotal = { unit_id: string; candidate_id: string; designation_id: string | null; shift_hours: number | null; code: string; days: number; ot_hours: number; entry_date: string };

/** Grouped attendance totals per employee/code for these sites over one window. */
async function fetchEntryTotals(unitIds: string[], start: string, end: string): Promise<EntryTotal[]> {
  const { data, error } = await (supabase.rpc as any)("finance_charter_entry_totals", { _unit_ids: unitIds, _start: start, _end: end });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    unit_id: r.unit_id as string,
    candidate_id: r.candidate_id as string,
    designation_id: (r.designation_id ?? null) as string | null,
    shift_hours: r.shift_hours == null ? null : Number(r.shift_hours),
    code: r.code as string,
    days: Number(r.days) || 0,
    ot_hours: Number(r.ot_hours) || 0,
    entry_date: start,
  }));
}

/** Per-employee period-to-date figures of one site (the register breakdown). */
function buildPeople(
  source: EntryTotal[],
  finance: UnitFinance | undefined,
  codeMap: Map<string, CodeRow>,
  nameById: Map<string, string>,
  p: RegisterPeriod,
): PersonMoney[] {
  const bucket = new Map<string, PersonMoney>();
  const dates = periodDateList(p.start, p.end);
  const allocated = allocateInvoiceEntries(source, e => rateFor(finance, e.designation_id, e.candidate_id, e.shift_hours), () => dates, e => { const code = codeMap.get(e.code); return code?.counts_as_present ? (Number(code.day_value ?? 1) || 0) * (e.days ?? 1) : 0; });
  for (const [index, e] of source.entries()) {
    const rate = rateFor(finance, e.designation_id, e.candidate_id, e.shift_hours);
    // Same maths as the MIS sheet: per-day rate = monthly bill ÷ the contract's
    // billing-days rule (e.g. fixed 26, days minus four), not calendar days.
    const divisor = rate ? Math.max(1, resolveBillingDivisor(rate, dates) || p.totalDays || 1) : 1;
    const billPerDay = rate ? billingRatePerDay(rate.billRate, rate, dates) : 0;
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
        employerCost: 0,
        netPayrollAmount: 0,
      };
      bucket.set(e.candidate_id, person);
    }
    const code = codeMap.get(e.code);
    const raw = code?.day_value;
    const dayValue = raw == null || Number.isNaN(Number(raw)) ? 1 : Math.max(0, Number(raw));
    const n = e.days ?? 1;
    const counted = (code ? (code.counts_as_present || code.is_paid ? dayValue : 0) : 0) * n;
    const ot = Number(e.ot_hours) || 0;
    person.paidDays += counted;
    person.otDays += ot;
    const payable = counted + ot;
    // Billing counts only what the MIS/invoice bills: present days (P, HD)
    // and paid holidays (PH) plus Extra Duty. Paid weekly offs and paid
    // leave are part of the wage but are never billed as duties.
    const billed = (!code ? 0 : code.counts_as_present || code.code.startsWith("PH") ? dayValue : 0) * n + ot;
    if (rate) {
      const edRate = rate.extraDutyFromMonthlyBilling ? rate.billRate / divisor * 2 : rate.extraDutyBillRate ?? billPerDay;
      person.invoiceAmount += billPerDay * (billed - ot - allocated[index].moved) + edRate * allocated[index].extraDuty;
      person.payrollAmount += (rate.grossRate / divisor) * payable;
      person.deductionAmount += (rate.deductionRate / divisor) * payable;
      person.netPayrollAmount = Math.max(0, person.payrollAmount - person.deductionAmount);
    }
  }
  return Array.from(bucket.values());
}

/** Breakdown of one expanded site: attendance, full rate card and the engines' per-person money. */
async function loadBreakdown(
  unitId: string,
  period: RegisterPeriod,
  live: LiveResult | undefined,
  unitCodes: Map<string, string | null>,
  nameById: Map<string, string>,
  getContext: GetContext,
): Promise<PersonMoney[]> {
  const [financeMap, entries, codes, liveRes] = await Promise.all([
    fetchUnitFinance([unitId], new Map([[unitId, period]]), { unitCodes }),
    fetchEntryTotals([unitId], period.start, period.end),
    getReference<CodeRow>("attendanceCodes"),
    live ?? getContext().then((context) => computeRegisterLive(new Map([[unitId, { start: period.start, end: period.end }]]), context)),
  ]);
  const people = buildPeople(entries.filter((e) => e.unit_id === unitId), financeMap.get(unitId), new Map(codes.map((c) => [c.code, c])), nameById, period)
    .sort((a, b) => a.name.localeCompare(b.name));
  // Invoice values from the invoice engine, payroll from the payroll engine — the detail pages' own maths.
  const engine = liveRes.engine.get(unitId);
  if (engine) for (const p of people) p.invoiceAmount = engine.invoice_by_person.get(p.id) ?? 0;
  const pay = liveRes.pay.get(unitId);
  if (pay) for (const p of people) {
    const x = pay.byPerson.get(p.id);
    p.payrollAmount = x?.gross ?? 0;
    p.deductionAmount = x?.deductions ?? 0;
    p.employerCost = x?.employerCost ?? 0;
    p.netPayrollAmount = Math.max(0, p.payrollAmount - p.deductionAmount);
  }
  return people;
}

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
  filterResetKey = 0,
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
  filterResetKey?: number;
}) {

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Invoice finalisation: nothing carries a number until the user picks sites and
  // presses "Generate final invoice".
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [finalOpen, setFinalOpen] = useState(false);
  // Invoices are raised one state at a time, so the charter can be narrowed by
  // billing state and city exactly like Contracts.
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState<string[]>([]);

  useEffect(() => {
    setStateFilter([]);
    setCityFilter([]);
  }, [filterResetKey]);

  const stateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of units) {
      const label = (u.client_state || u.billing_state || "").trim();
      if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
  }, [units]);

  const cityOptions = useMemo(() => {
    const selectedStates = new Set(stateFilter.map((s) => s.toLowerCase()));
    const seen = new Map<string, string>();
    for (const u of units) {
      const state = (u.client_state || u.billing_state || "").trim();
      if (selectedStates.size && !selectedStates.has(state.toLowerCase())) continue;
      const label = (u.client_city || u.billing_city || "").trim();
      if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
  }, [units, stateFilter]);

  useEffect(() => {
    const validStates = new Set(stateOptions.map((option) => option.value.toLowerCase()));
    setStateFilter((current) => {
      const next = current.filter((value) => validStates.has(value.toLowerCase()));
      return next.length === current.length ? current : next;
    });
  }, [stateOptions]);

  useEffect(() => {
    const validCities = new Set(cityOptions.map((option) => option.value.toLowerCase()));
    setCityFilter((current) => {
      const next = current.filter((value) => validCities.has(value.toLowerCase()));
      return next.length === current.length ? current : next;
    });
  }, [cityOptions]);


  // Search, then paginate, then load money for the visible page only. Contract
  // rates, attendance entries and period statuses are all fetched for these 25
  // units — never for the whole charter.
  const searchedUnits = useMemo(() => {
    const term = query.trim().toLowerCase();
    const stateSet = new Set(stateFilter.map((s) => s.toLowerCase()));
    const citySet = new Set(cityFilter.map((s) => s.toLowerCase()));
    const list = units.filter((u) => {
      if (stateSet.size && !stateSet.has((u.client_state || u.billing_state || "").trim().toLowerCase())) return false;
      if (citySet.size && !citySet.has((u.client_city || u.billing_city || "").trim().toLowerCase())) return false;
      if (!term) return true;
      return [u.name, u.code, u.customer_name, ...u.contract_codes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
    return list.sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code));
  }, [units, query, stateFilter, cityFilter]);

  const [page, setPage] = useState(0);
  // The stage tile reflects the whole charter, not just the visible page, so
  // windows and period statuses are also fetched (ids + status only — cheap)
  // for every searched unit. This also lets status filtering happen before pagination.
  const allUnitIds = useMemo(() => searchedUnits.map((u) => u.id), [searchedUnits]);
  const { can, canAction, isSuperAdmin } = useCurrentPermissions();
  const canFinalise = mode === "invoice" && (isSuperAdmin || canAction("invoice", "finalise", "edit"));
  // Every register period ends inside the viewed month: read only those finals.
  const viewedMonth = payrollPeriodForMonth(year, monthIdx);
  const finalsQ = useFinalInvoicesForUnits(mode === "invoice" ? allUnitIds : [], { periodEndFrom: viewedMonth.start, periodEndTo: viewedMonth.end });

  const queryClient = useQueryClient();
  // Attendance edits (including overtime) push straight through to these
  // numbers — no refresh, no stale cache. Saved totals refresh through the
  // hook; a changed site that is being live-computed is recomputed on its own.
  const realtimeRef = useRef<(targets: RealtimeTarget[]) => void>(() => {});
  useAttendanceMoneyRealtime((targets) => realtimeRef.current(targets));

  const registerPeriods = useRegisterPeriods(allUnitIds, year, monthIdx, windowsByUnit);
  const allPeriodsByUnit = registerPeriods.periods;
  const allStatusQ = registerPeriods.statusesQ;
  // Nothing money-related starts until each site's saved sheet dates are known —
  // otherwise every loader ran twice (expected window, then the saved one).
  const periodsReady = registerPeriods.periodsReady;

  const matchedUnits = useMemo(() => {
    if (statusFilter === "all") return searchedUnits;
    return searchedUnits.filter((unit) => {
      const status = mode === "invoice"
        ? allStatusQ.data?.get(unit.id)?.invoice ?? "open"
        : allStatusQ.data?.get(unit.id)?.payroll ?? "open";
      return status === statusFilter;
    });
  }, [allStatusQ.data, mode, searchedUnits, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(matchedUnits.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => setPage(0), [query, statusFilter, stateFilter, cityFilter, units.length, monthIdx, year]);
  const pageUnits = useMemo(
    () => matchedUnits.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [matchedUnits, safePage],
  );
  // Money tiles must cover every filtered site, not just the visible page.
  const unitIds = useMemo(() => matchedUnits.map((u) => u.id), [matchedUnits]);

  const periodsByUnit = useMemo(() => {
    const out = new Map<string, ReturnType<typeof payrollPeriodForMonth>>();
    for (const unitId of unitIds) {
      const period = allPeriodsByUnit.get(unitId);
      if (period) out.set(unitId, period);
    }
    return out;
  }, [unitIds, allPeriodsByUnit]);
  const periodKey = useMemo(
    () => Array.from(periodsByUnit, ([unitId, p]) => `${unitId}:${p.start}:${p.end}`).join("|"),
    [periodsByUnit],
  );
  const plainPeriods = useMemo(
    () => new Map(Array.from(periodsByUnit, ([id, p]) => [id, { start: p.start, end: p.end }])),
    [periodsByUnit],
  );
  const unitCodes = useMemo(() => new Map(units.map((u) => [u.id, u.code || null])), [units]);
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of units) for (const g of u.security_guards) m.set(g.id, g.name);
    return m;
  }, [units]);

  // With a status filter the site list depends on statuses: wait, or every loader runs twice.
  const moneyEnabled = periodsReady && unitIds.length > 0 && (statusFilter === "all" || allStatusQ.isSuccess);

  // Contract code, committed strength and rate cards (site level — posting duty
  // lengths only matter for a per-employee breakdown, loaded when one opens).
  const financeQ = useQuery({
    queryKey: ["finance-charter-contracts", periodKey],
    enabled: mode === "invoice" && moneyEnabled,
    queryFn: () => fetchUnitFinance(unitIds, periodsByUnit, { postingShifts: false, unitCodes }),
  });
  // The Payroll register rows show only the period contract code and status.
  const contractCodesQ = useQuery({
    queryKey: ["finance-charter-contract-codes", periodKey],
    // Both registers: the cheap code lookup lets the Invoice table paint before
    // the (much heavier) rate cards arrive.
    enabled: moneyEnabled,
    queryFn: () => fetchPeriodContractCodes(unitIds, periodsByUnit),
  });

  // 1) Saved server totals first: current ones render immediately.
  const canSaved = can("invoice") && can("payroll");
  const savedTotalsQ = useQuery({
    queryKey: ["finance-charter-saved-totals-v5", periodKey],
    enabled: mode === "invoice" && canSaved && moneyEnabled,
    staleTime: 15_000,
    queryFn: () => readRegisterSavedTotals(plainPeriods),
  });
  // Pick up server recomputes: poll ONLY the sites still stale that a recompute
  // can turn current — never every site, never a failed one (last_error) or one
  // without a period contract (the server cannot total it).
  const pollIds = useMemo(() => {
    const data = savedTotalsQ.data;
    if (!data) return [];
    const failed = new Set(data.failed);
    return data.stale.filter((id) => !failed.has(id) && !(financeQ.isSuccess && !financeQ.data.has(id)));
  }, [savedTotalsQ.data, financeQ.isSuccess, financeQ.data]);
  const pollKey = useMemo(() => ["finance-charter-saved-totals-v5-poll", periodKey, pollIds.join(",")] as const, [periodKey, pollIds]);
  const pollPending = (data: PolledTotals | undefined) => pollIds.filter((id) => !data?.ready.has(id) && !data?.failed.includes(id));
  const pollQ = useQuery({
    queryKey: pollKey,
    enabled: mode === "invoice" && canSaved && moneyEnabled && pollIds.length > 0,
    // The first poll runs 30 s after the full read, not on top of it.
    initialData: NO_POLLED_TOTALS,
    initialDataUpdatedAt: () => Date.now(),
    staleTime: 30_000,
    refetchInterval: (q) => (pollPending(q.state.data).length ? 30_000 : false),
    queryFn: async (): Promise<PolledTotals> => {
      const prev = queryClient.getQueryData<PolledTotals>(pollKey);
      const todo = pollPending(prev);
      const fresh = await readRegisterSavedTotals(new Map(todo.flatMap((id) => { const p = plainPeriods.get(id); return p ? [[id, p] as const] : []; })));
      return { ready: new Map([...(prev?.ready ?? []), ...fresh.ready]), failed: [...(prev?.failed ?? []), ...fresh.failed] };
    },
  });
  // Saved totals = the full read, overlaid with sites a newer poll found current.
  const savedTotals = useMemo((): SavedTotals | undefined => {
    const main = savedTotalsQ.data;
    const polled = pollQ.data;
    if (!main || !polled?.ready.size || pollQ.dataUpdatedAt <= savedTotalsQ.dataUpdatedAt) return main;
    const ready = new Map(main.ready);
    for (const [id, row] of polled.ready) ready.set(id, row);
    return { ready, stale: main.stale.filter((id) => !polled.ready.has(id)), failed: main.failed };
  }, [savedTotalsQ.data, savedTotalsQ.dataUpdatedAt, pollQ.data, pollQ.dataUpdatedAt]);
  const savedSettled = !canSaved || savedTotalsQ.isSuccess || savedTotalsQ.isError;
  const staleIds = useMemo(() => {
    if (mode !== "invoice" || !moneyEnabled || !savedSettled) return [];
    if (!canSaved || !savedTotals) return unitIds;
    return savedTotals.stale;
  }, [mode, moneyEnabled, savedSettled, canSaved, savedTotals, unitIds]);
  useEffect(() => {
    const stale = savedTotalsQ.data?.stale ?? [];
    if (stale.length) void requestFinanceRecompute(plainPeriods, stale);
  }, [savedTotalsQ.data, plainPeriods]);

  // 2) Live engine compute ONLY for stale / missing sites, after first paint,
  // in batches with at most LIVE_CONCURRENCY in flight. Never blocks the table.
  const firstPaintDone = financeQ.isSuccess || financeQ.isError;
  // Sites only ever join the live set (appended), so when a saved-totals refresh
  // turns a site current the earlier batches keep their keys and are not recomputed;
  // saved values win for that site anyway.
  const liveTargetsRef = useRef<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const liveTargets = useMemo(() => {
    const prev = liveTargetsRef.current.key === periodKey ? liveTargetsRef.current.ids : [];
    const have = new Set(prev);
    const added = staleIds.filter((id) => !have.has(id));
    const ids = added.length ? [...prev, ...added] : prev;
    liveTargetsRef.current = { key: periodKey, ids };
    return ids;
  }, [periodKey, staleIds]);
  const liveBatches = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < liveTargets.length; i += LIVE_BATCH_SIZE) out.push(liveTargets.slice(i, i + LIVE_BATCH_SIZE));
    return out;
  }, [liveTargets]);
  // One shared context (masters, holidays, ESI flag, revisions, additions,
  // deductions) for every batch and breakdown of this register — cached 60 s.
  const getContext: GetContext = () => getFinanceSharedContext(queryClient, plainPeriods).catch(() => null);
  const liveQs = useQueries({
    queries: liveBatches.map((ids) => {
      const periods = new Map(ids.flatMap((id) => { const p = plainPeriods.get(id); return p ? [[id, p] as const] : []; }));
      return {
        queryKey: ["finance-charter-live", Array.from(periods, ([id, p]) => `${id}:${p.start}:${p.end}`).join("|")],
        enabled: firstPaintDone,
        staleTime: 60_000,
        queryFn: () => liveComputePool.run(async () => computeRegisterLive(periods, await getContext())),
      };
    }),
  });
  // A status change at a live-computed site recomputes just that site.
  const [liveSiteRevs, setLiveSiteRevs] = useState<Record<string, number>>({});
  useEffect(() => setLiveSiteRevs((prev) => (Object.keys(prev).length ? {} : prev)), [periodKey]);
  realtimeRef.current = (targets) => {
    if (mode !== "invoice") return;
    if (targets.some((t) => t === "all")) {
      void queryClient.invalidateQueries({ queryKey: ["finance-charter-live"] });
      return;
    }
    const live = new Set(liveTargetsRef.current.ids);
    const hit = targets.flatMap((t) => (t !== "all" && live.has(t.unitId) && (!t.month || plainPeriods.get(t.unitId)?.end.slice(0, 7) === t.month) ? [t.unitId] : []));
    if (hit.length) setLiveSiteRevs((prev) => {
      const next = { ...prev };
      for (const id of hit) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
  };
  const liveSiteEntries = useMemo(() => Object.entries(liveSiteRevs).filter(([id]) => plainPeriods.has(id)), [liveSiteRevs, plainPeriods]);
  const liveSiteQs = useQueries({
    queries: liveSiteEntries.map(([id, rev]) => {
      const p = plainPeriods.get(id)!;
      return {
        queryKey: ["finance-charter-live-site", id, p.start, p.end, rev],
        enabled: firstPaintDone,
        staleTime: 60_000,
        queryFn: () => liveComputePool.run(async () => computeRegisterLive(new Map([[id, p]]), await getContext())),
      };
    }),
  });
  const liveByUnit = useMemo(() => {
    const out = new Map<string, LiveResult>();
    liveBatches.forEach((ids, i) => {
      const data = liveQs[i]?.data;
      if (data) for (const id of ids) out.set(id, data);
    });
    liveSiteEntries.forEach(([id], i) => {
      const data = liveSiteQs[i]?.data;
      if (data) out.set(id, data);
    });
    return out;
  }, [liveBatches, liveQs, liveSiteEntries, liveSiteQs]);
  // Only sites still without a saved current total count as failed / updating.
  const liveFailedIds = useMemo(() => {
    const stale = new Set(staleIds);
    return liveBatches.flatMap((ids, i) => (liveQs[i]?.isError && !liveQs[i]?.data ? ids.filter((id) => stale.has(id)) : []));
  }, [staleIds, liveBatches, liveQs]);
  const updatingCount = useMemo(() => {
    const failed = new Set(liveFailedIds);
    return staleIds.filter((id) => !liveByUnit.has(id) && !failed.has(id)).length;
  }, [staleIds, liveByUnit, liveFailedIds]);
  const savedLoading = mode === "invoice" && moneyEnabled && !savedSettled;

  const allRows = useMemo(() => {
    if (!periodsReady) return [];
    return matchedUnits
      .map((u) => {
        const finance: UnitFinance | undefined = financeQ.data?.get(u.id);
        const period = periodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const monthlyContracted = finance?.monthlyContracted ?? 0;
        const contractedMtd = (monthlyContracted / period.totalDays) * period.elapsedDays;
        const money = mode === "invoice" ? registerMoney(u.id, savedTotals?.ready.get(u.id), liveByUnit.get(u.id)) : null;
        const invoiceAmount = money?.invoiceAmount ?? 0;
        const payrollAmount = money?.payrollAmount ?? 0;
        const deductionAmount = money?.deductionAmount ?? 0;
        const netPayrollAmount = money?.netPayrollAmount ?? 0;
        const employerCost = money?.employerCost ?? 0;
        const margin = invoiceAmount - payrollAmount - employerCost;
        const status: PeriodStatus = allStatusQ.data?.get(u.id) ?? {
          unitId: u.id,
          attendance: "none",
          handedOff: false,
          payroll: "open",
          invoice: "open",
          runId: null,
        };
        return {
          unit: u,
          finalInvoice: finalsQ.data?.get(unitPeriodKey(u.id, period.start, period.end)) ?? null,
          contractCode: (mode === "invoice" ? finance?.contractCode ?? contractCodesQ.data?.get(u.id) : contractCodesQ.data?.get(u.id)) ?? u.contract_codes[0] ?? "—",
          // null until the rate cards load (Invoice), so the row never shows "/0".
          committed: mode === "invoice" && !finance ? null : finance?.committed ?? 0,
          actual: u.security_guards.length,
          rates: finance?.rates ?? [],
          monthlyContracted,
          contractedMtd,
          /** False while this site's live totals are still computing (or failed). */
          moneyReady: money !== null,
          /** Live compute finished without a total for this site: unavailable, never ₹0. */
          moneyUnavailable: mode === "invoice" && money === null && liveByUnit.has(u.id),
          invoiceAmount,
          payrollAmount,
          deductionAmount,
          netPayrollAmount,
          status,
          employerCost,
          margin,
          marginPct: invoiceAmount > 0 ? Math.round((margin / invoiceAmount) * 100) : 0,
          realisationPct: pct(invoiceAmount, contractedMtd),
          period,
        };
      });
  }, [periodsReady, matchedUnits, financeQ.data, contractCodesQ.data, allStatusQ.data, periodsByUnit, year, monthIdx, finalsQ.data, savedTotals, liveByUnit, mode]);
  const unavailableCount = useMemo(() => allRows.filter((r) => r.moneyUnavailable).length, [allRows]);

  // Per-employee breakdown: loaded only for the sites someone expands.
  const expandedIds = useMemo(
    () => (mode === "invoice" ? pageUnits.filter((u) => expanded[u.id] && periodsByUnit.has(u.id)).map((u) => u.id) : []),
    [mode, pageUnits, expanded, periodsByUnit],
  );
  const breakdownQs = useQueries({
    queries: expandedIds.map((id) => {
      const period = periodsByUnit.get(id)!;
      const live = liveByUnit.get(id);
      return {
        queryKey: ["finance-charter-breakdown", id, period.start, period.end, live ? "live" : "own"],
        enabled: moneyEnabled,
        staleTime: 60_000,
        queryFn: () => loadBreakdown(id, period, live, unitCodes, nameById, getContext),
      };
    }),
  });
  const peopleByUnit = useMemo(() => {
    const out = new Map<string, PersonMoney[]>();
    expandedIds.forEach((id, i) => {
      const data = breakdownQs[i]?.data;
      if (data) out.set(id, data);
    });
    return out;
  }, [expandedIds, breakdownQs]);
  const breakdownLoading = useMemo(
    () => new Set(expandedIds.filter((_, i) => breakdownQs[i]?.isPending)),
    [expandedIds, breakdownQs],
  );
  const breakdownFailed = useMemo(
    () => new Set(expandedIds.filter((_, i) => breakdownQs[i]?.isError && !breakdownQs[i]?.data)),
    [expandedIds, breakdownQs],
  );

  const pageIdSet = useMemo(() => new Set(pageUnits.map((u) => u.id)), [pageUnits]);
  const rows = useMemo(() => allRows.filter((r) => pageIdSet.has(r.unit.id)), [allRows, pageIdSet]);

  // Sites picked for finalisation — only those with approved attendance and no
  // number issued yet for the open period.
  // Selection spans every page: picks on page 1 stay selected on page 2.
  const selectableRows = useMemo(
    // Finalising needs the exact invoice value: a site is pickable once its saved
    // or live total is in, never while it is still updating.
    () => allRows.filter((r) => (mode !== "invoice" || r.moneyReady) && !r.finalInvoice && r.status.attendance === "approved"),
    [allRows, mode],
  );
  // Invoice numbers are state-driven, so one final invoice can never span two
  // states: the first pick locks the state for the rest of the selection.
  const lockedState = useMemo(() => {
    const first = selectableRows.find((r) => selected[r.unit.id]);
    return first ? normalizeState(first.unit.client_state || first.unit.billing_state || "") : null;
  }, [selectableRows, selected]);
  const lockedStateLabel = useMemo(() => {
    const first = selectableRows.find((r) => selected[r.unit.id]);
    return first?.unit.client_state || first?.unit.billing_state || null;
  }, [selectableRows, selected]);
  const selectedTargets = useMemo<FinalInvoiceTarget[]>(
    () =>
      selectableRows
        .filter((r) => selected[r.unit.id] && (!lockedState || normalizeState(r.unit.client_state || r.unit.billing_state || "") === lockedState))
        .map((r) => ({
          unitId: r.unit.id,
          unitLabel: r.unit.name || r.unit.code,
          customerId: r.unit.customer_id || null,
          customerName: r.unit.customer_name,
          billingState: r.unit.billing_state ?? null,
          periodStart: r.period.start,
          periodEnd: r.period.end,
          taxableValue: r.invoiceAmount,
        })),
    [selectableRows, selected, lockedState],
  );



  const totals = useMemo(() => {
    const monthlyContracted = allRows.reduce((s, r) => s + r.monthlyContracted, 0);
    const contractedMtd = allRows.reduce((s, r) => s + r.contractedMtd, 0);
    const invoiceAmount = allRows.reduce((s, r) => s + r.invoiceAmount, 0);
    const payrollAmount = allRows.reduce((s, r) => s + r.payrollAmount, 0);
    const deductionAmount = allRows.reduce((s, r) => s + r.deductionAmount, 0);
    const margin = allRows.reduce((s, r) => s + r.margin, 0);
    return {
      /** Sites with a saved or live total; the rest are not in the money totals. */
      readyCount: allRows.filter((r) => r.moneyReady).length,
      monthlyContracted,
      contractedMtd,
      invoiceAmount,
      payrollAmount,
      deductionAmount,
      netPayrollAmount: Math.max(0, payrollAmount - deductionAmount),
      margin,
      marginPct: invoiceAmount > 0 ? Math.round((margin / invoiceAmount) * 100) : 0,
      realisationPct: pct(invoiceAmount, contractedMtd),
    };
  }, [allRows]);

  // Register counts for the selected payroll period across the WHOLE charter (not just
  // the visible page): where every unit sits in the open → ready → processed
  // lifecycle.
  const registers = useMemo(() => ({
    total: searchedUnits.length,
    ...summarizeRegisterStatuses(allUnitIds, allStatusQ.data ?? new Map())[mode],
  }), [searchedUnits.length, allUnitIds, allStatusQ.data, mode]);

  const exportCsv = () => {
    if (mode === "invoice" && !financeQ.isSuccess) {
      toast.info("Contract values are still loading — try the export again in a moment.");
      return;
    }
    const rowsForCsv = allRows.map((r) => {
      // A site without a total exports blank money, never 0.
      const amount = (n: number) => (mode !== "invoice" || r.moneyReady ? Math.round(n) : "");
      if (mode === "payroll") {
        return {
          Name: r.unit.name || r.unit.code,
          "Contract ID": r.contractCode,
          Status: `Payroll ${r.status.payroll.charAt(0).toUpperCase()}${r.status.payroll.slice(1)}`,
        };
      }
      const base = {
        Contract: r.contractCode,
        Organisation: r.unit.customer_name,
        Unit: r.unit.name || r.unit.code,
        Committed: r.committed,
        Deployed: r.actual,
        "Payroll gross (period to date)": amount(r.payrollAmount),
      };
      if (mode === "invoice") {
        return {
          ...base,
          "Contracted value (period)": Math.round(r.monthlyContracted),
          "Contracted value (period to date)": Math.round(r.contractedMtd),
          "Invoice value (period to date)": amount(r.invoiceAmount),
          "Deductions (period to date)": amount(r.deductionAmount),
          "Net payable (period to date)": amount(r.netPayrollAmount),
          Margin: amount(r.margin),
          "Margin %": r.moneyReady ? r.marginPct : "",
        };
      }
      return base;
    });
    downloadCsv(mode === "invoice" ? "invoice-charter" : "payroll-charter", rowsForCsv);
  };

  // Invoice engine results (same calculation as the invoice page) for these sites:
  // reuses the background live results, computes the rest on demand (cached 60 s).
  const engineData = async (ids: string[]) => {
    const out = new Map<string, DashboardUnitFinance>();
    const missing = new Map<string, { start: string; end: string }>();
    for (const id of ids) {
      const live = liveByUnit.get(id);
      if (live) {
        const e = live.engine.get(id);
        if (e) out.set(id, e);
        continue;
      }
      const p = allPeriodsByUnit.get(id) ?? payrollPeriodForMonth(year, monthIdx);
      missing.set(id, { start: p.start, end: p.end });
    }
    if (missing.size) {
      const computed = await queryClient.fetchQuery({
        queryKey: ["finance-charter-invoice-engine", Array.from(missing, ([id, p]) => `${id}:${p.start}:${p.end}`).join("|")],
        staleTime: 60_000,
        queryFn: async () => computeDashboardUnitFinance(missing, undefined, await getContext()),
      });
      for (const [id, e] of computed) out.set(id, e);
    }
    return out;
  };

  // Final invoices: a site of a split organization becomes one target per
  // invoice part, valued exactly as the invoice page values that part.
  const [preparingFinal, setPreparingFinal] = useState(false);
  const [finalTargets, setFinalTargets] = useState<FinalInvoiceTarget[]>([]);
  const openFinal = async () => {
    setPreparingFinal(true);
    try {
      const engine = await engineData(selectedTargets.map((t) => t.unitId));
      const out: FinalInvoiceTarget[] = [];
      for (const t of selectedTargets) {
        const parts = engine.get(t.unitId)?.parts ?? [];
        // Split contracts: one final invoice per part, each at that part's own invoice-page value.
        if (parts.length <= 1) { out.push(t); continue; }
        for (const p of parts) {
          if (p.taxable <= 0) continue;
          out.push({ ...t, partKey: p.key, partLabel: p.label, taxableValue: p.taxable });
        }
      }
      if (!out.length) return toast.error("Nothing billable for the selected sites.");
      setFinalTargets(out);
      setFinalOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare the final invoice");
    } finally {
      setPreparingFinal(false);
    }
  };

  // One Tally workbook for every invoice in the current filters, not only the
  // visible page. The rows use the same strict layout as the invoice detail export.
  const [tallyBusy, setTallyBusy] = useState(false);
  const exportTallyCombined = async () => {
    const targets = matchedUnits;
    if (targets.length === 0) {
      toast.error("No invoices in the current filter.");
      return;
    }
    setTallyBusy(true);
    try {
      const chunkOf = <T,>(items: T[], size: number) => {
        const chunks: T[][] = [];
        for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
        return chunks;
      };
      const ids = targets.map((unit) => unit.id);
      const gstOptions = await loadPeriodGstOptions(targets.map((u) => {
        const p = allPeriodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        return { unitId: u.id, periodStart: p.start, periodEnd: p.end };
      }));
      const [{ data: org }, gstBranches, engine] = await Promise.all([supabase
        .from("org_settings")
        .select("*")
        .limit(1)
        .maybeSingle(), loadGstBillingBranches(), engineData(ids)]);

      const unitRows: Record<string, any>[] = [];
      for (const chunkIds of chunkOf(ids, 100)) {
        const { data, error } = await supabase
          .from("units")
          .select("id, code, name, customer_id, billing_state, billing_address1, billing_address2, billing_city, billing_district, billing_pincode, billing_country")
          .in("id", chunkIds);
        if (error) throw new Error(error.message);
        unitRows.push(...((data ?? []) as Record<string, any>[]));
      }
      const customerIds = Array.from(new Set(unitRows.map((unit) => String(unit.customer_id ?? "")).filter(Boolean)));
      const customerRows: Record<string, any>[] = [];
      const gstRows: Record<string, any>[] = [];
      for (const chunkIds of chunkOf(customerIds, 100)) {
        const [customersResult, gstResult] = await Promise.all([
          supabase
            .from("customers")
            .select("id, billing_state, billing_address1, billing_address2, billing_city, billing_district, billing_pincode, billing_country")
            .in("id", chunkIds),
          supabase.from("customer_gst_numbers").select("customer_id, gstin, state_name").in("customer_id", chunkIds),
        ]);
        if (customersResult.error) throw new Error(customersResult.error.message);
        if (gstResult.error) throw new Error(gstResult.error.message);
        customerRows.push(...((customersResult.data ?? []) as Record<string, any>[]));
        gstRows.push(...((gstResult.data ?? []) as Record<string, any>[]));
      }
      const customerById = new Map(customerRows.map((customer) => [String(customer.id), customer]));
      const gstinFor = (customerId: string, state: string) => {
        const matching = gstRows.filter((row) => String(row.customer_id) === customerId);
        const stateKey = state.trim().toLowerCase();
        return String(matching.find((row) => String(row.state_name ?? "").trim().toLowerCase() === stateKey)?.gstin ?? matching[0]?.gstin ?? "");
      };

      const contractRows: Record<string, any>[] = [];
      for (const chunkIds of chunkOf(ids, 100)) {
        const { data, error } = await supabase
          .from("client_contracts")
          .select("unit_id, service_type_id, start_date")
          .eq("record_type", "client")
          .eq("status", "active")
          .in("unit_id", chunkIds);
        if (error) throw new Error(error.message);
        contractRows.push(...((data ?? []) as Record<string, any>[]));
      }
      const serviceTypeIdByUnit = new Map<string, string>();
      const latestStartByUnit = new Map<string, string>();
      for (const contract of contractRows) {
        const unitId = String(contract.unit_id ?? "");
        const startDate = String(contract.start_date ?? "");
        if (!unitId || (latestStartByUnit.get(unitId) ?? "") >= startDate) continue;
        latestStartByUnit.set(unitId, startDate);
        if (contract.service_type_id) serviceTypeIdByUnit.set(unitId, String(contract.service_type_id));
      }
      const serviceTypeIds = Array.from(new Set(serviceTypeIdByUnit.values()));
      const serviceTypesResult = serviceTypeIds.length
        ? await supabase.from("service_types").select("id, name").in("id", serviceTypeIds)
        : { data: [], error: null };
      if (serviceTypesResult.error) throw new Error(serviceTypesResult.error.message);
      const serviceTypeNameById = new Map(
        ((serviceTypesResult.data ?? []) as { id: string; name: string }[]).map((type) => [String(type.id), String(type.name)]),
      );

      const unitById = new Map(unitRows.map((unit) => [String(unit.id), unit]));
      // One workbook per invoice part label (e.g. "Regular", "ED & Night").
      const books = new Map<string, { rows: Record<string, unknown>[]; count: number }>();
      for (const unit of targets) {
        const unitRow = unitById.get(unit.id);
        if (!unitRow) continue;
        for (const part of engine.get(unit.id)?.parts ?? []) {
        const label = part.label;
        // Same lines as the invoice page's own Tally export.
        const voucherLines = part.tallyLines;
        if (voucherLines.length === 0 && !(part.extraCharges ?? []).length) continue;
        const period = allPeriodsByUnit.get(unit.id) ?? payrollPeriodForMonth(year, monthIdx);
        const customerId = String(unitRow.customer_id ?? "");
        const customer = customerById.get(customerId) ?? null;
        const billingState = String(unitRow.billing_state || customer?.billing_state || "");
        // Supplier branch and GST type exactly as the invoice page: the site's own billing_state.
        const supplierBranch = resolveGstBillingBranch(gstBranches, unitRow.billing_state ?? null, org as never);
        const serviceTypeId = serviceTypeIdByUnit.get(unit.id);
        const book = books.get(label) ?? { rows: [], count: 0 };
        books.set(label, book);
        book.rows.push(...buildTallyVoucherRows({
          unit: {
            ...unitRow,
            customer_name: unit.customer_name,
            gstin: gstinFor(customerId, billingState),
            customer,
          },
          companyState: invoiceCompanyState(supplierBranch?.stateName, (org as { company_state?: string | null } | null)?.company_state),
          periodStart: period.start,
          periodEnd: period.end,
          serviceTypeName: (serviceTypeId && serviceTypeNameById.get(serviceTypeId)) || "Security Guard",
          lines: voucherLines,
          gstOption: gstOptions.get(unit.id),
          // Same extra-charge lines and rupee round-off as the per-invoice export.
          extraCharges: part.extraCharges ?? [],
          roundToRupee: true,
        }));
        book.count += 1;
        }
      }
      if (books.size === 0) {
        toast.error("No billable attendance for the filtered invoices in this period.");
        return;
      }
      const ym = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
      const multi = books.size > 1;
      for (const [label, book] of books) {
        await writeTallyBillingXlsx(
          `Tally Billing_${ym}${multi ? `_${label.replace(/[^A-Za-z0-9]+/g, "-")}` : ""}_${book.count} invoices`,
          book.rows,
        );
      }
      toast.success(multi ? `${books.size} files downloaded — one per invoice (no invoice numbers).` : "Tally format ready (no invoice numbers).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tally export failed");
    } finally {
      setTallyBusy(false);
    }
  };

  // Combined manpower MIS: one workbook for every filtered invoice, using the
  // same columns and attendance/rate-card maths as the per-invoice MIS export.
  const [misBusy, setMisBusy] = useState(false);
  // Hidden when every organization in view is marked "MIS not applicable".
  const { data: misDisabledCustomers } = useQuery({
    queryKey: ["admin", "mis-disabled-customers"],
    queryFn: loadMisDisabledCustomerIds,
    staleTime: 5 * 60 * 1000,
  });
  const misApplicable = useMemo(() => {
    const disabled = misDisabledCustomers;
    if (!disabled || disabled.size === 0) return true;
    const rows = matchedUnits.length > 0 ? matchedUnits : units;
    if (rows.length === 0) return true;
    return rows.some((u) => !disabled.has(String(u.customer_id ?? "")));
  }, [misDisabledCustomers, matchedUnits, units]);
  const exportMisCombined = async () => {
    const pickedIds = Object.keys(selected).filter((id) => selected[id]);
    let targets = pickedIds.length > 0 ? matchedUnits.filter((u) => selected[u.id]) : matchedUnits;
    // Units with "Separate MIS" are exported one by one, never in a combined sheet.
    if (targets.length > 1) {
      const sep = new Set<string>();
      const allIds = targets.map((u) => u.id);
      for (let i = 0; i < allIds.length; i += 150) {
        const { data } = await supabase
          .from("units")
          .select("id" as never)
          .in("id", allIds.slice(i, i + 150))
          .eq("separate_mis" as never, true as never);
        for (const r of (data ?? []) as unknown as Array<{ id: string }>) sep.add(r.id);
      }
      targets = targets.filter((u) => !sep.has(u.id));
    }
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

      const [{ data: org }, gstBranches] = await Promise.all([
        supabase.from("org_settings").select("*").limit(1).maybeSingle(),
        loadGstBillingBranches(),
      ]);
      const entity = String((org as { company_name?: string } | null)?.company_name ?? "Radiant").trim();

      // Employee lines and rates come from the invoice engine — the invoice page's own calculation.
      const engine = await engineData(ids);

      // Site fields printed in the client MIS.
      const unitRows: any[] = [];
      for (const chunkIds of chunkOf(ids, 100)) {
        const { data, error: unitsErr } = await supabase
          .from("units")
          .select("id, code, name, customer_id, billing_state, billing_district, billing_city, billing_pincode, billing_address1, billing_address2, client_state, client_district, client_city, client_pincode, client_address, gst_number, branch_sap_code, zone")
          .in("id", chunkIds);
        if (unitsErr) throw new Error(unitsErr.message);
        unitRows.push(...((data ?? []) as any[]));
      }
      const unitById = new Map(unitRows.map((u) => [u.id, u]));
      // One combined workbook uses the MIS format of the organization being
      // exported; a mixed selection falls back to the standard layout.
      const customerIds = Array.from(
        new Set(unitRows.map((u) => String(u.customer_id ?? "")).filter(Boolean)),
      );
      const { template, unitValues } = await loadSharedMisTemplate(customerIds, ids);
      const gstOptions = await loadPeriodGstOptions(targets.map((u) => {
        const p = allPeriodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        return { unitId: u.id, periodStart: p.start, periodEnd: p.end };
      }));
      const sourceRows: MisSourceRow[] = [];
      let serial = 1;
      const sgCountedUnits = new Set<string>();
      for (const u of targets) {
        const unitEngine = engine.get(u.id);
        const lines = (unitEngine?.parts ?? []).flatMap((p) => p.mis);
        if (lines.length === 0) continue;
        const unitRow = unitById.get(u.id);
        if (!unitRow) continue;
        const supplierBranch = resolveGstBillingBranch(gstBranches, unitRow.billing_state, org as never);
        const intraState = isIntraStateSupply(unitRow.billing_state, invoiceCompanyState(supplierBranch?.stateName, (org as { company_state?: string | null } | null)?.company_state));
        const period = allPeriodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const periodDays = period.totalDays || 1;
        const periodDates = periodDateList(period.start, period.end);
        const [py, pm, pd] = period.end.split("-");
        const invoiceDate = `${pd}-${pm}-${py}`;
        // Finalised invoices carry their allocated number; anything not yet
        // finalised is clearly marked provisional.
        const finalised = finalsQ.data?.get(unitPeriodKey(u.id, period.start, period.end));
        const invoiceNo =
          finalised?.invoice_no ??
          `PROVISIONAL ${String(period.end).slice(5, 7)}${String(period.end).slice(2, 4)}-${u.code.toUpperCase()}`;
        const siteNorm = String(unitRow.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const clientNorm = String(u.customer_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const branchName = clientNorm && !siteNorm.includes(clientNorm)
          ? [u.customer_name, unitRow.name].filter(Boolean).join(", ")
          : unitRow.name || unitRow.code;
        const contractedPosts = unitEngine?.committed_strength ?? 0;
        for (const line of lines) {
          // Exactly the invoice page's MIS maths for this employee line.
          const misLine = misBillingLine({
            perDay: line.perDay,
            billedDays: line.billedDays,
            otDays: line.otDays,
            total: line.actual,
            intraState,
            gstOption: gstOptions.get(u.id),
            maxWorkingDays: line.maxWorkingDays,
            extraDutyRate: line.extraDutyRate,
          });
          const shift = line.shiftHours > 0 ? line.shiftHours : 8;
          const workingDays = misLine.workingDays;
          const otDuties = misLine.otDays;
          // Extra Duty is counted in duties (days), not clock hours; the "*_ot_hours"
          // keys are legacy MIS column keys and carry the same day figure.
          const otHours = otDuties;
          const otRate = line.extraDutyRate != null ? misLine.otRate : misLine.otRate / shift;
          const otAmount = misLine.otAmount;
          const regular = misLine.regularBilling;
          const otBilling = misLine.otBilling;
          const totalBilling = misLine.totalBilling;
          const lineTax = { total: misLine.gstTotal };
          const { cgst, sgst, igst } = misLine;
          const round = (value: number) => Math.round(value * 100) / 100;
          const rate = { billRate: round(line.contracted), designationName: line.designation, shiftHours: line.shiftHours };
          const candidate = { employee_code: line.employeeCode, full_name: line.name };

          const doj = String(line.joiningDate ?? "").slice(0, 10);
          const incrementCutoff = new Date(period.start);
          incrementCutoff.setFullYear(incrementCutoff.getFullYear() - 1);
          const hasIncrement = !!doj && new Date(doj) <= incrementCutoff;
          const [jy, jm, jd] = doj.split("-");
          sourceRows.push({
            unitId: u.id,
            values: {
              sr_no: serial++, invoice_no: invoiceNo, invoice_date: invoiceDate,
              emp_code: candidate?.employee_code ?? "",
              employee_name: candidate.full_name || nameById.get(line.candidateId) || "",
              regular_reliever: line.isRegular ? "Regular" : "Reliever",
              doj: jd && jm && jy ? `${jd}-${jm}-${jy}` : "", entity,
              designation: `${rate.designationName} @ (${rate.shiftHours})`, branch_name: branchName,
              state: unitRow.client_state || unitRow.billing_state || "", branch_sap_code: unitRow.branch_sap_code ?? "", zone: unitRow.zone ?? "",
              month_days: periodDays, month_rate: line.payrollDays, billing_rate: rate.billRate,
              billing_rate_per_day: round(line.perDay), ot_rate: round(otRate), working_days: roundDutyDays(workingDays),
              ot_duties: roundDutyDays(otDuties), ot_amount: round(otAmount),
              working_days_billing_with_ot: round(regular + otBilling), total_regular_billing: round(regular),
              ot_billing: round(otBilling), total_billing: round(totalBilling),

              cgst: round(cgst), sgst: round(sgst), igst: round(igst),
              grand_total: round(totalBilling + lineTax.total),
              cli_id: unitRow.code ?? "",
              vendor_name: entity,
              district: unitRow.client_district || unitRow.client_city || unitRow.billing_district || unitRow.billing_city || "",
              pin_code: unitRow.client_pincode || unitRow.billing_pincode || "",
              address: unitRow.client_address || [unitRow.billing_address1, unitRow.billing_address2].filter(Boolean).join(", "),
              gst_no: unitRow.gst_number ?? "",
              invoice_month: `${String(period.start).slice(8, 10)}-${String(period.start).slice(5, 7)}-${String(period.start).slice(0, 4)} To ${String(period.end).slice(8, 10)}-${String(period.end).slice(5, 7)}-${String(period.end).slice(0, 4)}`,
              // Contracted posts at the site, counted once per site.
              sg_count: sgCountedUnits.has(u.id) ? 0 : (sgCountedUnits.add(u.id), contractedPosts || 1),
              regular_rate: rate.billRate,
              increment_rate: hasIncrement ? rate.billRate : 0,
              regular_duties: hasIncrement ? 0 : roundDutyDays(workingDays),
              increment_duties: hasIncrement ? roundDutyDays(workingDays) : 0,
              regular_ot_hours: hasIncrement ? 0 : roundDutyDays(otHours),
              increment_ot_hours: hasIncrement ? roundDutyDays(otHours) : 0,
              service_charge_claimed: round(totalBilling),
              gst_18: round(lineTax.total),
              invoice_value: round(totalBilling + lineTax.total),
              total_duties: roundDutyDays(workingDays + otDuties),
              total_ot_hours: roundDutyDays(otHours),
              remarks: "",
              sg_rate: rate.billRate,
              worked_days: roundDutyDays(workingDays + otDuties),

              service_start_date: `${String(period.start).slice(8, 10)}-${String(period.start).slice(5, 7)}-${String(period.start).slice(0, 4)}`,
              service_end_date: `${String(period.end).slice(8, 10)}-${String(period.end).slice(5, 7)}-${String(period.end).slice(0, 4)}`,
              basic_billing_claimed: round(totalBilling),
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
      toast.success(`MIS export ready — ${targets.length} site${targets.length === 1 ? "" : "s"} added, ${sourceRows.length} billable employee rows.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MIS export failed");
    } finally {
      setMisBusy(false);
    }
  };

  // The table waits only for periods, statuses and contract codes — never for money.
  const loading = registerPeriods.isLoading || allStatusQ.isLoading || (moneyEnabled && contractCodesQ.isPending);
  const linkTo = mode === "invoice" ? "/admin/invoice/$unitId" : "/admin/payroll/$unitId";
  const registerLabel = mode === "invoice" ? "Invoices" : "Payroll runs";
  const recordsRef = useRef<HTMLDivElement>(null);

  if (registerPeriods.error) return <div className="py-6 text-sm text-destructive">Register statuses could not load. Please try again.</div>;

  return (
    <div className="space-y-3 sm:space-y-4">
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
          action={{
            label: mode === "invoice" ? "View invoices" : "View payroll",
            onClick: () => {
              recordsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
              recordsRef.current?.focus({ preventScroll: true });
            },
          }}
          sub="all units, by stage"
          countTo={registers.total}
          icon={mode === "invoice" ? Receipt : Wallet}
          accent="lime"
          segments={[
            { label: "Open", value: registers.open, tone: "open" },
            { label: "Ready", value: registers.ready, tone: "ready" as const },
            ...(mode === "payroll" ? [{ label: "Approved", value: registers.approved, tone: "ready" as const }] : []),
            { label: "Processed", value: registers.processed, tone: "done" },
          ]}
        />
        {mode === "invoice" && (
          <>
            <CharterTile
              label="Contracted value"
              sub={financeQ.isSuccess ? `${fmtMoneyCompact(totals.contractedMtd)} till date` : "loading rate cards…"}
              value={financeQ.isSuccess ? fmtMoneyCompact(totals.monthlyContracted) : "—"}
              icon={IndianRupee}
              accent="indigo"
            />
            <CharterTile
              label="Invoice value to date"
              sub={financeQ.isSuccess ? `${totals.realisationPct}% of contracted till date` : "of contracted: loading…"}
              value={savedLoading ? "…" : fmtSummary(totals.invoiceAmount, totals.readyCount)}
              icon={Receipt}
              accent="emerald"
            />
            <CharterTile
              label="Payroll gross to date"
              sub={`less ${fmtMoneyCompact(totals.deductionAmount)} deductions`}
              value={savedLoading ? "…" : fmtSummary(totals.payrollAmount, totals.readyCount)}
              icon={Wallet}
              accent="amber"
            />
            <CharterTile
              label="Margin"
              sub={`${totals.marginPct}% · current payroll periods`}
              value={savedLoading ? "…" : fmtSummary(totals.margin, totals.readyCount)}
              icon={Gauge}
              accent="rose"
            />
          </>
        )}
      </CharterTileGrid>

      {mode === "invoice" && (savedLoading || updatingCount > 0 || liveFailedIds.length > 0 || unavailableCount > 0) && (
        <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {(savedLoading || updatingCount > 0) && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              {savedLoading ? "Loading saved totals…" : `Updating ${updatingCount} site${updatingCount === 1 ? "" : "s"}…`}
            </span>
          )}
          {liveFailedIds.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-destructive">
              {liveFailedIds.length} site{liveFailedIds.length === 1 ? "" : "s"} could not be calculated — not in the totals.
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ["finance-charter-live"] })}
              >
                Retry
              </Button>
            </span>
          )}
          {unavailableCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              {unavailableCount} site{unavailableCount === 1 ? " has" : "s have"} no calculable total — shown as unavailable, not in the totals.
            </span>
          )}
        </div>
      )}

      {mode !== "invoice" && filters}





      {mode === "invoice" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filters}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">State</label>
            <MultiSelectFilter
              selected={stateFilter}
              onChange={(v) => {
                setStateFilter(v);
                setCityFilter([]);
              }}
              options={stateOptions}
              allLabel={`All states (${stateOptions.length})`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">City</label>
            <MultiSelectFilter
              selected={cityFilter}
              onChange={setCityFilter}
              options={cityOptions}
              allLabel={`All cities (${cityOptions.length})`}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <div className="relative min-w-0 sm:w-72">
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
            <SelectTrigger className="h-9 w-[132px] rounded-lg sm:w-48 sm:rounded-xl" aria-label={`${mode === "invoice" ? "Invoice" : "Payroll"} status`}>
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
                  <SelectItem value="ready">Payroll ready</SelectItem>
                  <SelectItem value="approved">Payroll approved</SelectItem>
                  <SelectItem value="processed">Payroll processed</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}
        {mode !== "invoice" && (
          <>
            <MultiSelectFilter
              selected={stateFilter}
              onChange={(v) => {
                setStateFilter(v);
                setCityFilter([]);
              }}
              options={stateOptions}
              allLabel="All states"
            />
            <MultiSelectFilter
              selected={cityFilter}
              onChange={setCityFilter}
              options={cityOptions}
              allLabel="All cities"
            />
          </>
        )}
        <div className="hidden flex-1 sm:block" />
        <div className="col-span-2 flex items-center gap-1.5 overflow-x-auto sm:contents">
        {mode === "invoice" && (
          <Button
            variant="outline"
            className="h-9 shrink-0 rounded-lg sm:rounded-xl"
            disabled={tallyBusy}
            onClick={() => void exportTallyCombined()}
          >
            <Download className="h-4 w-4" /> {tallyBusy ? "Preparing…" : <><span className="sm:hidden">Tally</span><span className="hidden sm:inline">Download Tally · no invoice no.</span></>}
          </Button>
        )}
        {mode === "invoice" && misApplicable && (
          <Button
            variant="outline"
            className="h-9 shrink-0 rounded-lg sm:rounded-xl"
            disabled={misBusy}
            onClick={() => void exportMisCombined()}
          >
            <Receipt className="mr-1.5 h-4 w-4" /> {misBusy ? "Preparing…" : selectedTargets.length > 0 ? `MIS Format (${selectedTargets.length})` : "MIS Format"}
          </Button>
        )}
        <Button
          variant="outline"
          className="h-9 shrink-0 rounded-lg sm:rounded-xl"
          // Invoice CSV carries money: never export while some sites are still updating.
          disabled={mode === "invoice" && (savedLoading || updatingCount > 0 || liveFailedIds.length > 0)}
          title={mode === "invoice" && (savedLoading || updatingCount > 0) ? "Totals are still updating" : undefined}
          onClick={exportCsv}
        >
          <Download className="h-4 w-4" /> Export
        </Button>
        </div>
      </div>

      {canFinalise && selectableRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2">
          <Checkbox
            checked={selectedTargets.length > 0 && selectedTargets.length === selectableRows.length}
            onCheckedChange={(v) => {
              if (!v) return setSelected({});
              const target = lockedState ?? normalizeState(selectableRows[0]?.unit.client_state || selectableRows[0]?.unit.billing_state || "");
              setSelected(
                Object.fromEntries(
                  selectableRows
                    .filter((r) => normalizeState(r.unit.client_state || r.unit.billing_state || "") === target)
                    .map((r) => [r.unit.id, true]),
                ),
              );
            }}
            aria-label="Select all sites ready to finalise in this state"
          />
          <span className="text-[12px] font-medium">
            {selectedTargets.length > 0
              ? `${selectedTargets.length} site${selectedTargets.length > 1 ? "s" : ""} selected · ${lockedStateLabel || "state not set"} only`
              : `Select sites to raise a final invoice (${selectableRows.length} ready) — one state per invoice`}
          </span>
          <div className="flex-1" />
          {selectedTargets.length > 0 && (
            <Button variant="ghost" className="h-8 rounded-lg" onClick={() => setSelected({})}>
              Clear
            </Button>
          )}
          <Button
            className="h-9 rounded-xl"
            disabled={selectedTargets.length === 0 || preparingFinal}
            onClick={() => void openFinal()}
          >
            <FileCheck2 className="h-4 w-4" /> {preparingFinal ? "Preparing…" : "Generate final invoice"}
          </Button>
        </div>
      )}

      <FinalInvoiceDialog
        open={finalOpen}
        onOpenChange={setFinalOpen}
        targets={finalTargets}
        onDone={() => setSelected({})}
      />


      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Loading period-to-date {mode === "invoice" ? "invoice" : "payroll"} values…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No units match this search.
        </div>
      ) : (
        <div ref={recordsRef} tabIndex={-1} aria-label={mode === "invoice" ? "Invoice records" : "Payroll records"} className="space-y-2 scroll-mt-20 outline-none">
          {rows.map((r) => {
            const isOpen = !!expanded[r.unit.id];
            if (mode === "payroll") {
              return (
                <Link
                  key={r.unit.id}
                  to={linkTo}
                  params={{ unitId: r.unit.id }}
                  search={{ start: r.period.start, end: r.period.end }}
                  data-panel="true"
                  className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 transition-colors hover:border-primary/40 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold group-hover:text-primary">
                      {r.unit.name || r.unit.code}
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 truncate text-xs tabular-nums text-muted-foreground">
                      {r.unit.customer_code && <span className="shrink-0 font-medium">{r.unit.customer_code}</span>}
                      <span className="truncate">{r.contractCode}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <MoneyStatusBadge kind="payroll" status={r.status.payroll} />
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">View Payroll <Wallet className="h-3.5 w-3.5" /></span>
                  </div>
                </Link>
              );
            }
            return (
              <div
                key={r.unit.id}
                className={cn(
                  "group overflow-hidden rounded-lg border border-border/70 bg-card transition-all",
                  "hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45)]",
                  isOpen && "border-primary/40",
                )}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-y-2">
                  {canFinalise && !r.finalInvoice && r.status.attendance === "approved" && (
                    <div className="flex w-9 shrink-0 items-center justify-center border-r border-border/60">
                      <Checkbox
                        disabled={!!lockedState && normalizeState(r.unit.client_state || r.unit.billing_state || "") !== lockedState}
                        checked={!!selected[r.unit.id]}
                        onCheckedChange={(v) =>
                          setSelected((p) => {
                            const next = { ...p };
                            if (v) next[r.unit.id] = true;
                            else delete next[r.unit.id];
                            return next;
                          })
                        }
                        aria-label={
                          !!lockedState && normalizeState(r.unit.client_state || r.unit.billing_state || "") !== lockedState
                            ? `${r.unit.name || r.unit.code} is in another state — one state per invoice`
                            : `Select ${r.unit.name || r.unit.code} for final invoice`
                        }
                        title={
                          !!lockedState && normalizeState(r.unit.client_state || r.unit.billing_state || "") !== lockedState
                            ? "Invoices cannot mix states. Clear the selection to pick this state instead."
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <Link
                    to={linkTo}
                    params={{ unitId: r.unit.id }}
                    search={{ start: r.period.start, end: r.period.end }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:text-primary">
                        {r.unit.name || r.unit.code}
                      </span>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          {r.committed == null ? `${r.actual}` : `${r.actual}/${r.committed}`} deployed
                        </span>
                        {r.unit.customer_code && (
                          <span className="shrink-0 font-medium tabular-nums">{r.unit.customer_code}</span>
                        )}
                        <span className="truncate tabular-nums">{r.contractCode}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5 pr-1 sm:flex-row sm:items-center">
                      {r.finalInvoice && (
                        <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-600">
                          {r.finalInvoice.invoice_no}
                        </span>
                      )}
                      <MoneyStatusBadge kind="invoice" status={r.status.invoice} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">View Invoice <Receipt className="h-3.5 w-3.5" /></span>
                    </div>
                  </Link>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={isOpen ? "Hide breakdown" : "Show breakdown"}
                    aria-expanded={isOpen}
                    onClick={() => setExpanded((p) => ({ ...p, [r.unit.id]: !p[r.unit.id] }))}
                    className="mr-3 shrink-0 text-xs"
                  >
                    {isOpen ? "Hide Breakdown" : "Breakdown"}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                  </Button>
                </div>

                {isOpen && (
                    <div className="space-y-3 border-t border-border/60 bg-muted/25 px-2.5 py-2.5 sm:space-y-4 sm:px-4 sm:py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <div className="min-w-0 text-[11px] leading-snug text-muted-foreground">
                        {r.status.attendance !== "approved" ? (
                          <>
                             <span className="font-semibold text-destructive">
                               Invoice is open.
                              </span><span className="hidden sm:inline">{" "}Attendance for this period is{" "}
                            {r.status.attendance === "submitted" ? "awaiting approval" : "still being marked"} — values
                             keep moving until it is approved and locked.</span>
                          </>
                         ) : r.status.invoice === "processed" ? (
                          <>
                             <span className="font-semibold text-emerald-600">Processed and locked.</span><span className="hidden sm:inline"> Attendance is
                             approved and this period has been run. An admin can reopen it if something must change.</span>
                          </>
                        ) : (
                          <>
                             <span className="font-semibold text-amber-600">Ready to process.</span><span className="hidden sm:inline"> Attendance is
                              approved and locked — the invoice can be run.</span>
                          </>
                        )}
                      </div>
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
                      {breakdownFailed.has(r.unit.id) ? (
                        <p className="rounded-xl border border-dashed border-destructive/40 bg-background/60 px-3 py-4 text-center text-xs text-destructive">
                          Breakdown could not load. Collapse and open it again to retry.
                        </p>
                      ) : breakdownLoading.has(r.unit.id) ? (
                        <p className="rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                          Loading breakdown…
                        </p>
                      ) : (peopleByUnit.get(r.unit.id) ?? []).length === 0 ? (
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
                                 <th className="px-2 py-2 text-right font-medium">Contracted</th>
                                 <th className="px-2 py-2 text-right font-medium">Invoice</th>
                                 <th className="px-2 py-2 text-right font-medium">Payroll</th>
                                 <th className="px-2 py-2 text-right font-medium">Margin</th>
                                 <th className="px-3 py-2 text-right font-medium">Invoice line</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(peopleByUnit.get(r.unit.id) ?? []).map((p) => (
                                <tr key={p.id} className="border-t border-border/50 hover:bg-muted/40">
                                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{p.paidDays}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{p.otDays}</td>
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
                                               ((p.invoiceAmount - p.payrollAmount - p.employerCost) / p.invoiceAmount) * 100,
                                             )
                                           : 0
                                       }
                                     />
                                   </td>
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
