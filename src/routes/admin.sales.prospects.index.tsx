import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LayoutGrid, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageStat } from "@/components/PageHeader";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv } from "@/lib/csv-export";
import { logActivity } from "@/lib/activity-log";
import { CRM_MODULE, crmDb, fetchLeads, fetchStages, inr, LEAD_SOURCES, QK, stageTone, type CrmLead } from "@/lib/crm";
import { cn } from "@/lib/utils";

type Search = { stage?: string; overdue?: true; view?: "list" | "board" };

export const Route = createFileRoute("/admin/sales/prospects/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    stage: typeof s.stage === "string" ? s.stage : undefined,
    overdue: s.overdue === true || s.overdue === "true" ? true : undefined,
    view: s.view === "board" ? "board" : s.view === "list" ? "list" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Prospects Pipeline — Radiant" },
      { name: "description", content: "Every prospect in the sales funnel, as a list or a stage board." },
      { property: "og:title", content: "Prospects Pipeline — Radiant" },
      { property: "og:description", content: "Every prospect in the sales funnel, as a list or a stage board." },
    ],
  }),
  component: ProspectsPage,
});

function ProspectsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/sales/prospects/" });
  const qc = useQueryClient();
  const stagesQ = useQuery({ queryKey: QK.stages, queryFn: fetchStages });
  const leadsQ = useQuery({ queryKey: QK.leads, queryFn: fetchLeads });
  const stages = stagesQ.data ?? [];
  const leads = leadsQ.data ?? [];
  const stageOf = useMemo(() => new Map(stages.map((s) => [s.key, s])), [stages]);

  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const [owner, setOwner] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const view = search.view ?? "list";

  const owners = useMemo(() => [...new Set(leads.map((l) => l.owner_name).filter(Boolean))].sort(), [leads]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = new Date();
    return leads.filter((l) => {
      if (search.stage && view === "list" && l.stage_key !== search.stage) return false;
      if (search.overdue) {
        const st = stageOf.get(l.stage_key);
        if (!l.next_follow_up_at || new Date(l.next_follow_up_at) >= now || st?.is_won || st?.is_lost) return false;
      }
      if (source !== "all" && l.source !== source) return false;
      if (owner !== "all" && l.owner_name !== owner) return false;
      if (s && !`${l.lead_code} ${l.company_name} ${l.contact_name} ${l.city} ${l.state} ${l.contact_phone}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [leads, q, source, owner, search.stage, search.overdue, view, stageOf]);

  const pg = usePagination(filtered, 20);

  const moveStage = useMutation({
    mutationFn: async ({ lead, stage }: { lead: CrmLead; stage: string }) => {
      const target = stageOf.get(stage);
      if (target?.is_lost) throw new Error("Open the prospect to mark it Lost with a reason");
      if (target?.is_won) throw new Error("Use Convert to contract on the prospect to mark it Won");
      const { error } = await crmDb.from("crm_leads").update({ stage_key: stage }).eq("id", lead.id);
      if (error) throw new Error(error.message);
      void logActivity({ module: CRM_MODULE, action: "stage_change", entityType: "crm_leads", entityId: lead.id, entityLabel: lead.lead_code, details: { from: lead.stage_key, to: stage } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move"),
  });

  const exportCsv = () =>
    downloadCsv(`prospects-${new Date().toISOString().slice(0, 10)}`, filtered.map((l) => ({
      code: l.lead_code, company: l.company_name, contact: l.contact_name, phone: l.contact_phone, email: l.contact_email,
      stage: stageOf.get(l.stage_key)?.label ?? l.stage_key, source: l.source, owner: l.owner_name, city: l.city, state: l.state,
      monthly_value: l.estimated_monthly_value, expected_close: l.expected_close_date ?? "", next_follow_up: l.next_follow_up_at ?? "",
    })));

  const openStats = leads.filter((l) => { const s = stageOf.get(l.stage_key); return s && !s.is_won && !s.is_lost; });

  return (
    <div>
      <PageHeader
        eyebrow="Sales & Marketing"
        title="Prospects"
        description="Track every prospect from first contact to a signed contract."
        crumbs={[{ label: "Sales & Marketing" }, { label: "Prospects" }]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New prospect</Button>}
        kpis={
          <>
            <PageStat label="All prospects" value={leads.length} active={!search.stage && !search.overdue} onClick={() => navigate({ search: { view: search.view } })} />
            <PageStat label="Open" value={openStats.length} tone="accent" />
            <PageStat label="Open value / month" value={inr(openStats.reduce((a, l) => a + Number(l.estimated_monthly_value || 0), 0))} />
            <PageStat label="Overdue follow-ups" value={leads.filter((l) => { const s = stageOf.get(l.stage_key); return l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date() && !s?.is_won && !s?.is_lost; }).length} tone="warning" active={!!search.overdue} onClick={() => navigate({ search: { overdue: true, view: search.view } })} />
          </>
        }
      />

      <div className="mobile-directory-toolbar mobile-glass-surface mb-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-card/70 p-2 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:rounded-2xl sm:p-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-10 rounded-xl border-transparent bg-card/80 pl-9 shadow-sm focus-visible:border-accent/30" placeholder="Search company, contact, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {view === "list" && (
          <Select value={search.stage ?? "all"} onValueChange={(v) => navigate({ search: { ...search, stage: v === "all" ? undefined : v } })}>
            <SelectTrigger className="h-10 w-[180px]"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-10 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-10 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border p-0.5">
          <button type="button" aria-label="List view" onClick={() => navigate({ search: { ...search, view: "list" } })} className={cn("rounded-md p-2", view === "list" && "bg-primary text-primary-foreground")}><List className="h-4 w-4" /></button>
          <button type="button" aria-label="Board view" onClick={() => navigate({ search: { ...search, view: "board" } })} className={cn("rounded-md p-2", view === "board" && "bg-primary text-primary-foreground")}><LayoutGrid className="h-4 w-4" /></button>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
      </div>

      {view === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="ios-table w-full text-sm">
              <thead className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Stage</th><th className="px-4 py-3">Value / mo</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Next follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pg.pageRows.map((l) => {
                  const st = stageOf.get(l.stage_key);
                  const overdue = l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date() && !st?.is_won && !st?.is_lost;
                  return (
                    <tr key={l.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => navigate({ to: "/admin/sales/prospects/$leadId", params: { leadId: l.id } })}>
                      <td className="px-4 py-3 font-mono text-xs">{l.lead_code}</td>
                      <td className="px-4 py-3"><div className="font-medium">{l.company_name}</div><div className="text-xs text-muted-foreground">{[l.city, l.state].filter(Boolean).join(", ")}</div></td>
                      <td className="px-4 py-3"><div>{l.contact_name || "—"}</div><div className="text-xs text-muted-foreground">{l.contact_phone}</div></td>
                      <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stageTone(st))}>{st?.label ?? l.stage_key}</span></td>
                      <td className="px-4 py-3 tabular-nums">{inr(l.estimated_monthly_value)}</td>
                      <td className="px-4 py-3">{l.owner_name || "—"}</td>
                      <td className={cn("px-4 py-3 text-xs", overdue && "text-destructive")}>{l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  );
                })}
                {!leadsQ.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No prospects match. Add one with “New prospect”.</td></tr>
                )}
                {leadsQ.isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>}
                {leadsQ.error && <tr><td colSpan={7} className="px-4 py-10 text-center text-destructive">{(leadsQ.error as Error).message}</td></tr>}
              </tbody>
            </table>
          </div>
          <DataPagination {...pg} label="prospects" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map((s) => {
            const col = filtered.filter((l) => l.stage_key === s.key);
            return (
              <div
                key={s.key}
                className="w-64 shrink-0 rounded-2xl border border-border bg-card/70 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  const lead = leads.find((l) => l.id === id);
                  if (lead && lead.stage_key !== s.key) moveStage.mutate({ lead, stage: s.key });
                }}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", stageTone(s))}>{s.label}</span>
                  <span className="text-xs text-muted-foreground">{col.length} · {inr(col.reduce((a, l) => a + Number(l.estimated_monthly_value || 0), 0))}</span>
                </div>
                <div className="space-y-2">
                  {col.slice(0, 50).map((l) => (
                    <Link
                      key={l.id}
                      to="/admin/sales/prospects/$leadId"
                      params={{ leadId: l.id }}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                      className="block rounded-xl border border-border bg-background p-2.5 text-sm shadow-sm hover:border-primary/50"
                    >
                      <div className="font-medium">{l.company_name}</div>
                      <div className="text-xs text-muted-foreground">{l.contact_name || l.lead_code}</div>
                      <div className="mt-1 flex justify-between text-xs"><span className="tabular-nums">{inr(l.estimated_monthly_value)}</span><span className="text-muted-foreground">{l.owner_name}</span></div>
                    </Link>
                  ))}
                  {col.length > 50 && <p className="px-1 text-xs text-muted-foreground">+{col.length - 50} more — use list view</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateLeadDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate({ to: "/admin/sales/prospects/$leadId", params: { leadId: id } })} />
    </div>
  );
}

function CreateLeadDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ company_name: "", contact_name: "", contact_phone: "", contact_email: "", source: "", city: "", state: "", estimated_monthly_value: "", owner_name: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      const { data, error } = await crmDb.from("crm_leads").insert({
        company_name: f.company_name.trim(), contact_name: f.contact_name.trim(), contact_phone: f.contact_phone.trim(),
        contact_email: f.contact_email.trim(), source: f.source, city: f.city.trim(), state: f.state.trim(),
        estimated_monthly_value: Number(f.estimated_monthly_value) || 0,
        owner_name: f.owner_name.trim(),
        owner_id: auth.user?.id ?? null, created_by: auth.user?.id ?? null,
      }).select("id,lead_code").single();
      if (error) throw new Error(error.message);
      void logActivity({ module: CRM_MODULE, action: "create", entityType: "crm_leads", entityId: data.id, entityLabel: `${data.lead_code} ${f.company_name}` });
      return String(data.id);
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Prospect added");
      onOpenChange(false);
      setF({ company_name: "", contact_name: "", contact_phone: "", contact_email: "", source: "", city: "", state: "", estimated_monthly_value: "", owner_name: "" });
      onCreated(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New prospect</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Company *</Label><Input value={f.company_name} onChange={set("company_name")} /></div>
          <div className="space-y-1.5"><Label>Contact person</Label><Input value={f.contact_name} onChange={set("contact_name")} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.contact_phone} inputMode="tel" onChange={set("contact_phone")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Email</Label><Input value={f.contact_email} type="email" onChange={set("contact_email")} /></div>
          <div className="space-y-1.5"><Label>City</Label><Input value={f.city} onChange={set("city")} /></div>
          <div className="space-y-1.5"><Label>State</Label><Input value={f.state} onChange={set("state")} /></div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={f.source || undefined} onValueChange={(v) => setF({ ...f, source: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Est. value / month (₹)</Label><Input value={f.estimated_monthly_value} inputMode="decimal" onChange={set("estimated_monthly_value")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Owner</Label><Input value={f.owner_name} placeholder="Who is handling this prospect" onChange={set("owner_name")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={f.company_name.trim().length < 2 || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Saving…" : "Add prospect"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
