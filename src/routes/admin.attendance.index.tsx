import { createFileRoute, Link } from "@tanstack/react-router";
import { type ComponentType, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  IndianRupee,
  MapPinned,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCurrentPermissions } from "@/lib/rbac";
import { fetchAllPages } from "@/lib/supabase-batch";
import { logActivity } from "@/lib/activity-log";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthRange(year: number, monthIdx: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(monthIdx + 1)}-01`;
  const last = new Date(year, monthIdx + 1, 0).getDate();
  const end = `${year}-${pad(monthIdx + 1)}-${pad(last)}`;
  return { start, end };
}

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m + 1)}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad(m + 1)}-${pad(last)}`;
  return { start, end };
}

import { HeroTile } from "@/components/HeroTile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { classifyAttendanceEmployee, isNonBillableRoleKey, matchesAttendanceScope, type AttendanceScopeAssignment, type AttendanceUnitContext } from "@/lib/attendance";
import { supabase } from "@/integrations/supabase/client";
import { useFieldOfficerUnitScope } from "@/lib/use-fo-unit-scope";
import { ListSkeleton } from "@/components/Skeletons";
import { AttendanceCharter } from "@/components/AttendanceCharter";


export const Route = createFileRoute("/admin/attendance/")({
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
  contract_codes: string[];
  contract_end: string | null;
  active_employee_count: number;
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

function AttendanceUnitsPage() {
  const now = new Date();
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [monthIdx, setMonthIdx] = useState<number>(now.getMonth());
  const [year, setYear] = useState<number>(now.getFullYear());




  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance-dashboard-v10"],
    queryFn: async (): Promise<AttendancePageData> => {
      type RawUnitRow = {
        id: string;
        code: string;
        name: string;
        location: string | null;
        branch_id: string | null;
        customer_id: string | null;
        billing_state: string | null;
      };
      type PrimaryCandidateRow = {
        id: string;
        full_name: string;
        designation_id: string | null;
        role_key: string | null;
        unit_id: string | null;
        non_billable: boolean | null;
      };

      // One paginated read per table, all issued in parallel and joined in
      // memory. Filtering by hundreds of client ids meant dozens of sequential
      // round trips, which is what made this page slow to appear.
      const [
        contracts,
        allUnits,
        allCandidates,
        candidateLinks,
        scopeAssignmentRows,
        allDesignations,
        allCustomers,
      ] = await Promise.all([
        fetchAllPages<{ unit_id: string | null; contract_code: string | null; end_date: string | null }>(
          (from, to) =>
            supabase
              .from("client_contracts")
              .select("unit_id, contract_code, end_date")
              .eq("status", "active")
              .order("unit_id", { ascending: true })
              .range(from, to),
        ),
        fetchAllPages<RawUnitRow>((from, to) =>
          supabase
            .from("clients")
            .select("id, code, name, location, branch_id, customer_id, billing_state")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<PrimaryCandidateRow>((from, to) =>
          supabase
            .from("candidates")
            .select("id, full_name, designation_id, role_key, unit_id, non_billable")
            .eq("is_enabled", true)
            .in("status", [...ACTIVE_EMPLOYEE_STATUSES])
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<{ candidate_id: string; unit_id: string }>((from, to) =>
          supabase
            .from("candidate_units")
            .select("candidate_id, unit_id")
            .order("candidate_id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<AttendanceScopeAssignment>((from, to) =>
          supabase
            .from("employee_scope_assignments")
            .select("candidate_id, scope_type, scope_id")
            .range(from, to),
        ),
        fetchAllPages<{ id: string; name: string }>((from, to) =>
          supabase.from("designations").select("id, name").order("id", { ascending: true }).range(from, to),
        ),
        fetchAllPages<{ id: string; name: string; code: string | null }>((from, to) =>
          supabase.from("customers").select("id, name, code").order("id", { ascending: true }).range(from, to),
        ),
      ]);

      const contractsByUnit = new Map<string, { codes: string[]; end: string | null }>();
      for (const c of contracts) {
        if (!c.unit_id) continue;
        const cur = contractsByUnit.get(c.unit_id) ?? { codes: [], end: null };
        if (c.contract_code) cur.codes.push(c.contract_code);
        if (!cur.end || (c.end_date && c.end_date > cur.end)) cur.end = c.end_date;
        contractsByUnit.set(c.unit_id, cur);
      }

      // Clients with an active contract, plus clients that only have people mapped
      // to them (primary or reliever) so they still show on attendance.
      const unitIdSet = new Set<string>(contractsByUnit.keys());
      for (const row of allCandidates) {
        if (row.unit_id) unitIdSet.add(row.unit_id);
      }
      for (const row of candidateLinks) {
        if (row.unit_id) unitIdSet.add(row.unit_id);
      }

      const unitIds = Array.from(unitIdSet);
      if (unitIds.length === 0) {
        return {
          clients: [],
          organizations: [],
          employeesByCustomer: {},
          summary: { organizations: 0, clients: 0, activeEmployees: 0 },
        };
      }

      const clients = allUnits.filter((u) => unitIdSet.has(u.id));
      const unitsById = new Map(clients.map((client) => [client.id, client]));

      const billableCandidates = allCandidates.filter((c) => c.non_billable !== true);
      const candidatesById = new Map(billableCandidates.map((c) => [c.id, c]));
      const primaryCandidates = billableCandidates.filter((c) => c.unit_id && unitIdSet.has(c.unit_id));
      const secondaryMap = candidatesById;

      const unitContexts: AttendanceUnitContext[] = clients.map((client) => ({
        id: client.id,
        branch_id: client.branch_id,
        customer_id: client.customer_id,
        billing_state: client.billing_state,
      }));
      const scopeUnitsByAssignment = new Map<AttendanceScopeAssignment, string[]>();
      for (const assignment of scopeAssignmentRows) {
        if (!candidatesById.has(assignment.candidate_id)) continue;
        const matched = unitContexts
          .filter((context) => matchesAttendanceScope(context, assignment))
          .map((context) => context.id);
        if (matched.length) scopeUnitsByAssignment.set(assignment, matched);
      }

      const dMap = new Map(allDesignations.map((d) => [d.id, d.name as string]));
      const customerMap = new Map(
        allCustomers.map((c) => [c.id, { name: c.name as string, code: (c.code as string) || "" }]),
      );

      type UnitAcc = {
        employees: Map<string, { name: string; designation: string; roleKey: string | null }>;
      };
      const acc = new Map<string, UnitAcc>();
      const ensure = (unitId: string) => {
        if (!acc.has(unitId)) acc.set(unitId, { employees: new Map() });
        return acc.get(unitId)!;
      };

      for (const c of primaryCandidates) {
        if (!c.unit_id) continue;
        ensure(c.unit_id).employees.set(c.id, {
          name: c.full_name || "—",
          designation: (c.designation_id && dMap.get(c.designation_id)) || "",
          roleKey: c.role_key || null,
        });
      }
      for (const link of candidateLinks) {
        const cand = secondaryMap.get(link.candidate_id);
        if (!cand) continue;
        ensure(link.unit_id).employees.set(cand.id, {
          name: cand.full_name || "—",
          designation: (cand.designation_id && dMap.get(cand.designation_id)) || "",
          roleKey: cand.role_key || null,
        });
      }
      for (const [assignment, matchedUnitIds] of scopeUnitsByAssignment) {
        const cand = secondaryMap.get(assignment.candidate_id);
        if (!cand) continue;
        for (const unitId of matchedUnitIds) {
          ensure(unitId).employees.set(cand.id, {
            name: cand.full_name || "—",
            designation: (cand.designation_id && dMap.get(cand.designation_id)) || "",
            roleKey: cand.role_key || null,
          });
        }
      }


      const rows: UnitRow[] = (clients ?? [])
        .map((u) => {
          const a = acc.get(u.id);
          const employees = a ? Array.from(a.employees.entries()) : [];
          const sgs: EmployeeRef[] = [];
          for (const [id, info] of employees) {
            if (isNonBillableRoleKey(info.roleKey)) continue;
            sgs.push({ id, name: info.name });
          }

          return {
            id: u.id,
            code: u.code,
            name: u.name,
            location: u.location || "",
            branch_id: u.branch_id || null,
            customer_id: u.customer_id || "",
            customer_name: (u.customer_id && customerMap.get(u.customer_id)?.name) || "—",
            customer_code: (u.customer_id && customerMap.get(u.customer_id)?.code) || "",
            billing_state: u.billing_state || null,
            contract_codes: contractsByUnit.get(u.id)?.codes ?? [],
            contract_end: contractsByUnit.get(u.id)?.end ?? null,
            active_employee_count: sgs.length,
            security_guards: sgs.sort((a, b) => a.name.localeCompare(b.name)),
          };
        })
        .sort((a, b) =>
          a.customer_name !== b.customer_name
            ? a.customer_name.localeCompare(b.customer_name)
            : (a.name || a.code).localeCompare(b.name || b.code),
        );

      const orgs = Array.from(
        new Map(
          rows.map((r) => [
            r.customer_id || r.customer_name,
            { id: r.customer_id || r.customer_name, name: r.customer_name, code: r.customer_code },
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name));

      const employeesByCustomer: Record<string, ClientEmployee[]> = {};
      for (const r of rows) {
        for (const sg of r.security_guards) {
          const key = r.customer_id || r.customer_name;
          if (!employeesByCustomer[key]) employeesByCustomer[key] = [];
          // de-dupe per client (employee may appear in multiple clients rarely)
          if (!employeesByCustomer[key].some((e) => e.id === sg.id && e.unit_id === r.id)) {
            employeesByCustomer[key].push({
              id: sg.id,
              name: sg.name,
              designation: "",
              unit_id: r.id,
              unit_name: r.name || r.code,
              unit_code: r.code,
            });
          }
        }
      }
      for (const key of Object.keys(employeesByCustomer)) {
        employeesByCustomer[key].sort((a, b) => a.name.localeCompare(b.name));
      }

      return {
        clients: rows,
        organizations: orgs,
        employeesByCustomer,
        summary: {
          organizations: orgs.length,
          clients: rows.length,
          activeEmployees: rows.reduce((s, r) => s + r.active_employee_count, 0),
        },
      };

    },
  });

  const foScope = useFieldOfficerUnitScope();
  const rawUnits = data?.clients ?? [];
  const clients = useMemo(
    () => (foScope.isFieldOfficer ? rawUnits.filter((u) => foScope.unitIds.has(u.id)) : rawUnits),
    [rawUnits, foScope.isFieldOfficer, foScope.unitIds],
  );
  const organizations = useMemo(() => {
    const all = data?.organizations ?? [];
    if (!foScope.isFieldOfficer) return all;
    const allowed = new Set(clients.map((u) => u.customer_id));
    return all.filter((o) => allowed.has(o.id));
  }, [data?.organizations, foScope.isFieldOfficer, clients]);
  const employeesByCustomer = useMemo(() => {
    const src = data?.employeesByCustomer ?? {};
    if (!foScope.isFieldOfficer) return src;
    const out: Record<string, typeof src[string]> = {};
    for (const [cid, emps] of Object.entries(src)) {
      const filtered = emps.filter((e) => foScope.unitIds.has(e.unit_id));
      if (filtered.length) out[cid] = filtered;
    }
    return out;
  }, [data?.employeesByCustomer, foScope.isFieldOfficer, foScope.unitIds]);
  const summary = useMemo(
    () => (foScope.isFieldOfficer
      ? { organizations: organizations.length, clients: clients.length, activeEmployees: clients.reduce((s, r) => s + r.active_employee_count, 0) }
      : data?.summary ?? { organizations: 0, clients: 0, activeEmployees: 0 }),
    [foScope.isFieldOfficer, organizations, clients, data?.summary],
  );

  const queryClient = useQueryClient();
  const { can } = useCurrentPermissions();
  const canApprove = can("attendance", "approve");

  type SheetStatus = "draft" | "submitted" | "approved" | "rejected";
  type SheetInfo = { id: string; unit_id: string; status: SheetStatus; period_start: string; period_end: string };
  const { start: monthStartISO, end: monthEndISO } = monthRange(year, monthIdx);
  const sheetsQK = ["attendance-sheets-index", monthStartISO, monthEndISO] as const;
  const { data: sheetsByUnit } = useQuery({
    queryKey: sheetsQK,
    queryFn: async (): Promise<Map<string, SheetInfo>> => {
      const { data: rows, error: e } = await supabase
        .from("attendance_sheets" as never)
        .select("id, unit_id, status, period_start, period_end")
        .lte("period_start", monthEndISO)
        .gte("period_end", monthStartISO);
      if (e) throw e;
      const map = new Map<string, SheetInfo>();
      for (const r of ((rows ?? []) as unknown as SheetInfo[])) {
        const existing = map.get(r.unit_id);
        if (!existing || r.period_start > existing.period_start) map.set(r.unit_id, r);
      }
      return map;
    },
  });

  const reopenSheet = useMutation({
    mutationFn: async (sheet: SheetInfo) => {
      const { error } = await supabase
        .from("attendance_sheets" as never)
        .update({ status: "draft", rejection_reason: "" } as never)
        .eq("id", sheet.id);
      if (error) throw error;
      void logActivity({
        module: "Attendance",
        action: "reopen",
        entityType: "attendance_sheets",
        entityLabel: `${sheet.unit_id} ${sheet.period_start} → ${sheet.period_end}`,
        details: { unit_id: sheet.unit_id, period_start: sheet.period_start, period_end: sheet.period_end, status: "draft" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sheetsQK });
      toast.success("Reopened for editing");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to reopen"),
  });





  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients.filter((u) => {
      if (orgFilter !== "all" && (u.customer_id || u.customer_name) !== orgFilter) return false;
      if (unitFilter !== "all" && u.id !== unitFilter) return false;
      if (term) {
        const hay = [
          u.customer_name,
          u.customer_code,
          u.name,
          u.code,
          u.location,
          ...u.contract_codes,
          ...u.security_guards.map((g) => g.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [q, orgFilter, unitFilter, clients]);

  const anyFilter = orgFilter !== "all" || unitFilter !== "all" || q.trim().length > 0;



  return (
    <div className="space-y-4 sm:space-y-6">
      <HeroTile
        eyebrow="Attendance month"
        title={MONTH_NAMES[monthIdx]}
        subtitle={String(year)}
        description="Browse clients with active contracts and drill into the monthly muster roll. Only billable employees appear — non-billable staff are on Radiant's own payroll."
        right={
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/70 bg-background/60 p-1.5 backdrop-blur">
            <Select value={String(monthIdx)} onValueChange={(v) => setMonthIdx(Number(v))}>
              <SelectTrigger className="h-8 w-[130px] rounded-xl border-0 bg-transparent shadow-none hover:bg-muted focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-5 w-px bg-border/70" />
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-[92px] rounded-xl border-0 bg-transparent shadow-none hover:bg-muted focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[year - 2, year - 1, year, year + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />


      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs">
          <Link to="/admin/attendance/employee">
            <Search className="h-3.5 w-3.5" /> Employee lookup
          </Link>
        </Button>
      </div>



      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm shadow-stone-200/40 dark:shadow-black/20">
        <div className="space-y-3 border-b border-border/60 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
              Attendance charter
            </h2>
            <p className="text-[12px] leading-relaxed text-muted-foreground sm:text-sm">
              Committed vs actual deployment with month-till-date attendance. Open any client for its full muster roll.
            </p>
          </div>


          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FilterSelect
              label="Client"
              value={orgFilter}
              onChange={setOrgFilter}
              options={organizations.map((o) => ({
                value: o.id,
                label: o.code ? `${o.code} · ${o.name}` : o.name,
              }))}
              allLabel={`All clients (${organizations.length})`}
            />
            <FilterSelect
              label="Unit"
              value={unitFilter}
              onChange={setUnitFilter}
              options={clients.map((u) => ({
                value: u.id,
                label: `${u.name || u.code}${u.customer_name ? ` · ${u.customer_name}` : ""}`,
              }))}
              allLabel={`All clients (${clients.length})`}
            />
          </div>


          {anyFilter && (
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Showing <span className="font-bold text-foreground">{filtered.length}</span> of {clients.length} clients
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setQ("");
                  setOrgFilter("all");
                  setUnitFilter("all");
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          )}

        </div>





        <div className="px-4 py-4 sm:px-5 sm:py-5">
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load attendance units right now."}
            </div>
          ) : (
            <AttendanceCharter
              clients={filtered}
              monthIdx={monthIdx}
              year={year}
              query={q}
              onQueryChange={setQ}
              organizationCount={summary.organizations}
              activeEmployees={summary.activeEmployees}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
