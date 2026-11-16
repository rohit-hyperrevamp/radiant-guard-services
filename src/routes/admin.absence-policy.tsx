import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { logActivity } from "@/lib/activity-log";
import { DEFAULT_ABSENCE_POLICY, validateAbsencePolicy, type AbsencePolicy } from "@/lib/absence-policy";

export const Route = createFileRoute("/admin/absence-policy")({
  head: () => ({ meta: [
    { title: "Guard Absence Rules | Radiant Guard Services" },
    { name: "description", content: "Manage guard absence warnings, approval thresholds and absence review." },
    { property: "og:title", content: "Guard Absence Rules | Radiant Guard Services" },
    { property: "og:description", content: "Configure continuous absence warnings and approved termination safeguards." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AbsencePage,
});

type CaseRow = { id: string; candidate_id: string; streak_start: string; through_date: string; absent_days: number; status: string; approval_request_id: string | null };
const QK = ["guard-absence-policy"];

function AbsencePage() {
  const { canSub, canAction, isSuperAdmin, isLoading } = useCurrentPermissions();
  const session = useHasSupabaseSession();
  const qc = useQueryClient();
  const canView = isSuperAdmin || canSub("control_center", "absence_policy");
  const canEdit = isSuperAdmin || canAction("control_center", "absence_policy", "edit");
  const [draft, setDraft] = useState<AbsencePolicy>({ ...DEFAULT_ABSENCE_POLICY });
  const [warnings, setWarnings] = useState("10, 15, 20");
  const q = useQuery({ queryKey: QK, enabled: session && canView, queryFn: async () => {
    const { data, error } = await supabase.from("guard_absence_policy" as never).select("*").eq("id", true).single();
    if (error) throw error;
    return data as unknown as AbsencePolicy;
  } });
  const departments = useQuery({ queryKey: ["absence-departments"], enabled: session && canView, queryFn: async () => {
    const { data, error } = await supabase.from("departments").select("id,name").order("name");
    if (error) throw error;
    return data ?? [];
  } });
  const cases = useQuery({ queryKey: ["guard-absence-cases"], enabled: session && canView, queryFn: async () => {
    const { data, error } = await supabase.from("guard_absence_cases" as never).select("id,candidate_id,streak_start,through_date,absent_days,status,approval_request_id").order("updated_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data as unknown as CaseRow[];
  }, refetchInterval: 60_000 });
  const ids = (cases.data ?? []).map((c) => c.candidate_id);
  const people = useQuery({ queryKey: ["guard-absence-names", ids.join(",")], enabled: session && ids.length > 0, queryFn: async () => {
    const { data, error } = await supabase.from("candidates").select("id,full_name,employee_code").in("id", ids);
    if (error) throw error;
    return new Map((data ?? []).map((c) => [c.id, c]));
  } });
  useEffect(() => { if (q.data) { setDraft(q.data); setWarnings(q.data.warning_days.join(", ")); } }, [q.data]);
  const save = useMutation({ mutationFn: async () => {
    const next = { ...draft, warning_days: [...new Set(warnings.split(",").map((v) => Number(v.trim())))].sort((a,b) => a-b) };
    const errorMessage = validateAbsencePolicy(next);
    if (errorMessage) throw new Error(errorMessage);
    const { activated_on: _activation, ...values } = next;
    const { error } = await supabase.from("guard_absence_policy" as never).update(values as never).eq("id", true);
    if (error) throw error;
    await logActivity({ module: "Guard Absence Policy", action: "update", entityType: "guard_absence_policy", entityLabel: "Guard absence rules", before: q.data, after: values });
  }, onSuccess: () => { toast.success("Guard absence rules saved"); void qc.invalidateQueries({ queryKey: QK }); }, onError: (e: Error) => toast.error(e.message) });
  if (isLoading) return <div className="p-6 text-muted-foreground">Loading permissions…</div>;
  if (!canView) return <div className="p-6 text-muted-foreground">You do not have access to guard absence settings.</div>;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <PageHeader title="Guard Absence Rules" crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Guard Absence Rules" }]} />
    {q.isError ? <p role="alert" className="text-destructive">Absence rules are unavailable. No rules have been activated. {q.error.message}</p> : q.isPending ? <p className="text-muted-foreground">Loading rules…</p> : <>
      <div className="flex items-center gap-3 bg-muted/50 p-4 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-accent" /><span>Security guards only · Termination requires approval · Checks use completed days across all sites</span></div>
      <fieldset disabled={!canEdit || save.isPending} className="space-y-5">
        <div className="flex items-center justify-between gap-4"><label htmlFor="absence-enabled" className="font-medium">Enable absence tracking</label><Switch id="absence-enabled" checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} /></div>
        <div className="flex items-center justify-between gap-4"><label htmlFor="absence-alerts" className="font-medium">Employee and manager warnings</label><Switch id="absence-alerts" checked={draft.alerts_enabled} onCheckedChange={(alerts_enabled) => setDraft({ ...draft, alerts_enabled })} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2"><label htmlFor="absence-warning-days" className="text-sm font-medium">Warning days</label><Input id="absence-warning-days" value={warnings} onChange={(e) => setWarnings(e.target.value)} placeholder="10, 15, 20" /></div>
          <div className="space-y-2"><label htmlFor="absence-termination-days" className="text-sm font-medium">Days before termination review</label><Input id="absence-termination-days" type="number" min={15} max={365} value={draft.termination_days} onChange={(e) => setDraft({ ...draft, termination_days: Number(e.target.value) })} /></div>
        </div>
        <div className="flex items-center justify-between gap-4"><label htmlFor="absence-termination" className="font-medium">Automatically request termination approval</label><Switch id="absence-termination" checked={draft.termination_enabled} onCheckedChange={(termination_enabled) => setDraft({ ...draft, termination_enabled })} /></div>
        <div className="space-y-3"><div className="text-sm font-medium">Departments · none selected means all guard departments</div><div className="flex flex-wrap gap-x-6 gap-y-3">{departments.data?.map((d) => <label key={d.id} className="flex items-center gap-2 text-sm"><Checkbox checked={draft.department_ids.includes(d.id)} onCheckedChange={(checked) => setDraft({ ...draft, department_ids: checked ? [...draft.department_ids, d.id] : draft.department_ids.filter((id) => id !== d.id) })} />{d.name}</label>)}</div></div>
        <Button disabled={!canEdit} onClick={() => save.mutate()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save rules"}</Button>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span>{draft.activated_on ? `Tracking starts ${draft.activated_on}` : "Tracking has not started"}</span><Link to="/admin/workflow-manager" className="text-accent underline">Approval workflow</Link></div>
    </>}
    <section className="space-y-3"><h2 className="font-display text-lg font-semibold">Recent absence reviews</h2>{cases.isError ? <p role="alert" className="text-destructive">Could not load absence reviews.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr><th className="py-3">Employee</th><th>Period</th><th>Days</th><th>Status</th><th /></tr></thead><tbody>{cases.data?.map((c) => <tr key={c.id} className="border-t border-border"><td className="py-3">{people.data?.get(c.candidate_id)?.full_name ?? "Employee"}<div className="text-xs text-muted-foreground">{people.data?.get(c.candidate_id)?.employee_code}</div></td><td>{c.streak_start} – {c.through_date}</td><td>{c.absent_days}</td><td>{c.status}</td><td>{c.approval_request_id && <Link to="/admin/approvals" search={{ request: c.approval_request_id }} className="text-accent underline">Review</Link>}</td></tr>)}</tbody></table>{cases.data?.length === 0 && <p className="py-6 text-muted-foreground">No absence reviews.</p>}</div>}</section>
  </div>;
}