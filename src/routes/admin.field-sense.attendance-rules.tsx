import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FieldSenseAdminGuard } from "@/components/FieldSenseAdminGuard";
import { PageHeader } from "@/components/PageHeader";
import { EmployeePicker } from "@/components/EmployeePicker";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/admin/field-sense/attendance-rules")({
  component: () => (
    <FieldSenseAdminGuard sub="day_patrol">
      <AttendanceRulesPage />
    </FieldSenseAdminGuard>
  ),
  head: () => ({
    meta: [
      { title: "Attendance Location Rules — Radiant Guard" },
      { name: "description", content: "Decide where each role or person may mark attendance: anywhere, their mapped site, or their home office." },
      { property: "og:title", content: "Attendance Location Rules" },
      { property: "og:description", content: "Decide where each role or person may mark attendance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Mode = "anywhere" | "assigned_unit" | "home_unit";
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "anywhere", label: "Anywhere", hint: "Any GPS location" },
  { value: "assigned_unit", label: "Mapped site only", hint: "Only at the client site(s) they are mapped to" },
  { value: "home_unit", label: "Home office only", hint: "Only at their home branch / office" },
];
const MODULE = "Attendance Location Rules";

type Policy = { role_key: string; mode: Mode; radius_m: number; capture_missing_coords: boolean; require_selfie: boolean };
type Role = { key: string; name: string };
type Override = { candidate_id: string; mode: Mode; require_selfie: boolean | null; notes: string | null; updated_at: string };
type Cand = { id: string; full_name: string | null; employee_code: string | null; role_key: string | null };

function AttendanceRulesPage() {
  const qc = useQueryClient();

  const canEditQ = useQuery({
    queryKey: ["att-rules-can-edit"],
    queryFn: async () => {
      const { data } = await supabase.rpc("current_user_can_manage_attendance_location_rules" as never);
      return data === true;
    },
  });
  const canEdit = canEditQ.data === true;

  const rolesQ = useQuery({
    queryKey: ["att-rules-roles"],
    queryFn: async () => {
      const [r, p] = await Promise.all([
        supabase.from("roles").select("key, name").order("name"),
        supabase.from("attendance_location_policies" as never).select("*"),
      ]);
      if (r.error) throw r.error;
      if (p.error) throw p.error;
      return { roles: (r.data ?? []) as Role[], policies: (p.data ?? []) as Policy[] };
    },
  });

  const overridesQ = useQuery({
    queryKey: ["att-rules-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_location_overrides" as never)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Override[];
      const ids = rows.map((r) => r.candidate_id);
      const cands: Record<string, Cand> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: c } = await supabase
          .from("candidates")
          .select("id, full_name, employee_code, role_key")
          .in("id", ids.slice(i, i + 200));
        for (const x of (c ?? []) as Cand[]) cands[x.id] = x;
      }
      return rows.map((r) => ({ ...r, cand: cands[r.candidate_id] ?? null }));
    },
  });

  const policyMap = useMemo(() => {
    const m: Record<string, Policy> = {};
    for (const p of rolesQ.data?.policies ?? []) m[p.role_key] = p;
    return m;
  }, [rolesQ.data]);

  const savePolicy = useMutation({
    mutationFn: async (p: Policy) => {
      const before = policyMap[p.role_key] ?? null;
      const { error } = await supabase
        .from("attendance_location_policies" as never)
        .upsert({ ...p, updated_at: new Date().toISOString() } as never, { onConflict: "role_key" });
      if (error) throw error;
      void logActivity({ module: MODULE, action: "update", entityType: "attendance_location_policies", entityLabel: p.role_key, before, after: p });
    },
    onSuccess: () => { toast.success("Rule saved"); void qc.invalidateQueries({ queryKey: ["att-rules-roles"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const [pickId, setPickId] = useState("");
  const [pickMode, setPickMode] = useState<Mode>("anywhere");
  const saveOverride = useMutation({
    mutationFn: async ({ candidate_id, mode, require_selfie }: { candidate_id: string; mode: Mode; require_selfie?: boolean | null }) => {
      const row: Record<string, unknown> = { candidate_id, mode, updated_at: new Date().toISOString() };
      if (require_selfie !== undefined) row.require_selfie = require_selfie;
      const { error } = await supabase
        .from("attendance_location_overrides" as never)
        .upsert(row as never, { onConflict: "candidate_id" });
      if (error) throw error;
      void logActivity({ module: MODULE, action: "update", entityType: "attendance_location_overrides", entityId: candidate_id, after: { mode, require_selfie } });
    },
    onSuccess: () => { toast.success("Person rule saved"); setPickId(""); void qc.invalidateQueries({ queryKey: ["att-rules-overrides"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const deleteOverride = useMutation({
    mutationFn: async (candidate_id: string) => {
      const { error } = await supabase.from("attendance_location_overrides" as never).delete().eq("candidate_id", candidate_id);
      if (error) throw error;
      void logActivity({ module: MODULE, action: "delete", entityType: "attendance_location_overrides", entityId: candidate_id });
    },
    onSuccess: () => { toast.success("Person now follows the role rule"); void qc.invalidateQueries({ queryKey: ["att-rules-overrides"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const roles = rolesQ.data?.roles ?? [];
  const rolePg = usePagination(roles, 20);
  const overrides = overridesQ.data ?? [];
  const ovPg = usePagination(overrides, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Location Rules"
        description="Where people may mark attendance. Sites without a saved location learn it from the first on-site check-in or client visit."
      />

      <section className="rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">By role</h2>
          <p className="text-xs text-muted-foreground">Applies to everyone in the role unless a person rule is set below.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Where they can mark</th>
                <th className="px-4 py-2">Allowed distance (m)</th>
                <th className="px-4 py-2">Save new site locations</th>
                <th className="px-4 py-2">Face photo required</th>
              </tr>
            </thead>
            <tbody>
              {rolePg.pageRows.map((r) => {
                const p: Policy = policyMap[r.key] ?? { role_key: r.key, mode: "home_unit", radius_m: 300, capture_missing_coords: true, require_selfie: r.key === "field_officer" || r.key === "guard" };
                return (
                  <tr key={r.key} className="border-t border-border/50">
                    <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-2">
                      <Select value={p.mode} disabled={!canEdit} onValueChange={(v) => savePolicy.mutate({ ...p, mode: v as Mode })}>
                        <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min={25}
                        max={5000}
                        defaultValue={p.radius_m}
                        disabled={!canEdit || p.mode === "anywhere"}
                        className="h-9 w-28"
                        onBlur={(e) => {
                          const v = Math.round(Number(e.target.value));
                          if (!Number.isFinite(v) || v === p.radius_m) return;
                          if (v < 25 || v > 5000) { toast.error("Use 25 to 5000 m"); return; }
                          savePolicy.mutate({ ...p, radius_m: v });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Switch
                        checked={p.capture_missing_coords}
                        disabled={!canEdit}
                        onCheckedChange={(v) => savePolicy.mutate({ ...p, capture_missing_coords: v })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Switch
                        checked={p.require_selfie}
                        disabled={!canEdit}
                        onCheckedChange={(v) => savePolicy.mutate({ ...p, require_selfie: v })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DataPagination {...rolePg} label="roles" />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">By person</h2>
          <p className="text-xs text-muted-foreground">Exceptions for specific employees. Overrides their role rule.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <div className="min-w-64 flex-1"><EmployeePicker value={pickId} onChange={setPickId} placeholder="Search employee by name or ID" /></div>
            <Select value={pickMode} onValueChange={(v) => setPickMode(v as Mode)}>
              <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={!pickId || saveOverride.isPending} onClick={() => saveOverride.mutate({ candidate_id: pickId, mode: pickMode })}>
              Add rule
            </Button>
          </div>
        )}
        {overrides.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No person rules. Everyone follows their role rule.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Where they can mark</th>
                  <th className="px-4 py-2">Face photo</th>
                  <th className="px-4 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {ovPg.pageRows.map((o) => (
                  <tr key={o.candidate_id} className="border-t border-border/50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground">{o.cand?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.cand?.employee_code ?? ""}</div>
                    </td>
                    <td className="px-4 py-2">
                      <Select value={o.mode} disabled={!canEdit} onValueChange={(v) => saveOverride.mutate({ candidate_id: o.candidate_id, mode: v as Mode })}>
                        <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      {canEdit && (
                        <Button variant="ghost" size="icon" aria-label="Remove person rule" onClick={() => deleteOverride.mutate(o.candidate_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DataPagination {...ovPg} label="people" />
      </section>
    </div>
  );
}
