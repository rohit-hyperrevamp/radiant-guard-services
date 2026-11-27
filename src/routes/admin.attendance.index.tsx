import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSessionState } from "@/lib/use-session-state";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Search, X } from "lucide-react";

import { HeroTile } from "@/components/HeroTile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LabeledMultiSelectFilter } from "@/components/MultiSelectFilter";
import { useOperationalUnitScope } from "@/lib/use-manager-scope";
import { ListSkeleton } from "@/components/Skeletons";
import { AttendanceCharter } from "@/components/AttendanceCharter";
import { PayrollWindowPeriodPicker } from "@/components/PayrollWindowPeriodPicker";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import {
  CHARTER_UNITS_LITE_QK,
  CHARTER_UNITS_QK,
  fetchCharterUnits,
  fetchCharterUnitsLite,
  filterCharterUnitsBySearch,
  type CharterPageData,
} from "@/lib/charter-units";
import { usePayrollWindowSelection } from "@/lib/use-payroll-window-selection";
import { AttendanceComplianceBox } from "@/components/AttendanceComplianceBox";
import { useCurrentPermissions } from "@/lib/rbac";



const searchSchema = z.object({
  window: z.string().optional(), month: z.coerce.number().optional(), year: z.coerce.number().optional(),
  status: z.string().optional(), dashboard: z.boolean().optional(),
});

export const Route = createFileRoute("/admin/attendance/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Attendance | Radiant Guard Services" },
      { name: "description", content: "Find units, select payroll periods, and manage attendance sheets." },
      { property: "og:title", content: "Attendance | Radiant Guard Services" },
      { property: "og:description", content: "Find units, select payroll periods, and manage attendance sheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendanceUnitsPage,
});

type EmployeeRef = { id: string; name: string };

type ClientEmployee = {
  id: string;
  name: string;
  designation: string;
  unit_id: string;
  unit_name: string;
  unit_code: string;
};

type UnitRow = {
  id: string;
  code: string;
  name: string;
  location: string;
  branch_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  billing_state: string | null;
  client_state?: string | null;
  contract_codes: string[];
  contract_end: string | null;
  active_employee_count: number;
  guard_count?: number;
  security_guards: EmployeeRef[];
};

type AttendancePageData = {
  units: UnitRow[];
  organizations: { id: string; name: string; code: string }[];
  employeesByCustomer: Record<string, ClientEmployee[]>;
  summary: { organizations: number; units: number; activeEmployees: number };
};

// Only active employees appear on attendance. Field officers are on Radiant's own
// payroll (non-billable) and are intentionally excluded from the muster roll.
const ACTIVE_EMPLOYEE_STATUSES = ["active"] as const;

// Filters follow the Client Detail state (falls back to billing when blank).
const stOf = (u: { client_state?: string | null; billing_state: string | null }) =>
  (u.client_state || u.billing_state || "").trim();

function AttendanceUnitsPage() {
  const search = Route.useSearch();
  // Dashboard links intentionally replace stale local list filters once on arrival.

  const [q, setQ] = useSessionState("attendance:q", "");
  const [orgFilter, setOrgFilter] = useSessionState<string[]>("attendance:orgFilter", []);
  const [unitFilter, setUnitFilter] = useSessionState<string[]>("attendance:unitFilter", []);
  const [stateFilter, setStateFilter] = useSessionState<string[]>("attendance:stateFilter", []);
  const [statusFilter, setStatusFilter] = useSessionState<"all" | "open" | "in_progress" | "submitted" | "approved">("attendance:statusFilter", "all");
  useEffect(() => {
    if (!search.dashboard) return;
    setQ(""); setOrgFilter([]); setUnitFilter([]);
    setStateFilter([]);
    const status = search.status ?? "all";
    setStatusFilter(["all", "open", "in_progress", "submitted", "approved"].includes(status) ? status as "all" | "open" | "in_progress" | "submitted" | "approved" : "all");
  }, [search.dashboard, search.month, search.year, search.window, search.status]);





  // First paint from the lite roster (no guard names); the full roster (names
  // for search) follows right after, or is used at once when already cached.
  const queryClient = useQueryClient();
  const [hadFull] = useState(() => queryClient.getQueryData<CharterPageData>(CHARTER_UNITS_QK) !== undefined);
  const liteQ = useQuery({
    queryKey: CHARTER_UNITS_LITE_QK,
    queryFn: fetchCharterUnitsLite,
    enabled: !hadFull,
    staleTime: 60_000,
    // A failure here just hands over to the full roster below (which retries).
    retry: false,
  });
  const fullQ = useQuery({
    queryKey: CHARTER_UNITS_QK,
    queryFn: fetchCharterUnits,
    enabled: hadFull || liteQ.isFetched,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    refetchOnMount: "always",
  });
  const data: CharterPageData | undefined = fullQ.data ?? liteQ.data;
  const error = data ? null : (fullQ.error ?? null);
  const isLoading = !data && !error;


  const foScope = useOperationalUnitScope();
  const { canSwitch } = useCurrentPermissions();
  const rawUnits = data?.units ?? [];
  const units = useMemo(
    () => (foScope.isScoped ? rawUnits.filter((u) => foScope.unitIds.has(u.id)) : rawUnits),
    [rawUnits, foScope.isScoped, foScope.unitIds],
  );
  const periodSelection = usePayrollWindowSelection(units.map((unit) => unit.id), search, "attendance");
  const { monthIdx, year, selectedKey, windowsByUnit, unitIdsForWindow } = periodSelection;
  const windowUnits = useMemo(() => units.filter((unit) => unitIdsForWindow.has(unit.id)), [units, unitIdsForWindow]);
  const unitOptions = useMemo(
    () =>
      windowUnits.filter(
        (u) => orgFilter.length === 0 || orgFilter.includes(u.customer_id || u.customer_name),
      ),
    [windowUnits, orgFilter],
  );
  const stateOptions = useMemo(() => {
    const states = new Set<string>();
    for (const u of windowUnits) {
      if (orgFilter.length > 0 && !orgFilter.includes(u.customer_id || u.customer_name)) continue;
      if (stOf(u)) states.add(stOf(u));
    }
    return [...states].sort();
  }, [windowUnits, orgFilter]);
  const organizations = useMemo(() => {
    const all = data?.organizations ?? [];
    const allowed = new Set(windowUnits.map((u) => u.customer_id));
    return all.filter((o) => allowed.has(o.id));
  }, [data?.organizations, windowUnits]);
  const summary = useMemo(
    () => (foScope.isScoped
      ? { organizations: organizations.length, units: windowUnits.length }
      : { organizations: new Set(windowUnits.map((u) => u.customer_id)).size, units: windowUnits.length }),
    [foScope.isScoped, organizations, windowUnits],
  );





  // Shared search rules (src/lib/search-match.ts), deferred for large rosters.
  const deferredQ = useDeferredValue(q);
  const filtered = useMemo(() => {
    const byFilters = windowUnits.filter((u) => {
      if (orgFilter.length > 0 && !orgFilter.includes(u.customer_id || u.customer_name)) return false;
      if (unitFilter.length > 0 && !unitFilter.includes(u.id)) return false;
      if (stateFilter.length > 0 && !stateFilter.includes(stOf(u))) return false;
      return true;
    });
    return filterCharterUnitsBySearch(byFilters, deferredQ);
  }, [deferredQ, orgFilter, unitFilter, stateFilter, windowUnits]);

  const anyFilter = orgFilter.length > 0 || unitFilter.length > 0 || stateFilter.length > 0 || statusFilter !== "all" || q.trim().length > 0;



  return (
    <div className="space-y-4 sm:space-y-6">
      <HeroTile
        eyebrow="Attendance"
        title="Attendance"
        subtitle="Contract payroll periods"
        description="Open a client’s attendance for this exact contract period."
      />

      <div className="flex items-center justify-between gap-2">
        <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5">
          <PayrollWindowPeriodPicker options={periodSelection.options} selectedKey={selectedKey} onWindowChange={periodSelection.selectWindow} />
          <MonthYearPicker
            className="border-primary/40 bg-primary/5 ring-1 ring-primary/15 dark:border-primary/50 dark:bg-primary/10"
            value={`${year}-${String(monthIdx + 1).padStart(2, "0")}`}
            onChange={(ym) => {
              const [y, m] = ym.split("-").map(Number);
              periodSelection.setPeriod(y, m - 1);
            }}
          />
        </div>
        <Button asChild size="icon" variant="outline" className="h-10 w-10 shrink-0 rounded-lg sm:h-8 sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-3 sm:text-xs">
          <Link to="/admin/attendance/employee">
            <Search className="h-4 w-4" /> <span className="hidden sm:inline">Employee lookup</span>
          </Link>
        </Button>
      </div>

      {canSwitch("attendance", "compliance") && (
        <AttendanceComplianceBox
          year={year}
          monthIdx={monthIdx}
          windowKey={selectedKey}
          windowLabel={selectedKey === "all" ? "All windows" : (periodSelection.selectedWindow?.label ?? selectedKey)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm sm:rounded-3xl">
        <div className="border-b border-border/60 px-3 py-2.5 sm:space-y-3 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              Attendance charter
            </h2>
            <p className="hidden text-sm leading-relaxed text-muted-foreground sm:block">
               Committed vs actual deployment with period-to-date attendance. Open any unit for its full muster roll.
            </p>
          </div>
        </div>

        <div className="px-3 py-3 sm:px-5 sm:py-5">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load attendance units right now."}
            </div>
          ) : (
            <AttendanceCharter
              units={filtered}
              monthIdx={monthIdx}
              year={year}
              query={q}
              onQueryChange={setQ}
              organizationCount={summary.organizations}
              windowsByUnit={windowsByUnit}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              filters={
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <LabeledMultiSelectFilter
                      label="Organization"
                      selected={orgFilter}
                      onChange={(v) => {
                        setOrgFilter(v);
                        setUnitFilter((prev) =>
                          prev.filter((id) => {
                            const u = windowUnits.find((x) => x.id === id);
                            return !u || v.length === 0 || v.includes(u.customer_id || u.customer_name);
                          }),
                        );
                        setStateFilter((prev) =>
                          prev.filter((s) =>
                            windowUnits.some(
                              (u) =>
                                stOf(u) === s &&
                                (v.length === 0 || v.includes(u.customer_id || u.customer_name)),
                            ),
                          ),
                        );
                      }}
                      options={organizations.map((o) => ({
                        value: o.id,
                        label: o.code ? `${o.code} · ${o.name}` : o.name,
                      }))}
                      allLabel={`All organizations (${organizations.length})`}
                    />
                    <LabeledMultiSelectFilter
                      label="State"
                      selected={stateFilter}
                      onChange={(v) => {
                        setStateFilter(v);
                        setUnitFilter((prev) =>
                          prev.filter((id) => {
                            const u = windowUnits.find((x) => x.id === id);
                            return !u || v.length === 0 || v.includes(stOf(u));
                          }),
                        );
                      }}
                      options={stateOptions.map((s) => ({ value: s, label: s }))}
                      allLabel={`All states (${stateOptions.length})`}
                    />
                    <LabeledMultiSelectFilter
                      label="Unit"
                      selected={unitFilter}
                      onChange={setUnitFilter}
                      options={unitOptions
                        .filter((u) => stateFilter.length === 0 || stateFilter.includes(stOf(u)))
                        .map((u) => ({
                          value: u.id,
                          label: `${u.name || u.code}${u.customer_name ? ` · ${u.customer_name}` : ""}`,
                        }))}
                      allLabel={`All units (${unitOptions.length})`}
                    />
                  </div>
                  {anyFilter && (
                    <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                      <span>
                        Filtered to <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
                         {windowUnits.length} units
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => {
                          setQ("");
                          setOrgFilter([]);
                          setUnitFilter([]);
                          setStateFilter([]);
                          setStatusFilter("all");
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Clear
                      </Button>
                    </div>
                  )}
                </div>
              }
            />

          )}
        </div>
      </div>
    </div>
  );
}
