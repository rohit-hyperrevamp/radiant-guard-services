import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logActivity } from "@/lib/activity-log";
import {
  PERMISSION_ACTIONS,
  RBAC_MODULES,
  moduleSupportsApprove,
  type ModuleDef,
  type PermissionAction,
} from "@/lib/rbac-modules";
import {
  EMPTY_PERM,
  fetchOverrides,
  fetchRolePermissions,
  fetchRoles,
  saveOverrides,
  normalizePerm,
  permKey,
  saveRolePermissions,
  type PermKey,
  type PermissionRow,
  type RoleRow,
} from "@/lib/rbac";

export const Route = createFileRoute("/admin/rbac")({
  head: () => ({
    meta: [
      { title: "Access Control | Radiant Guard Services" },
      { name: "description", content: "Manage role permissions across application modules." },
      { property: "og:title", content: "Access Control | Radiant Guard Services" },
      { property: "og:description", content: "Manage role permissions across application modules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RBACPage,
});

type PermState = {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
};
type PermMap = Map<PermKey, PermState>;

const ACTION_META: Record<
  PermissionAction,
  { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  view: { label: "View", icon: Eye, tint: "text-sky-500" },
  edit: { label: "Edit", icon: Pencil, tint: "text-amber-500" },
  delete: { label: "Delete", icon: Trash2, tint: "text-rose-500" },
  approve: { label: "Approve", icon: CheckCircle2, tint: "text-emerald-500" },
};

function permFlag(p: PermState, a: PermissionAction): boolean {
  if (a === "view") return p.can_view;
  if (a === "edit") return p.can_edit;
  if (a === "delete") return p.can_delete;
  return p.can_approve;
}

function buildMap(rows: PermissionRow[]): PermMap {
  const m: PermMap = new Map();
  for (const r of rows) {
    m.set(permKey(r.module_key, r.sub_module_key ?? ""), {
      can_view: r.can_view,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
      can_approve: r.can_approve,
    });
  }
  return m;
}

function mapToRows(map: PermMap): PermissionRow[] {
  const out: PermissionRow[] = [];
  map.forEach((perm, key) => {
    const [module_key, sub_module_key] = key.split("::");
    if (!perm.can_view && !perm.can_edit && !perm.can_delete && !perm.can_approve) return;
    out.push({
      role_key: "",
      module_key,
      sub_module_key,
      ...perm,
    });
  });
  return out;
}

function getCell(map: PermMap, moduleKey: string, sub: string): PermState {
  return map.get(permKey(moduleKey, sub)) ?? { ...EMPTY_PERM };
}

function setCell(map: PermMap, moduleKey: string, sub: string, perm: PermState): PermMap {
  const next = new Map(map);
  next.set(permKey(moduleKey, sub), normalizePerm(perm));
  return next;
}

/** Tri-state for a parent column based on sub-modules. */
type Tri = "none" | "some" | "all";
function aggregate(
  map: PermMap,
  mod: ModuleDef,
  action: PermissionAction,
): Tri {
  if (action === "approve" && !moduleSupportsApprove(mod.key)) return "none";
  if (mod.subModules.length === 0) {
    return permFlag(getCell(map, mod.key, ""), action) ? "all" : "none";
  }
  let on = 0;
  for (const s of mod.subModules) {
    if (permFlag(getCell(map, mod.key, s.key), action)) on++;
  }
  if (on === 0) return "none";
  if (on === mod.subModules.length) return "all";
  return "some";
}

function setParent(
  map: PermMap,
  mod: ModuleDef,
  action: PermissionAction,
  on: boolean,
): PermMap {
  if (action === "approve" && !moduleSupportsApprove(mod.key)) return map;
  let next = map;
  if (mod.subModules.length === 0) {
    const cur = getCell(next, mod.key, "");
    next = setCell(next, mod.key, "", { ...cur, [`can_${action}`]: on });
    return next;
  }
  for (const s of mod.subModules) {
    const cur = getCell(next, mod.key, s.key);
    next = setCell(next, mod.key, s.key, { ...cur, [`can_${action}`]: on });
  }
  // Also stamp parent row for aggregate quick-checks
  const curP = getCell(next, mod.key, "");
  next = setCell(next, mod.key, "", { ...curP, [`can_${action}`]: on });
  return next;
}

function grantAll(map: PermMap, mod: ModuleDef): PermMap {
  let next = map;
  const full: PermState = {
    can_view: true,
    can_edit: true,
    can_delete: true,
    can_approve: moduleSupportsApprove(mod.key),
  };
  if (mod.subModules.length === 0) {
    next = setCell(next, mod.key, "", full);
    return next;
  }
  for (const s of mod.subModules) {
    next = setCell(next, mod.key, s.key, full);
  }
  next = setCell(next, mod.key, "", full);
  return next;
}

function clearAll(map: PermMap, mod: ModuleDef): PermMap {
  let next = map;
  const none = { ...EMPTY_PERM };
  if (mod.subModules.length === 0) {
    next = setCell(next, mod.key, "", none);
    return next;
  }
  for (const s of mod.subModules) {
    next = setCell(next, mod.key, s.key, none);
  }
  next = setCell(next, mod.key, "", none);
  return next;
}

function mapsEqual(a: PermMap, b: PermMap): boolean {
  if (a.size !== b.size) {
    // size mismatch only matters if either side has any "true" not present in the other
  }
  const allKeys = new Set<PermKey>([...a.keys(), ...b.keys()]);
  for (const k of allKeys) {
    const x = a.get(k) ?? EMPTY_PERM;
    const y = b.get(k) ?? EMPTY_PERM;
    if (
      x.can_view !== y.can_view ||
      x.can_edit !== y.can_edit ||
      x.can_delete !== y.can_delete ||
      x.can_approve !== y.can_approve
    ) {
      return false;
    }
  }
  return true;
}

function RBACPage() {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState<string>("guard");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    RBAC_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: m.subModules.length > 0 }), {}),
  );
  const [draft, setDraft] = useState<PermMap>(new Map());

  const [mode, setMode] = useState<"role" | "department">("role");
  const [activeDept, setActiveDept] = useState<string>("");
  const [applyTo, setApplyTo] = useState<"department" | "employee">("department");
  const [activeEmp, setActiveEmp] = useState<{ id: string; label: string } | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const rolesQuery = useQuery({ queryKey: ["rbac", "roles"], queryFn: fetchRoles });
  const deptQuery = useQuery({
    queryKey: ["rbac", "departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id,name").eq("enabled", true).order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const depts = deptQuery.data ?? [];
  const deptId = activeDept || depts[0]?.id || "";
  const deptName = depts.find((d) => d.id === deptId)?.name ?? "";

  const empQuery = useQuery({
    queryKey: ["rbac", "dept-employees", deptId, empSearch.trim()],
    enabled: mode === "department" && applyTo === "employee" && !!deptId,
    queryFn: async () => {
      let q = supabase
        .from("candidates")
        .select("id,full_name,employee_code")
        .eq("department_id", deptId)
        .order("full_name")
        .range(0, 49);
      const term = empSearch.trim().replace(/[,%()]/g, "");
      if (term) q = q.or(`full_name.ilike.%${term}%,employee_code.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; employee_code: string | null }[];
    },
  });

  const target: { scope: "role" | "department" | "employee"; id: string } =
    mode === "role"
      ? { scope: "role", id: activeRole }
      : applyTo === "employee"
        ? { scope: "employee", id: activeEmp?.id ?? "" }
        : { scope: "department", id: deptId };

  const permsQuery = useQuery({
    queryKey: ["rbac", "perms", target.scope, target.id],
    queryFn: () =>
      target.scope === "role" ? fetchRolePermissions(target.id) : fetchOverrides(target.scope, target.id),
    enabled: !!target.id,
  });

  const serverMap = useMemo(
    () => buildMap(permsQuery.data ?? []),
    [permsQuery.data],
  );

  useEffect(() => {
    setDraft(serverMap);
  }, [serverMap]);

  const isSuper = mode === "role" && activeRole === "super_admin";
  const noTarget = !target.id;
  const dirty = !isSuper && !mapsEqual(draft, serverMap);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (target.scope === "role") await saveRolePermissions(target.id, mapToRows(draft));
      else await saveOverrides(target.scope, target.id, mapToRows(draft));
    },
    onSuccess: async () => {
      const role = rolesQuery.data?.find((r) => r.key === activeRole);
      const label =
        target.scope === "role" ? role?.name ?? activeRole
        : target.scope === "department" ? `${deptName} department`
        : `${activeEmp?.label ?? ""} (${deptName})`;
      void logActivity({
        module: "Role-Based Access Control",
        action: "update",
        entityType: target.scope,
        entityId: target.id,
        entityLabel: label,
      });
      toast.success("Permissions saved", { description: label });
      await queryClient.invalidateQueries({ queryKey: ["rbac", "perms", target.scope, target.id] });
    },
    onError: (e) => {
      toast.error("Failed to save permissions", {
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const roles: RoleRow[] = rolesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Role-Based Access Control"
        description="Pick a role and grant View, Edit, or Delete on every module and sub-module."
        crumbs={[
          { label: "Control Center", to: "/admin/control-center" },
          { label: "Role-Based Access Control" },
        ]}
      />

      <div className="mb-3 inline-flex rounded-lg border border-border bg-card p-1">
        {(["role", "department"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "role" ? "Roles" : "Departments"}
          </button>
        ))}
      </div>

      {mode === "department" && (
        <div className="mb-4 space-y-3">
          <div className="scrollbar-hide -mx-2 flex flex-nowrap items-center gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {depts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setActiveDept(d.id);
                  setActiveEmp(null);
                  setEmpSearch("");
                }}
                className={cn(
                  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                  d.id === deptId
                    ? "border-accent bg-accent/15 text-accent shadow-sm"
                    : "border-border bg-card text-foreground/75 hover:border-accent/40 hover:text-foreground",
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <Select
              value={applyTo}
              onValueChange={(v) => {
                setApplyTo(v as "department" | "employee");
                setActiveEmp(null);
              }}
            >
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Entire department</SelectItem>
                <SelectItem value="employee">Specific employee</SelectItem>
              </SelectContent>
            </Select>
            {applyTo === "employee" ? (
              <div className="space-y-2">
                <Input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder={`Search ${deptName} employees by name or ID…`}
                  className="h-10"
                />
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  {(empQuery.data ?? []).map((e) => {
                    const label = `${e.full_name ?? "Unnamed"}${e.employee_code ? ` · ${e.employee_code}` : ""}`;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setActiveEmp({ id: e.id, label })}
                        className={cn(
                          "block w-full border-b border-border/50 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/40",
                          activeEmp?.id === e.id && "bg-accent/10 font-semibold text-accent",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {empQuery.data && empQuery.data.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">No employees in {deptName} match.</div>
                  )}
                </div>
              </div>
            ) : (
              <p className="self-center text-xs text-muted-foreground">
                Changes apply to everyone in {deptName || "this department"} (unless an employee has personal access set).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Role chip selector */}
      {mode === "role" && (
      <div className="scrollbar-hide -mx-2 mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:mb-5 sm:flex-wrap sm:overflow-visible sm:px-0">
        {roles.map((r) => {
          const active = r.key === activeRole;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveRole(r.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "border-accent bg-accent/15 text-accent shadow-sm"
                  : "border-border bg-card text-foreground/75 hover:border-accent/40 hover:text-foreground",
              )}
            >
              {r.is_system && <ShieldCheck className="h-3.5 w-3.5" />}
              {r.name}
            </button>
          );
        })}
      </div>
      )}

      {/* Active role banner */}
       <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:rounded-2xl sm:p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              isSuper ? "bg-accent/20 text-accent" : "bg-secondary text-foreground",
            )}
          >
            {isSuper ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-display text-base font-bold tracking-tight">
              {mode === "role"
                ? roles.find((r) => r.key === activeRole)?.name ?? activeRole
                : applyTo === "employee"
                  ? activeEmp?.label ?? "Pick an employee"
                  : `${deptName} department`}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "department"
                ? noTarget
                  ? "Search and pick an employee above."
                  : (permsQuery.data?.length ?? 0) === 0
                    ? "Nothing saved yet — they currently use their role's access. Saving here replaces it."
                    : applyTo === "employee"
                      ? "Personal access — overrides department and role access."
                      : "Department access — overrides role access for every member."
                : isSuper
                ? "Super Admin always has full access. This role is locked."
                : roles.find((r) => r.key === activeRole)?.description || "Configure permissions below."}
            </p>
          </div>
        </div>

        <div className="scrollbar-hide -mx-1 flex max-w-[calc(100%+0.5rem)] items-center gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          {!isSuper && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft(() => {
                    let next: PermMap = new Map();
                    for (const m of RBAC_MODULES) next = grantAll(next, m);
                    return next;
                  })
                }
                className="h-9"
                title="Grant View, Edit and Delete on every module and sub-module"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Grant full access
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(new Map())}
                className="h-9"
                title="Remove every permission for this role"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Revoke all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(serverMap)}
                disabled={!dirty || saveMutation.isPending}
                className="h-9"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reset
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={async () => {
              saveMutation.mutate();
            }}
            disabled={(!dirty && !(mode === "department" && (permsQuery.data?.length ?? 0) === 0 && draft.size > 0)) || saveMutation.isPending || isSuper || noTarget}
            className="h-9 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card sm:rounded-2xl">
        {/* Header row */}
        <div className="hidden min-w-[590px] grid-cols-[minmax(0,1fr)_repeat(4,72px)] items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(4,96px)] sm:px-4 sm:py-3">
          <div>Module</div>
          {PERMISSION_ACTIONS.map((a) => {
            const Icon = ACTION_META[a].icon;
            return (
              <div key={a} className="flex items-center justify-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", ACTION_META[a].tint)} />
                {ACTION_META[a].label}
              </div>
            );
          })}
        </div>

        <div className="divide-y divide-border">
          {RBAC_MODULES.map((mod) => {
            const open = expanded[mod.key];
            const ParentIcon = mod.icon;
            const hasChildren = mod.subModules.length > 0;
            const supportsApprove = moduleSupportsApprove(mod.key);

            return (
              <div key={mod.key}>
                {/* Parent row */}
                <div className="grid grid-cols-4 items-center gap-2 px-3 py-3 hover:bg-secondary/30 sm:min-w-[590px] sm:grid-cols-[minmax(0,1fr)_repeat(4,96px)] sm:py-3 sm:px-4">
                  <div className="col-span-4 flex min-w-0 items-center gap-2 sm:col-span-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [mod.key]: !open }))}
                        className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label={open ? "Collapse" : "Expand"}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-6" />
                    )}
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <ParentIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{mod.label}</div>
                      {hasChildren && (
                        <div className="text-[11px] text-muted-foreground">
                          {mod.subModules.length} sub-modules
                        </div>
                      )}
                    </div>
                  </div>

                  {PERMISSION_ACTIONS.map((a) => {
                    if (a === "approve" && !supportsApprove) {
                      return (
                        <div key={a} className="flex justify-center text-muted-foreground/40" title="Approve permission not applicable here">
                          —
                        </div>
                      );
                    }
                    const agg = aggregate(draft, mod, a);
                    return (
                      <div key={a} className="flex flex-col items-center justify-center gap-1">
                        <TriBox
                          state={agg}
                          disabled={isSuper}
                          onClick={() =>
                            setDraft((m) => setParent(m, mod, a, agg !== "all"))
                          }
                        />
                        <span className="text-[10px] text-muted-foreground sm:hidden">{ACTION_META[a].label}</span>
                      </div>
                    );
                  })}

                </div>

                {/* Sub-module rows */}
                {hasChildren && open && (
                  <div className="bg-secondary/15">
                    {mod.subModules.map((sub) => {
                      const cell = getCell(draft, mod.key, sub.key);
                      const SubIcon = sub.icon;
                      return (
                        <div
                          key={sub.key}
                            className="grid grid-cols-4 items-center gap-2 border-t border-border/40 px-3 py-3 hover:bg-secondary/40 sm:min-w-[590px] sm:grid-cols-[minmax(0,1fr)_repeat(4,96px)] sm:border-0 sm:px-4 sm:py-2 sm:pl-14"
                        >
                          <div className="col-span-4 flex min-w-0 items-center gap-2 sm:col-span-1">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background text-muted-foreground">
                              <SubIcon className="h-3.5 w-3.5" />
                            </div>
                            <span className="truncate text-sm text-foreground/85">
                              {sub.label}
                            </span>
                          </div>
                          {PERMISSION_ACTIONS.map((a) => {
                            if (a === "approve" && !supportsApprove) {
                              return (
                                <div key={a} className="flex justify-center text-muted-foreground/40">
                                  —
                                </div>
                              );
                            }
                            const on = permFlag(cell, a);
                            return (
                              <div key={a} className="flex flex-col items-center justify-center gap-1">
                                <CheckBox
                                  on={on}
                                  disabled={isSuper}
                                  action={a}
                                  onClick={() =>
                                    setDraft((m) =>
                                      setCell(m, mod.key, sub.key, {
                                        ...cell,
                                        [`can_${a}`]: !on,
                                      }),
                                    )
                                  }
                                />
                                <span className="text-[10px] text-muted-foreground sm:hidden">{ACTION_META[a].label}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        <span className="font-semibold">Note:</span> Edit implies View. Delete implies Edit and
        View. These are enforced automatically.
      </p>
    </div>
  );
}

function CheckBox({
  on,
  disabled,
  action,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  action: PermissionAction;
  onClick: () => void;
}) {
  const Icon = ACTION_META[action].icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
        on
          ? "border-accent bg-accent text-accent-foreground shadow"
          : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-pressed={on}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function TriBox({
  state,
  disabled,
  onClick,
}: {
  state: Tri;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
        state === "all" && "border-accent bg-accent text-accent-foreground shadow",
        state === "some" && "border-accent/60 bg-accent/20 text-accent",
        state === "none" &&
          "border-border bg-background text-muted-foreground hover:border-accent/50",
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-label={`Toggle ${state}`}
    >
      {state === "all" && <span className="text-sm">✓</span>}
      {state === "some" && <span className="h-0.5 w-3 rounded bg-accent" />}
      {state === "none" && <span className="h-2 w-2 rounded-full border border-current" />}
    </button>
  );
}
