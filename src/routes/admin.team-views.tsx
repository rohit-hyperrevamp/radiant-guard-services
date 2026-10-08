import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/SearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/admin/team-views")({
  head: () => ({
    meta: [
      { title: "Team Views | Radiant Guard Services" },
      { name: "description", content: "Choose who shares a manager's team view of clients, sites and people." },
      { property: "og:title", content: "Team Views | Radiant Guard Services" },
      { property: "og:description", content: "Choose who shares a manager's team view of clients, sites and people." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamViewsPage,
});

type Person = { id: string; full_name: string | null; employee_code: string | null; designation: string | null };
type ScopeRow = { id: string; candidate_id: string; scope_id: string };

const label = (p?: Person) => (p ? `${p.full_name ?? "—"}${p.employee_code ? ` · ${p.employee_code}` : ""}` : "Unknown");

function TeamViewsPage() {
  const { isSuperAdmin } = useCurrentPermissions();
  const qc = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [addId, setAddId] = useState("");

  const peopleQ = useQuery({
    queryKey: ["team-views-people"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,employee_code,designation")
        .in("status", ["active", "approved"])
        .not("role_key", "in", "(guard,security_guard)")
        .order("full_name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Person[];
    },
  });
  const rowsQ = useQuery({
    queryKey: ["team-views-rows"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_scope_assignments" as never)
        .select("id,candidate_id,scope_id")
        .eq("scope_type", "team");
      if (error) throw error;
      return (data ?? []) as unknown as ScopeRow[];
    },
  });
  const sitesQ = useQuery({
    queryKey: ["team-views-sites", managerId],
    enabled: isSuperAdmin && !!managerId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown[] | null; error: unknown }>)("team_unit_ids", { _manager_id: managerId });
      if (error) throw error;
      return (data ?? []).length;
    },
  });

  const byId = useMemo(() => new Map((peopleQ.data ?? []).map((p) => [p.id, p])), [peopleQ.data]);
  const options = useMemo(
    () => (peopleQ.data ?? []).map((p) => ({ value: p.id, label: label(p), hint: p.designation ?? undefined })),
    [peopleQ.data],
  );
  const managers = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsQ.data ?? []) m.set(r.scope_id, (m.get(r.scope_id) ?? 0) + 1);
    return [...m.entries()];
  }, [rowsQ.data]);
  const members = (rowsQ.data ?? []).filter((r) => r.scope_id === managerId);

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-views-rows"] });

  const add = async () => {
    if (!managerId || !addId) return;
    if (members.some((m) => m.candidate_id === addId)) return toast.info("Already in this team view");
    const mgr = byId.get(managerId);
    const { error } = await supabase.from("employee_scope_assignments" as never).insert({
      candidate_id: addId,
      scope_type: "team",
      scope_id: managerId,
      scope_label: `${mgr?.full_name ?? "Manager"} team`,
    } as never);
    if (error) return toast.error(error.message);
    void logActivity({
      module: "Team Views",
      action: "create",
      entityType: "candidate",
      entityId: addId,
      entityLabel: label(byId.get(addId)),
      details: { manager: label(mgr) },
    });
    toast.success("Added to team view");
    setAddId("");
    refresh();
  };

  const remove = async (r: ScopeRow) => {
    const { error } = await supabase.from("employee_scope_assignments" as never).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    void logActivity({
      module: "Team Views",
      action: "delete",
      entityType: "candidate",
      entityId: r.candidate_id,
      entityLabel: label(byId.get(r.candidate_id)),
      details: { manager: label(byId.get(r.scope_id)) },
    });
    toast.success("Removed from team view");
    refresh();
  };

  if (!isSuperAdmin)
    return <div className="p-6 text-sm text-muted-foreground">Only Super Admin can manage team views.</div>;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Team Views"
        description="Pick a manager, then choose who sees that manager's team — every client, site, contract, guard and attendance handled by the manager or anyone reporting to them."
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-border p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Existing team views</div>
          {managers.length === 0 && <div className="text-xs text-muted-foreground">None yet.</div>}
          {managers.map(([id, n]) => (
            <button
              key={id}
              onClick={() => setManagerId(id)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50 ${managerId === id ? "bg-muted" : ""}`}
            >
              <span className="truncate">{label(byId.get(id))}</span>
              <span className="text-xs text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="text-xs font-medium text-muted-foreground">Manager</div>
          <SearchSelect value={managerId} onChange={setManagerId} options={options} placeholder="Choose a manager" searchPlaceholder="Search people…" />
          {managerId && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> Team covers {sitesQ.data ?? "…"} client sites
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchSelect value={addId} onChange={setAddId} options={options} placeholder="Add a person to this view" searchPlaceholder="Search people…" />
                </div>
                <Button onClick={add} disabled={!addId} className="gap-1">
                  <UserPlus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border">
                {members.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nobody shares this view yet.</div>}
                {members.map((r) => {
                  const p = byId.get(r.candidate_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                      <div>
                        <div>{label(p)}</div>
                        <div className="text-xs text-muted-foreground">{p?.designation ?? ""}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => remove(r)} aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
