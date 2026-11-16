import { useManagerFieldOfficerScope } from "@/lib/use-manager-scope";
import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin, Repeat, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { ROLE_KEYS } from "@/lib/role-keys";
import { useCurrentPermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/SearchSelect";
import { ScrollingText } from "@/components/ScrollingText";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { assignmentSearchEmployees, matchesMappingUnit, selectMatchingUnits, type MappingEmployee, type AssignmentKind, type AssignmentMode } from "@/lib/unit-assignment";
import { matchesSearch } from "@/lib/search-match";

const PAGE = 25;
const MODULE = "Field Officer Deployments";

type UnitRow = { id: string; code: string | null; name: string | null; customer_id: string | null; status: string | null; operations_manager_id: string | null };
type FoRow = MappingEmployee;
type LinkRow = { candidate_id: string; unit_id: string };

type Directory = {
  units: UnitRow[];
  customerName: Map<string, string>;
  fos: FoRow[];
  employees: FoRow[];
  peopleByUnit: Map<string, string[]>;
  foByUnit: Map<string, string[]>;
  unitsByFo: Map<string, string[]>;
};

async function loadDirectory(): Promise<Directory> {
  const [units, customers, employees] = await Promise.all([
    fetchAllPages<UnitRow>((from, to) =>
      supabase.from("units").select("id, code, name, customer_id, status, operations_manager_id").eq("status", "active").range(from, to).order("name"),
    ),
    fetchAllPages<{ id: string; name: string | null }>((from, to) =>
      supabase.from("customers").select("id, name").range(from, to),
    ),
    fetchAllPages<FoRow>((from, to) =>
      supabase
        .from("candidates")
        .select("id, full_name, employee_code, mobile, role_key, reports_to")
        .in("role_key", [ROLE_KEYS.FIELD_OFFICER, ROLE_KEYS.OPERATIONS_MANAGER, ROLE_KEYS.OPERATIONS, ROLE_KEYS.VP_OPERATIONS])
        .eq("is_enabled", true)
        .in("status", ["approved", "active"])
        .range(from, to)
        .order("full_name"),
    ),
  ]);

  const fos = employees.filter((e) => e.role_key === ROLE_KEYS.FIELD_OFFICER);
  const links = await fetchInChunks<LinkRow>(
    fos.map((f) => f.id),
    (chunk, from, to) =>
      supabase.from("candidate_units").select("candidate_id, unit_id").in("candidate_id", chunk).range(from, to),
  );

  const activeUnitIds = new Set(units.map((u) => u.id));
  const foByUnit = new Map<string, string[]>();
  const unitsByFo = new Map<string, string[]>();
  for (const l of links) {
    if (!activeUnitIds.has(l.unit_id)) continue;
    foByUnit.set(l.unit_id, [...(foByUnit.get(l.unit_id) ?? []), l.candidate_id]);
    unitsByFo.set(l.candidate_id, [...(unitsByFo.get(l.candidate_id) ?? []), l.unit_id]);
  }

  const customerName = new Map<string, string>();
  for (const c of customers) customerName.set(c.id, c.name ?? "");

  const scopes = await fetchInChunks<{ candidate_id: string; scope_id: string; scope_type: string }>(
    employees.map((e) => e.id), (chunk, from, to) => supabase.from("employee_scope_assignments")
      .select("candidate_id,scope_id,scope_type").in("candidate_id", chunk).in("scope_type", ["unit", "customer"]).order("id").range(from, to),
  );
  const peopleByUnit = new Map<string, string[]>();
  const officerIds = new Set(fos.map((f) => f.id));
  const scopeIndex = new Map<string, string[]>();
  for (const a of scopes) {
    const key = `${a.scope_type}:${a.scope_id}`;
    scopeIndex.set(key, [...(scopeIndex.get(key) ?? []), a.candidate_id]);
  }
  for (const u of units) {
    const scoped = [...(scopeIndex.get(`unit:${u.id}`) ?? []), ...(scopeIndex.get(`customer:${u.customer_id}`) ?? [])];
    const ids = [...new Set([...(foByUnit.get(u.id) ?? []), ...scoped, ...(u.operations_manager_id ? [u.operations_manager_id] : [])])];
    peopleByUnit.set(u.id, ids);
    foByUnit.set(u.id, ids.filter((id) => officerIds.has(id)));
  }
  unitsByFo.clear();
  for (const [unitId, ids] of peopleByUnit) for (const e of assignmentSearchEmployees(ids, employees)) unitsByFo.set(e.id, [...(unitsByFo.get(e.id) ?? []), unitId]);
  return { units, customerName, fos, employees, peopleByUnit, foByUnit, unitsByFo };
}

/**
 * Deployments — every client site with the field officer covering it, plus the
 * reverse view by officer. Sites with no officer are the red flag operations
 * cares about.
 */
export function OperationsDeployments({ teamOnly = false }: { teamOnly?: boolean } = {}) {
  const qc = useQueryClient();
  const hasSession = useHasSupabaseSession();
  const teamScope = useManagerFieldOfficerScope();
  const { isSuperAdmin, canSub } = useCurrentPermissions();
  // Mapping field officers to units needs edit rights on units — view-only
  // roles (e.g. Control Center staff) see the roster without switch controls.
  const canMap = isSuperAdmin || canSub("organizations", "unit_manager", "edit");
  const [view, setView] = useState<"unit" | "officer">("unit");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sourceEmployee, setSourceEmployee] = useState("");
  const [page, setPage] = useState(0);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [openFo, setOpenFo] = useState<string | null>(null);
  const [switchUnits, setSwitchUnits] = useState<UnitRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());


  const dirQ = useQuery({ queryKey: ["ops-deployments"], enabled: hasSession, staleTime: 2 * 60_000, queryFn: loadDirectory });
  // On a manager's dashboard, only the sites in their team's scope are listed.
  const dir = useMemo(() => {
    const d = dirQ.data;
    if (!d || !teamOnly || !teamScope.isScoped) return d;
    return { ...d, units: d.units.filter((u) => teamScope.unitIds.has(u.id)) };
  }, [dirQ.data, teamOnly, teamScope.isScoped, teamScope.unitIds]);

  const foName = (id: string) => {
    const f = dir?.employees.find((x) => x.id === id);
    return f ? `${f.full_name ?? "—"}${f.employee_code ? ` · ${f.employee_code}` : ""}` : "—";
  };
  const unitLabel = (u: UnitRow) =>
    [dir?.customerName.get(u.customer_id ?? "") || "", u.name || u.code || ""].filter(Boolean).join(" — ");

  const unitRows = useMemo(() => {
    if (!dir) return [] as UnitRow[];
    const term = deferredSearch.trim();
    return dir.units.filter((u) => {
      const assigned = (dir.foByUnit.get(u.id) ?? []).length > 0;
      if (onlyUnassigned && assigned) return false;
      const people = assignmentSearchEmployees(dir.peopleByUnit.get(u.id) ?? [], dir.employees);
      if (sourceEmployee && !people.some((e) => e.id === sourceEmployee)) return false;
      return matchesMappingUnit(term, u, dir.customerName.get(u.customer_id ?? "") ?? "", people);
    });
  }, [dir, deferredSearch, sourceEmployee, onlyUnassigned]);

  const officerRows = useMemo(() => {
    if (!dir) return [] as FoRow[];
    const term = deferredSearch.trim();
    return dir.employees.filter((f) =>
      (!sourceEmployee || sourceEmployee === f.id) && matchesSearch(term, [f.full_name, f.employee_code, f.mobile]),
    );
  }, [dir, deferredSearch, sourceEmployee]);

  const rowsLength = view === "unit" ? unitRows.length : officerRows.length;
  const pageCount = Math.max(1, Math.ceil(rowsLength / PAGE));
  const current = Math.min(page, pageCount - 1);
  const slice = <T,>(arr: T[]) => arr.slice(current * PAGE, current * PAGE + PAGE);

  const totalUnits = dir?.units.length ?? 0;
  const totalFos = dir?.fos.length ?? 0;
  const unassigned = useMemo(
    () => (dir ? dir.units.filter((u) => (dir.foByUnit.get(u.id) ?? []).length === 0).length : 0),
    [dir],
  );

  const switchMut = useMutation({
    mutationFn: async ({ units, foId, kind, mode }: { units: UnitRow[]; foId: string; kind: AssignmentKind; mode: AssignmentMode }) => {
      const { data, error } = await (supabase.rpc as unknown as (
        name: string, args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>)("bulk_assign_operational_units", {
        _unit_ids: units.map((u) => u.id), _candidate_id: foId, _kind: kind, _mode: mode,
      });
      if (error) throw new Error(error.message);
      if (data !== units.length) throw new Error("Not all selected sites were saved");
      void logActivity({ module: MODULE, action: "update", entityType: "unit", entityId: units[0]?.id ?? "",
        entityLabel: `${units.length} sites`, details: { mode, kind, to: foName(foId), sites: units.map((u) => ({ id: u.id, label: unitLabel(u) })) } });
    },
    onSuccess: async () => {
      toast.success("Unit assignments saved");
      setSwitchUnits(null);
      setSelected(new Set());
      await Promise.all(["ops-deployments", "manager-fo-scope", "fo-scope-assignments", "fo-candidate-units", "fo-units-lookup", "team-card-mates", "team-card-sites", "ops-org-tree", "unit-form", "operations-overview"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      void qc.invalidateQueries({ queryKey: ["admin", "employee_scope_assignments"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not reassign"),
  });

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });


  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="space-y-3 border-b border-border/50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Deployments
            </div>
            <h3 className="mt-0.5 font-display text-base font-bold tracking-tight text-foreground">
              {view === "unit" ? "By client site" : "By employee"}
            </h3>
          </div>
          <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5 text-[11px] font-semibold">
            {(["unit", "officer"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                onClick={() => { setView(v); setPage(0); }}
                className={
                  view === v
                    ? "rounded-md bg-foreground px-3 py-1 text-background"
                    : "rounded-md px-3 py-1 text-muted-foreground hover:text-foreground"
                }
              >
                {v === "unit" ? "By site" : "By employee"}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<MapPin className="h-3.5 w-3.5" />} tone="sky" label="Active sites" value={totalUnits} />
          <Stat icon={<Users className="h-3.5 w-3.5" />} tone="emerald" label="Field officers" value={totalFos} />
          <Button type="button" onClick={() => { setView("unit"); setOnlyUnassigned((v) => !v); setPage(0); }} className="text-left">
            <Stat
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              tone="rose"
              label={onlyUnassigned ? "Unassigned · filtered" : "Unassigned sites"}
              value={unassigned}
            />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            aria-label="Search unit mappings"
            placeholder={view === "unit" ? "Search employee, site, client or ID" : "Search employee name or ID"}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium" htmlFor="mapping-source">Sites assigned to</label>
          <SearchSelect id="mapping-source" ariaLabel="Filter by assigned employee" value={sourceEmployee}
            onChange={(id) => { setSourceEmployee(id); setPage(0); setSelected(new Set()); }}
            options={[{ value: "", label: "All employees" }, ...(dir?.employees ?? []).map((e) => ({ value: e.id, label: `${e.full_name ?? "—"} · ${e.employee_code ?? ""}`, hint: e.role_key?.replaceAll("_", " ") }))]}
            searchPlaceholder="Search employee name or ID" />
        </div>
      </header>

      {dirQ.isError ? <div role="alert" className="px-4 py-6 text-destructive">Could not load unit assignments. <Button variant="outline" size="sm" onClick={() => dirQ.refetch()}>Try again</Button></div> : dirQ.isLoading || (teamOnly && teamScope.isLoading) ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading deployments…</div>
      ) : view === "unit" ? (
        <ul className="divide-y divide-border/50">
          <li className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2 text-[11px] font-semibold text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-foreground"
                aria-label="Select all matching sites"
                checked={unitRows.length > 0 && unitRows.every((u) => selected.has(u.id))}
                onChange={(e) => {
                  setSelected((prev) => selectMatchingUnits(prev, unitRows.map((u) => u.id), e.target.checked));
                }}
              />
              Select all {unitRows.length} matching sites
            </label>
            <span className="flex items-center gap-2">
              {selected.size > 0 && <span>{selected.size} selected</span>}
              {canMap && selected.size > 0 && (
                <>
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() =>
                      setSwitchUnits((dir?.units ?? []).filter((u) => selected.has(u.id)))
                    }
                  >
                    <Repeat className="h-3 w-3" /> Assign / switch user
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </>
              )}
            </span>
          </li>
          {slice(unitRows).map((u) => {
            const officers = dir?.foByUnit.get(u.id) ?? [];
            return (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 accent-foreground"
                    aria-label={`Select ${u.code ?? u.name ?? "site"}`}
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelected(u.id)}
                  />
                  <div className="min-w-0">
                    <ScrollingText text={unitLabel(u)} className="text-[13px] font-semibold text-foreground" />
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {u.code ?? "—"} ·{" "}
                      {officers.length ? (
                        (dir?.peopleByUnit.get(u.id) ?? []).map(foName).join(", ")
                      ) : (
                        <span className="font-semibold text-rose-600 dark:text-rose-400">No field officer</span>
                      )}
                    </div>
                  </div>
                </div>
                {canMap && (
                  <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-[11px]" onClick={() => setSwitchUnits([u])}>
                    <Repeat className="h-3 w-3" /> Assign / switch
                  </Button>
                )}
              </li>
            );
          })}

          {unitRows.length === 0 && (
            <li className="px-4 py-8 text-center text-xs text-muted-foreground">No sites match.</li>
          )}
        </ul>
      ) : (
        <ul className="divide-y divide-border/50">
          {slice(officerRows).map((f) => {
            const units = (dir?.unitsByFo.get(f.id) ?? []).filter((id) => dir?.units.some((u) => u.id === id));
            const open = openFo === f.id;
            return (
              <li key={f.id} className="px-4 py-2.5">
                <Button
                  type="button"
                  onClick={() => setOpenFo(open ? null : f.id)}
                  variant="ghost" className="flex h-auto w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-foreground">{f.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{f.employee_code ?? "—"}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground">
                    {units.length} sites
                  </span>
                </Button>
                {open && (<>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => { setSourceEmployee(f.id); setSearch(""); setView("unit"); setPage(0); setSelected(new Set()); }}>View sites</Button>
                    {canMap && units.length > 0 && <Button size="sm" onClick={() => setSwitchUnits((dir?.units ?? []).filter((u) => units.includes(u.id)))}>Assign all {units.length} sites</Button>}
                  </div>
                  <ul className="mt-2 max-h-[260px] space-y-1 overflow-y-auto rounded-xl border border-border/50 bg-card/60 p-2">
                    {units.map((uid) => {
                      const u = dir?.units.find((x) => x.id === uid);
                      if (!u) return null;
                      return (
                        <li key={uid} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="truncate text-foreground">{unitLabel(u)}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{u.code ?? ""}</span>
                        </li>
                      );
                    })}
                    {units.length === 0 && (
                      <li className="py-3 text-center text-[11px] text-muted-foreground">No sites mapped yet.</li>
                    )}
                  </ul>
                </>)}
              </li>
            );
          })}
          {officerRows.length === 0 && (
            <li className="px-4 py-8 text-center text-xs text-muted-foreground">No employees match.</li>
          )}
        </ul>
      )}

      <footer className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
        <span>
          {rowsLength === 0
            ? "0 of 0"
            : `${current * PAGE + 1}–${Math.min(rowsLength, current * PAGE + PAGE)} of ${rowsLength}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span>
            {current + 1} / {pageCount}
          </span>
          <Button
            type="button"
            disabled={current + 1 >= pageCount}
            onClick={() => setPage(current + 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </footer>

      <SwitchOfficerDialog
        key={switchUnits?.map((u) => u.id).join(",") ?? "closed"}
        units={switchUnits}
        unitLabel={
          switchUnits && switchUnits.length === 1
            ? unitLabel(switchUnits[0])
            : `${switchUnits?.length ?? 0} sites selected`
        }
        current={
          switchUnits && switchUnits.length === 1
            ? (dir?.foByUnit.get(switchUnits[0].id) ?? []).map(foName)
            : []
        }
        fos={dir?.employees ?? []}
        saving={switchMut.isPending}
        onClose={() => setSwitchUnits(null)}
        onSave={(foId, kind, mode) => switchUnits && switchMut.mutate({ units: switchUnits, foId, kind, mode })}
      />

    </section>
  );
}

function SwitchOfficerDialog({
  units, unitLabel, current, fos, saving, onClose, onSave,
}: {
  units: UnitRow[] | null;

  unitLabel: string;
  current: string[];
  fos: FoRow[];
  saving: boolean;
  onClose: () => void;
  onSave: (foId: string, kind: AssignmentKind, mode: AssignmentMode) => void;
}) {
  const [kind, setKind] = useState<AssignmentKind>("field_officer");
  const [mode, setMode] = useState<AssignmentMode>("add");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const list = useMemo(() => {
    const t = term.trim();
    const filtered = fos.filter((f) => f.role_key === kind && matchesSearch(t, [f.full_name, f.employee_code, f.mobile]));
    return filtered.slice(0, 60);
  }, [fos, term, kind]);

  return (
    <Dialog open={!!units?.length} onOpenChange={(o) => { if (!o) { setTerm(""); setPicked(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign selected sites</DialogTitle>
          <DialogDescription>
            {unitLabel}
            {current.length ? ` · currently ${current.join(", ")}` : " · currently unassigned"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Assignment type">
            {(["field_officer", "operations_manager"] as const).map((value) => <Button key={value} size="sm" variant={kind === value ? "default" : "outline"} onClick={() => { setKind(value); setPicked(null); }}>{value === "field_officer" ? "Field officer" : "Operations manager"}</Button>)}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Assignment mode">
            <Button size="sm" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}>Add alongside existing</Button>
            <Button size="sm" variant={mode === "replace" ? "default" : "outline"} onClick={() => setMode("replace")}>Replace existing</Button>
          </div>
          <p className="text-xs text-muted-foreground">{mode === "replace" ? "Replace direct site assignments of the chosen type only. Organization access, reporting relationships, other managers and payroll homes stay unchanged." : "Keep existing assignments and add the selected employee."}</p>
        </div>
        <Input
          aria-label="Search target employee"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search employee name, ID or phone"
          className="h-9 text-sm"
        />
        <ul className="max-h-[280px] divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60">
          {list.map((f) => (
            <li key={f.id}>
              <Button
                type="button"
                onClick={() => setPicked(f.id)}
                variant="ghost" className={
                  "flex h-auto w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] " +
                  (picked === f.id ? "bg-foreground text-background" : "hover:bg-muted")
                }
              >
                <span className="truncate">{f.full_name ?? "—"}</span>
                <span className="shrink-0 text-[11px] opacity-70">{f.employee_code ?? ""}</span>
              </Button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">No eligible employees found.</li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={!picked || saving} onClick={() => picked && onSave(picked, kind, mode)}>
            {saving
              ? "Saving…"
              : (units?.length ?? 0) > 1
              ? `Assign to ${units?.length} sites`
              : "Assign to this site"}
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "emerald" | "sky" | "rose";
}) {
  const toneCls = {
    emerald: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400",
    sky: "text-sky-700 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400",
    rose: "text-rose-700 bg-rose-500/10 ring-rose-500/20 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
      <div className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 " + toneCls}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-black leading-none tracking-tight text-foreground">{value}</div>
    </div>
  );
}
