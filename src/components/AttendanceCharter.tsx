import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, ChevronDown, ClipboardList, Download, Gauge, MapPinned, Search, TrendingDown, UserCheck, Users } from "lucide-react";
import { CharterTile, CharterTileGrid } from "@/components/CharterTiles";
import { CharterPagination } from "@/components/CharterPagination";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { useWorkforceCoverage, type UnitCoverage } from "@/components/WorkforceCoverage";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";
import { fetchShiftHoursMap, shiftHoursFor, DEFAULT_SHIFT_HOURS } from "@/lib/shift-hours";
import {
  fetchPeriodStatusesForUnitPeriods,
  PERIOD_STATUS_QK,
  useAttendanceMoneyRealtime,
  type PeriodStatus,
} from "@/lib/period-status";
import { AttendanceStatusBadge, MoneyStatusBadge } from "@/components/PeriodStatusBadge";
import { payrollPeriodForMonth, type PayrollWindow } from "@/lib/payroll-period";
import { SCAN_JOBS_QK, fetchRunningScanJobs, formatRemaining } from "@/lib/attendance-scan-jobs";

// ---------------------------------------------------------------------------
// Attendance charter — the default attendance landing view.
// Reads exactly like the deployment charter (committed / actual / variance /
// coverage) but adds period-to-date attendance: projected man-hours from the
// contract vs actual man-hours worked (including overtime).
// ---------------------------------------------------------------------------

export type CharterUnit = {
  id: string;
  code: string;
  name: string;
  customer_name: string;
  contract_codes: string[];
  security_guards: { id: string; name: string }[];
};

type CodeRow = { code: string; counts_as_present: boolean; is_paid: boolean; day_value: number | string | null };

type PersonStat = {
  id: string;
  name: string;
  shiftHours: number;
  presentDays: number;
  otDays: number;
  actualHours: number;
  projectedHours: number;
};

function fmtHours(n: number) {
  return `${Math.round(n).toLocaleString("en-IN")}h`;
}

function pct(actual: number, projected: number) {
  if (projected <= 0) return 0;
  return Math.round((actual / projected) * 100);
}

function toneFor(value: number) {
  if (value >= 100) return "emerald";
  if (value >= 85) return "amber";
  return "rose";
}

function CoverageChip({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const tone = toneFor(value);
  return (
    <span
      className={cn(
        "inline-flex min-w-[52px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone === "emerald" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
        tone === "amber" && "border-amber-500/25 bg-amber-500/10 text-amber-600",
        tone === "rose" && "border-destructive/25 bg-destructive/10 text-destructive",
      )}
    >
      {value}
      {suffix}
    </span>
  );
}

function VarianceChip({ committed, actual }: { committed: number; actual: number }) {
  const diff = actual - committed;
  return (
    <span
      className={cn(
        "inline-flex min-w-[44px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        diff === 0 && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
        diff < 0 && "border-destructive/25 bg-destructive/10 text-destructive",
        diff > 0 && "border-amber-500/25 bg-amber-500/10 text-amber-600",
      )}
    >
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

/** Circular period-to-date gauge used as the row's visual anchor. */
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

const PAGE_SIZE = 25;

export function AttendanceCharter({
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
  units: CharterUnit[];
  monthIdx: number;
  year: number;
  query: string;
  onQueryChange: (v: string) => void;
  organizationCount?: number;
  activeEmployees?: number;
  filters?: ReactNode;
  windowsByUnit: Map<string, PayrollWindow>;
  statusFilter?: "all" | "open" | "approved";
  onStatusFilterChange?: (value: "all" | "open" | "approved") => void;
}) {

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Search first, then paginate, and only then load period-to-date attendance.
  // Every heavy read below is scoped to the 25 units actually on screen, so the
  // page never pulls thousands of units' entries in one shot.
  const matchedUnits = useMemo(() => {
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

  const allUnitIds = useMemo(() => matchedUnits.map((u) => u.id), [matchedUnits]);
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
    queryKey: [PERIOD_STATUS_QK, "attendance-charter-all", allPeriodKey],
    enabled: allUnitIds.length > 0,
    staleTime: 0,
    queryFn: () => fetchPeriodStatusesForUnitPeriods(allPeriodsByUnit),
  });
  const filteredUnits = useMemo(() => {
    if (statusFilter === "all") return matchedUnits;
    return matchedUnits.filter((unit) => {
      const approved = allStatusQ.data?.get(unit.id)?.attendance === "approved";
      return statusFilter === "approved" ? approved : !approved;
    });
  }, [allStatusQ.data, matchedUnits, statusFilter]);

  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => setPage(0), [query, statusFilter, units.length, monthIdx, year]);
  const pageUnits = useMemo(
    () => filteredUnits.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredUnits, safePage],
  );
  const unitIds = useMemo(() => pageUnits.map((u) => u.id), [pageUnits]);

  // Any attendance / OT edit anywhere refreshes this charter instantly.
  useAttendanceMoneyRealtime();

  const periodsByUnit = useMemo(() => {
    const out = new Map<string, ReturnType<typeof payrollPeriodForMonth>>();
    for (const unitId of unitIds) out.set(unitId, payrollPeriodForMonth(year, monthIdx, windowsByUnit.get(unitId)));
    return out;
  }, [unitIds, year, monthIdx, windowsByUnit]);
  const periodKey = useMemo(
    () => Array.from(periodsByUnit, ([unitId, p]) => `${unitId}:${p.start}:${p.end}`).join("|"),
    [periodsByUnit],
  );

  const statusQ = useQuery({
    queryKey: [PERIOD_STATUS_QK, periodKey],
    enabled: unitIds.length > 0,
    staleTime: 0,
    queryFn: () => fetchPeriodStatusesForUnitPeriods(periodsByUnit),
  });

  // Sheet reads that are still running in the background (dialog may be closed).
  const scanJobsQ = useQuery({
    queryKey: [SCAN_JOBS_QK, unitIds.join(",")],
    enabled: unitIds.length > 0,
    refetchInterval: 5000,
    queryFn: () => fetchRunningScanJobs(unitIds),
  });




  const { data: coverage = [] } = useWorkforceCoverage();
  const coverageByUnit = useMemo(() => {
    const m = new Map<string, UnitCoverage>();
    for (const c of coverage) m.set(c.unitId, c);
    return m;
  }, [coverage]);

  const codesQ = useQuery({
    queryKey: ["attendance-codes-charter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_codes" as never)
        .select("code, counts_as_present, is_paid, day_value");
      return ((data ?? []) as unknown) as CodeRow[];
    },
  });

  const shiftQ = useQuery({
    queryKey: ["attendance-charter-shifts", unitIds.join(",")],
    enabled: unitIds.length > 0,
    queryFn: () => fetchShiftHoursMap(unitIds),
  });

  const entriesQ = useQuery({
    queryKey: ["attendance-charter-entries", periodKey],
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
    const out = new Map<string, Map<string, PersonStat>>();
    for (const e of entriesQ.data ?? []) {
      const unitId = e.unit_id ?? "";
      if (!unitId) continue;
      if (!out.has(unitId)) out.set(unitId, new Map());
      const bucket = out.get(unitId)!;
      const shift = shiftHoursFor(shiftQ.data, unitId, e.designation_id) || DEFAULT_SHIFT_HOURS;
      let person = bucket.get(e.candidate_id);
      if (!person) {
        person = {
          id: e.candidate_id,
          name: nameById.get(e.candidate_id) ?? "—",
          shiftHours: shift,
          presentDays: 0,
          otDays: 0,
          actualHours: 0,
          projectedHours: (periodsByUnit.get(unitId)?.elapsedDays ?? 0) * shift,
        };
        bucket.set(e.candidate_id, person);
      }
      const code = codeMap.get(e.code);
      const raw = code?.day_value;
      const dayValue = raw == null || Number.isNaN(Number(raw)) ? 1 : Math.max(0, Number(raw));
      const counted = code ? (code.counts_as_present || code.is_paid ? dayValue : 0) : 0;
      const ot = Number(e.ot_hours) || 0;
      person.presentDays += counted;
      person.otDays += ot;
      person.actualHours += counted * shift + ot * shift;
    }
    return out;
  }, [entriesQ.data, shiftQ.data, codeMap, nameById, periodsByUnit]);

  const rows = useMemo(() => {
    return pageUnits
      .map((u) => {
        const cov = coverageByUnit.get(u.id);
        const committed = cov?.committed ?? 0;
        const actual = cov?.actual ?? u.security_guards.length;
        const period = periodsByUnit.get(u.id) ?? payrollPeriodForMonth(year, monthIdx);
        const unitShift = shiftHoursFor(shiftQ.data, u.id, null) || DEFAULT_SHIFT_HOURS;
        const people = Array.from(statsByUnit.get(u.id)?.values() ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        // Projected man-hours come from the contract: committed heads × elapsed days × shift.
        const headsForProjection = committed > 0 ? committed : actual;
        const projectedHours = headsForProjection * period.elapsedDays * unitShift;
        const actualHours = people.reduce((s, p) => s + p.actualHours, 0);
        const otHours = people.reduce((s, p) => s + p.otDays * p.shiftHours, 0);
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
          contractCode: cov?.contractCode ?? u.contract_codes[0] ?? "—",
          lines: cov?.lines ?? [],
          committed,
          actual,
          unitShift,
          people,
          projectedHours,
          actualHours,
          otHours,
          period,
          status,
          mtdPct: pct(actualHours, projectedHours),
        };
      });
  }, [pageUnits, coverageByUnit, statsByUnit, shiftQ.data, statusQ.data, periodsByUnit, year, monthIdx]);

  const totals = useMemo(() => {
    const committed = rows.reduce((s, r) => s + r.committed, 0);
    const actual = rows.reduce((s, r) => s + r.actual, 0);
    const projectedHours = rows.reduce((s, r) => s + r.projectedHours, 0);
    const actualHours = rows.reduce((s, r) => s + r.actualHours, 0);
    const otHours = rows.reduce((s, r) => s + r.otHours, 0);
    return {
      committed,
      actual,
      gap: actual - committed,
      coverage: committed > 0 ? Math.round((actual / committed) * 100) : 0,
      projectedHours,
      actualHours,
      otHours,
      mtdPct: pct(actualHours, projectedHours),
    };
  }, [rows]);

  const exportCsv = () => {
    downloadCsv(
      "attendance-charter",
      rows.map((r) => ({
        Contract: r.contractCode,
        Organisation: r.unit.customer_name,
        Unit: r.unit.name || r.unit.code,
        "Shift hours": r.unitShift,
        Committed: r.committed,
        Actual: r.actual,
        Variance: r.actual - r.committed,
        "Projected man-hours (period to date)": Math.round(r.projectedHours),
        "Actual man-hours (period to date)": Math.round(r.actualHours),
        "Extra duty hours (period to date)": Math.round(r.otHours),
        "Period-to-date attendance %": r.mtdPct,
      })),
    );
  };

  const loading = entriesQ.isLoading || shiftQ.isLoading;

  // Attendance sheets for the selected payroll period, by lifecycle stage.
  const sheets = useMemo(() => {
    let open = 0;
    let submitted = 0;
    let approved = 0;
    for (const r of rows) {
      if (r.status.attendance === "approved") approved += 1;
      else if (r.status.attendance === "submitted") submitted += 1;
      else open += 1;
    }
    return { total: rows.length, open, submitted, approved };
  }, [rows]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <CharterTileGrid>
        <CharterTile
          label="Organizations"
          sub="clients on this charter"
          countTo={organizationCount ?? new Set(units.map((u) => u.customer_name)).size}
          icon={Building2}
          accent="violet"
        />
        <CharterTile label="Clients" sub="sites being marked" countTo={units.length} icon={MapPinned} accent="cyan" />
        <CharterTile
          label="Active employees"
          sub="on the muster roll"
          countTo={activeEmployees ?? units.reduce((s, u) => s + u.security_guards.length, 0)}
          icon={Users}
          accent="sky"
        />
        <CharterTile
          label="Attendance sheets"
          sub="this page, by stage"
          countTo={sheets.total}
          icon={ClipboardList}
          accent="lime"
          segments={[
            { label: "Open", value: sheets.open + sheets.submitted, tone: "open" },
            { label: "Approved", value: sheets.approved, tone: "done" },
          ]}
        />
        <CharterTile
          label="Deployment"
          sub={`${totals.coverage}% coverage · ${totals.gap > 0 ? `+${totals.gap}` : totals.gap} variance · this page`}
          value={`${totals.actual}/${totals.committed}`}
          icon={Users}
          accent="indigo"
        />
        <CharterTile
          label="Actual man-hours"
          sub={`of ${fmtHours(totals.projectedHours)} projected · this page`}
          value={fmtHours(totals.actualHours)}
          icon={UserCheck}
          accent="emerald"
        />
        <CharterTile
          label="Extra duty"
          sub="period till date · this page"
          value={fmtHours(totals.otHours)}
          icon={TrendingDown}
          accent="amber"
        />
        <CharterTile
          label="Period attendance"
          sub="current payroll periods · this page"
          value={`${totals.mtdPct}%`}
          icon={Gauge}
          accent="rose"
        />
      </CharterTileGrid>

      {filters}


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
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as "all" | "open" | "approved")}>
            <SelectTrigger className="h-9 w-[142px] rounded-lg sm:w-52 sm:rounded-xl" aria-label="Attendance status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All attendance</SelectItem>
              <SelectItem value="open">Attendance open</SelectItem>
              <SelectItem value="approved">Attendance approved</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="hidden flex-1 sm:block" />
        <Button variant="outline" className="col-span-2 h-9 w-fit rounded-lg sm:rounded-xl" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" /> Export
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Loading period-to-date attendance…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No units match this search.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isOpen = !!expanded[r.unit.id];
            const scan = scanJobsQ.data?.get(r.unit.id);
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
                  {/* Whole row opens the muster roll. */}
                  <Link
                    to="/admin/attendance/$unitId"
                    params={{ unitId: r.unit.id }}
                    search={{ month: monthIdx, year, start: r.period.start, end: r.period.end }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3"
                  >
                    <Dial value={r.mtdPct} />
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold group-hover:text-primary">
                          {r.unit.name || r.unit.code}
                        </span>
                        <div className="scrollbar-hide mt-1 flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
                          <span className="hidden shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex sm:uppercase">
                            {r.unitShift}h shift
                          </span>
                          <AttendanceStatusBadge status={r.status.attendance} />
                          <MoneyStatusBadge kind="payroll" status={r.status.payroll} />
                          <MoneyStatusBadge kind="invoice" status={r.status.invoice} />
                          {scan && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                              Reading {Math.round(Number(scan.progress) || 0)}% · {formatRemaining(scan.eta_seconds)}
                            </span>
                          )}
                        </div>
                      </div>
                      {scan && (
                        <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-700"
                            style={{ width: `${Math.max(2, Math.min(100, Number(scan.progress) || 0))}%` }}
                          />
                        </div>
                      )}
                      <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                        {r.unit.customer_name} · {r.contractCode}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground sm:hidden">
                        <span>
                          {r.actual}/{r.committed} deployed
                        </span>
                        <span>·</span>
                        <span>
                          {fmtHours(r.actualHours)} / {fmtHours(r.projectedHours)}
                        </span>
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-5 pr-1 text-sm tabular-nums sm:flex">
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Deployed</div>
                        <div className="font-semibold">
                          {r.actual}
                          <span className="text-muted-foreground">/{r.committed}</span>
                        </div>
                      </div>
                      <VarianceChip committed={r.committed} actual={r.actual} />
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Period hours</div>
                        <div className="font-semibold">
                          {fmtHours(r.actualHours)}
                          <span className="text-muted-foreground"> / {fmtHours(r.projectedHours)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ED</div>
                        <div className="font-semibold">{fmtHours(r.otHours)}</div>
                      </div>
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
                  <div className="space-y-3 border-t border-border/60 bg-muted/25 px-2.5 py-2.5 sm:space-y-4 sm:px-4 sm:py-3">
                    {r.lines.length > 0 && (
                      <div>
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Role-wise commitment
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {r.lines.map((l) => (
                            <div
                              key={l.role}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2"
                            >
                              <span className="truncate text-xs font-medium">{l.role}</span>
                              <span className="flex items-center gap-2 text-xs tabular-nums">
                                <span className="font-semibold">
                                  {l.actual}
                                  <span className="text-muted-foreground">/{l.committed}</span>
                                </span>
                                <VarianceChip committed={l.committed} actual={l.actual} />
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
                                <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">Employee</th>
                                <th className="px-2 py-2 text-right font-medium">Shift</th>
                                <th className="px-2 py-2 text-right font-medium">Days</th>
                                <th className="px-2 py-2 text-right font-medium">ED hrs</th>
                                <th className="px-2 py-2 text-right font-medium">Actual</th>
                                <th className="px-2 py-2 text-right font-medium">Projected</th>
                                <th className="px-3 py-2 text-right font-medium">Period</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.people.map((p) => (
                                <tr key={p.id} className="border-t border-border/50 hover:bg-muted/40">
                                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium">{p.name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{p.shiftHours}h</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{p.presentDays}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {Math.round(p.otDays * p.shiftHours)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtHours(p.actualHours)}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                    {fmtHours(p.projectedHours)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right">
                                    <CoverageChip value={pct(p.actualHours, p.projectedHours)} />
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
        </div>
      )}

      <CharterPagination
        page={safePage}
        pageCount={pageCount}
        total={filteredUnits.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
