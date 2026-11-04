import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileText, Plus, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOrgUnitChain } from "@/components/OrgUnitChain";
import { logActivity } from "@/lib/activity-log";
import {
  ACTIVITY_TYPES, CRM_MODULE, crmDb, fetchActivities, fetchLead, fetchLostReasons, fetchQuoteLines, fetchQuotes,
  fetchRequirements, fetchStages, inr, LEAD_SOURCES, QK, QUOTE_TONE, quoteLineMonthly, stageTone,
  type CrmLead, type CrmQuote, type CrmQuoteLine,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/sales/prospects/$leadId")({
  head: () => ({
    meta: [
      { title: "Prospect — Radiant Sales" },
      { name: "description", content: "Prospect details, activity timeline, requirements, quotes and contract conversion." },
      { property: "og:title", content: "Prospect — Radiant Sales" },
      { property: "og:description", content: "Prospect details, activity timeline, requirements, quotes and contract conversion." },
    ],
  }),
  component: LeadDetail,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = supabase as unknown as { from: (t: string) => any };

type Designation = { id: string; name: string };
async function fetchDesignations(): Promise<Designation[]> {
  const { data, error } = await anyDb.from("designations").select("id,name").eq("enabled", true).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function LeadDetail() {
  const { leadId } = Route.useParams();
  const qc = useQueryClient();
  const leadQ = useQuery({ queryKey: QK.lead(leadId), queryFn: () => fetchLead(leadId) });
  const stagesQ = useQuery({ queryKey: QK.stages, queryFn: fetchStages });
  const stages = stagesQ.data ?? [];
  const lead = leadQ.data;
  const stage = stages.find((s) => s.key === lead?.stage_key);
  const [lostOpen, setLostOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm"] });

  const setStage = useMutation({
    mutationFn: async ({ key, lost_reason }: { key: string; lost_reason?: string }) => {
      const patch: Record<string, unknown> = { stage_key: key };
      if (lost_reason !== undefined) patch.lost_reason = lost_reason;
      const { error } = await crmDb.from("crm_leads").update(patch).eq("id", leadId);
      if (error) throw new Error(error.message);
      void logActivity({ module: CRM_MODULE, action: "stage_change", entityType: "crm_leads", entityId: leadId, entityLabel: lead?.lead_code, details: { from: lead?.stage_key, to: key, lost_reason } });
    },
    onSuccess: () => { invalidate(); toast.success("Stage updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  if (leadQ.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (leadQ.error) return <p className="p-6 text-sm text-destructive">{(leadQ.error as Error).message}</p>;
  if (!lead) return <div className="p-6"><p className="text-sm text-muted-foreground">Prospect not found.</p><Link to="/admin/sales/prospects" search={{}} className="text-sm text-primary">Back to prospects</Link></div>;

  const converted = !!lead.converted_contract_id;

  return (
    <div>
      <PageHeader
        eyebrow={lead.lead_code}
        title={lead.company_name}
        description={[lead.contact_name, lead.city, lead.state].filter(Boolean).join(" · ")}
        crumbs={[{ label: "Sales & Marketing" }, { label: "Prospects", to: "/admin/sales/prospects" }, { label: lead.lead_code }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/admin/sales/prospects" search={{}}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link></Button>
            {converted ? (
              <Button variant="outline" asChild><Link to="/admin/contracts/client-contracts" search={{ tab: "prospect", status: "pending_approval" }}><FileText className="mr-1.5 h-4 w-4" /> Open contract</Link></Button>
            ) : (
              <Button onClick={() => setConvertOpen(true)} disabled={stage?.is_lost}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Convert to contract</Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-2">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={converted || setStage.isPending}
            onClick={() => {
              if (s.key === lead.stage_key) return;
              if (s.is_lost) return setLostOpen(true);
              if (s.is_won) return setConvertOpen(true);
              setStage.mutate({ key: s.key });
            }}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed",
              s.key === lead.stage_key ? stageTone(s) + " ring-2 ring-primary/40" : "text-muted-foreground hover:bg-muted")}
          >
            {s.label}
          </button>
        ))}
      </div>
      {stage?.is_lost && lead.lost_reason && <p className="mb-4 text-sm text-destructive">Lost: {lead.lost_reason}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <LeadForm lead={lead} onSaved={invalidate} />
          <Requirements leadId={leadId} />
          <Quotes lead={lead} />
        </div>
        <Activities leadId={leadId} />
      </div>

      <LostDialog open={lostOpen} onOpenChange={setLostOpen} onConfirm={(reason) => {
        const lostKey = stages.find((s) => s.is_lost)?.key;
        if (lostKey) setStage.mutate({ key: lostKey, lost_reason: reason });
        setLostOpen(false);
      }} />
      {convertOpen && <ConvertDialog lead={lead} onClose={() => setConvertOpen(false)} wonKey={stages.find((s) => s.is_won)?.key ?? "won"} />}
    </div>
  );
}

function LeadForm({ lead, onSaved }: { lead: CrmLead; onSaved: () => void }) {
  const [f, setF] = useState(lead);
  useEffect(() => setF(lead), [lead]);
  const set = (k: keyof CrmLead) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: async () => {
      const patch = {
        company_name: f.company_name.trim(), contact_name: f.contact_name, contact_title: f.contact_title, contact_phone: f.contact_phone,
        contact_email: f.contact_email, source: f.source, industry: f.industry, service_type: f.service_type, address: f.address,
        city: f.city, state: f.state, pincode: f.pincode, owner_name: f.owner_name,
        estimated_monthly_value: Number(f.estimated_monthly_value) || 0,
        probability: f.probability === null || (f.probability as unknown) === "" ? null : Number(f.probability),
        expected_close_date: f.expected_close_date || null,
        next_follow_up_at: f.next_follow_up_at ? new Date(f.next_follow_up_at).toISOString() : null,
        notes: f.notes,
      };
      const { error } = await crmDb.from("crm_leads").update(patch).eq("id", lead.id);
      if (error) throw new Error(error.message);
      void logActivity({ module: CRM_MODULE, action: "update", entityType: "crm_leads", entityId: lead.id, entityLabel: lead.lead_code, before: lead as unknown as Record<string, unknown>, after: patch });
    },
    onSuccess: () => { onSaved(); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const followLocal = f.next_follow_up_at ? new Date(f.next_follow_up_at).toISOString().slice(0, 16) : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Prospect details</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <F label="Company"><Input value={f.company_name} onChange={set("company_name")} /></F>
        <F label="Contact person"><Input value={f.contact_name} onChange={set("contact_name")} /></F>
        <F label="Designation"><Input value={f.contact_title} onChange={set("contact_title")} /></F>
        <F label="Phone"><Input value={f.contact_phone} onChange={set("contact_phone")} /></F>
        <F label="Email"><Input value={f.contact_email} onChange={set("contact_email")} /></F>
        <F label="Source">
          <Select value={f.source || undefined} onValueChange={(v) => setF({ ...f, source: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Industry"><Input value={f.industry} onChange={set("industry")} /></F>
        <F label="Service needed"><Input value={f.service_type} onChange={set("service_type")} placeholder="Security, housekeeping…" /></F>
        <F label="Owner"><Input value={f.owner_name} onChange={set("owner_name")} /></F>
        <F label="Address" className="sm:col-span-2 lg:col-span-3"><Input value={f.address} onChange={set("address")} /></F>
        <F label="City"><Input value={f.city} onChange={set("city")} /></F>
        <F label="State"><Input value={f.state} onChange={set("state")} /></F>
        <F label="Pincode"><Input value={f.pincode} onChange={set("pincode")} /></F>
        <F label="Est. value / month (₹)"><Input value={String(f.estimated_monthly_value ?? "")} inputMode="decimal" onChange={(e) => setF({ ...f, estimated_monthly_value: e.target.value as unknown as number })} /></F>
        <F label="Win probability % (blank = stage default)"><Input value={f.probability == null ? "" : String(f.probability)} inputMode="numeric" onChange={(e) => setF({ ...f, probability: (e.target.value === "" ? null : e.target.value) as unknown as number })} /></F>
        <F label="Expected close"><Input type="date" value={f.expected_close_date ?? ""} onChange={(e) => setF({ ...f, expected_close_date: e.target.value || null })} /></F>
        <F label="Next follow-up"><Input type="datetime-local" value={followLocal} onChange={(e) => setF({ ...f, next_follow_up_at: e.target.value || null })} /></F>
        <F label="Notes" className="sm:col-span-2 lg:col-span-3"><Textarea rows={3} value={f.notes} onChange={set("notes")} /></F>
      </div>
      <div className="mt-3 flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending || f.company_name.trim().length < 2}>{save.isPending ? "Saving…" : "Save details"}</Button></div>
    </div>
  );
}

function Requirements({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const reqQ = useQuery({ queryKey: QK.requirements(leadId), queryFn: () => fetchRequirements(leadId) });
  const desQ = useQuery({ queryKey: ["crm", "designations"], queryFn: fetchDesignations });
  const [n, setN] = useState({ designation_id: "", quantity: "1", shift_hours: "8" });
  const add = useMutation({
    mutationFn: async () => {
      const d = desQ.data?.find((x) => x.id === n.designation_id);
      const { error } = await crmDb.from("crm_lead_requirements").insert({ lead_id: leadId, designation_id: d?.id ?? null, designation_label: d?.name ?? "", quantity: Number(n.quantity) || 1, shift_hours: Number(n.shift_hours) || 8 });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.requirements(leadId) }); setN({ designation_id: "", quantity: "1", shift_hours: "8" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await crmDb.from("crm_lead_requirements").delete().eq("id", id); if (error) throw new Error(error.message); },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.requirements(leadId) }),
  });
  const rows = reqQ.data ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">Manpower requirement</h2>
      <p className="mb-3 text-xs text-muted-foreground">What the client needs. Quotes start from these lines.</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <span>{r.designation_label || "—"} × {r.quantity} · {r.shift_hours}h shift</span>
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No requirement captured yet.</p>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px_90px_auto]">
        <Select value={n.designation_id || undefined} onValueChange={(v) => setN({ ...n, designation_id: v })}>
          <SelectTrigger><SelectValue placeholder="Designation" /></SelectTrigger>
          <SelectContent>{(desQ.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={n.quantity} inputMode="numeric" aria-label="Quantity" onChange={(e) => setN({ ...n, quantity: e.target.value })} />
        <Select value={n.shift_hours} onValueChange={(v) => setN({ ...n, shift_hours: v })}>
          <SelectTrigger aria-label="Shift hours"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="8">8h</SelectItem><SelectItem value="10">10h</SelectItem><SelectItem value="12">12h</SelectItem></SelectContent>
        </Select>
        <Button onClick={() => add.mutate()} disabled={!n.designation_id || add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Quotes({ lead }: { lead: CrmLead }) {
  const qc = useQueryClient();
  const quotesQ = useQuery({ queryKey: [...QK.quotes, lead.id], queryFn: () => fetchQuotes(lead.id) });
  const [openId, setOpenId] = useState<string | null>(null);
  const quotes = quotesQ.data ?? [];
  const create = useMutation({
    mutationFn: async () => {
      const reqs = await fetchRequirements(lead.id);
      const prev = quotes[0];
      const version = (quotes.reduce((m, q) => Math.max(m, q.version), 0) || 0) + 1;
      const quote_no = prev?.quote_no || `Q-${lead.lead_code}`;
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await crmDb.from("crm_quotes").insert({ lead_id: lead.id, quote_no, version, created_by: auth.user?.id ?? null }).select("id").single();
      if (error) throw new Error(error.message);
      // New version copies the previous quote's lines, otherwise starts from the requirement.
      const source = prev ? (await fetchQuoteLines(prev.id)).map((l, i) => ({ ...l, id: undefined, quote_id: data.id, sort_order: i }))
        : reqs.map((r, i) => ({ quote_id: data.id, designation_id: r.designation_id, designation_label: r.designation_label, quantity: r.quantity, shift_hours: r.shift_hours, sort_order: i }));
      if (source.length) {
        const clean = source.map((row) => { const { id: _id, ...rest } = row as Record<string, unknown>; return rest; });
        const { error: e2 } = await crmDb.from("crm_quote_lines").insert(clean);
        if (e2) throw new Error(e2.message);
      }
      if (prev) await crmDb.from("crm_quotes").update({ total_monthly: prev.total_monthly }).eq("id", data.id);
      void logActivity({ module: CRM_MODULE, action: "create_quote", entityType: "crm_quotes", entityId: data.id, entityLabel: `${quote_no} v${version}` });
      return String(data.id);
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["crm"] }); setOpenId(id); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create quote"),
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Quotes</h2>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !!lead.converted_contract_id}><Plus className="mr-1 h-4 w-4" /> {quotes.length ? "New version" : "New quote"}</Button>
      </div>
      <div className="space-y-2">
        {quotes.map((q) => (
          <button key={q.id} type="button" onClick={() => setOpenId(q.id)} className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-primary/50">
            <span className="font-mono text-xs">{q.quote_no} v{q.version}</span>
            <span className="tabular-nums">{inr(q.total_monthly)} / mo</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", QUOTE_TONE[q.status])}>{q.status}</span>
          </button>
        ))}
        {quotes.length === 0 && <p className="text-sm text-muted-foreground">No quotes yet.</p>}
      </div>
      {openId && <QuoteEditor quote={quotes.find((q) => q.id === openId) ?? null} lead={lead} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function QuoteEditor({ quote, lead, onClose }: { quote: CrmQuote | null; lead: CrmLead; onClose: () => void }) {
  const qc = useQueryClient();
  const linesQ = useQuery({ queryKey: QK.quoteLines(quote?.id ?? ""), queryFn: () => fetchQuoteLines(quote!.id), enabled: !!quote });
  const desQ = useQuery({ queryKey: ["crm", "designations"], queryFn: fetchDesignations });
  const stagesQ = useQuery({ queryKey: QK.stages, queryFn: fetchStages });
  const [lines, setLines] = useState<Partial<CrmQuoteLine>[]>([]);
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  useEffect(() => { if (linesQ.data) setLines(linesQ.data); }, [linesQ.data]);
  const locked = quote?.status === "signed" || quote?.status === "rejected";
  const total = useMemo(() => lines.reduce((a, l) => a + quoteLineMonthly({ quantity: Number(l.quantity) || 0, billing_rate: Number(l.billing_rate) || 0 }), 0), [lines]);

  const save = useMutation({
    mutationFn: async (status?: CrmQuote["status"]) => {
      if (!quote) return;
      if (!locked) {
        const { error: d } = await crmDb.from("crm_quote_lines").delete().eq("quote_id", quote.id);
        if (d) throw new Error(d.message);
        const rows = lines.map((l, i) => ({
          quote_id: quote.id, designation_id: l.designation_id ?? null,
          designation_label: desQ.data?.find((x) => x.id === l.designation_id)?.name ?? l.designation_label ?? "",
          quantity: Number(l.quantity) || 1, shift_hours: Number(l.shift_hours) || 8, paid_days: Number(l.paid_days) || 26,
          gross_salary: Number(l.gross_salary) || 0, billing_rate: Number(l.billing_rate) || 0, notes: l.notes ?? "", sort_order: i,
        }));
        if (rows.length) { const { error } = await crmDb.from("crm_quote_lines").insert(rows); if (error) throw new Error(error.message); }
      }
      const patch: Record<string, unknown> = { total_monthly: total, valid_until: validUntil || null, notes, updated_at: new Date().toISOString() };
      if (status) {
        patch.status = status;
        if (status === "sent") patch.sent_at = new Date().toISOString();
        if (status === "signed") patch.signed_at = new Date().toISOString();
      }
      const { error } = await crmDb.from("crm_quotes").update(patch).eq("id", quote.id);
      if (error) throw new Error(error.message);
      // Keep the prospect's stage and value in step with the quote.
      const stages = stagesQ.data ?? [];
      const stageKey = status === "sent" ? "quote_sent" : status === "signed" ? "quote_signed" : null;
      const leadPatch: Record<string, unknown> = { estimated_monthly_value: total };
      if (stageKey && stages.some((s) => s.key === stageKey)) leadPatch.stage_key = stageKey;
      await crmDb.from("crm_leads").update(leadPatch).eq("id", lead.id);
      void logActivity({ module: CRM_MODULE, action: status ? `quote_${status}` : "update_quote", entityType: "crm_quotes", entityId: quote.id, entityLabel: `${quote.quote_no} v${quote.version}`, details: { total } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm"] }); toast.success("Quote saved"); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save quote"),
  });
  const upd = (i: number, k: keyof CrmQuoteLine, v: unknown) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{quote ? `${quote.quote_no} v${quote.version}` : "Quote"} <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize", quote && QUOTE_TONE[quote.status])}>{quote?.status}</span></DialogTitle></DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-1.5">Designation</th><th className="p-1.5">Qty</th><th className="p-1.5">Shift</th><th className="p-1.5">Paid days</th><th className="p-1.5">Gross salary</th><th className="p-1.5">Billing rate / head</th><th className="p-1.5 text-right">Monthly</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="p-1.5 min-w-[180px]">
                    <Select disabled={locked} value={l.designation_id ?? undefined} onValueChange={(v) => upd(i, "designation_id", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder={l.designation_label || "Designation"} /></SelectTrigger>
                      <SelectContent>{(desQ.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5 w-16"><Input disabled={locked} className="h-9" value={String(l.quantity ?? "")} onChange={(e) => upd(i, "quantity", e.target.value)} /></td>
                  <td className="p-1.5 w-20"><Input disabled={locked} className="h-9" value={String(l.shift_hours ?? "")} onChange={(e) => upd(i, "shift_hours", e.target.value)} /></td>
                  <td className="p-1.5 w-20"><Input disabled={locked} className="h-9" value={String(l.paid_days ?? 26)} onChange={(e) => upd(i, "paid_days", e.target.value)} /></td>
                  <td className="p-1.5 w-28"><Input disabled={locked} className="h-9" value={String(l.gross_salary ?? "")} onChange={(e) => upd(i, "gross_salary", e.target.value)} /></td>
                  <td className="p-1.5 w-28"><Input disabled={locked} className="h-9" value={String(l.billing_rate ?? "")} onChange={(e) => upd(i, "billing_rate", e.target.value)} /></td>
                  <td className="p-1.5 text-right tabular-nums">{inr(quoteLineMonthly({ quantity: Number(l.quantity) || 0, billing_rate: Number(l.billing_rate) || 0 }))}</td>
                  <td className="p-1.5">{!locked && <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={6} className="p-1.5 text-right font-semibold">Total / month</td><td className="p-1.5 text-right font-semibold tabular-nums">{inr(total)}</td><td /></tr></tfoot>
          </table>
        </div>
        {!locked && <Button variant="outline" size="sm" onClick={() => setLines([...lines, { quantity: 1, shift_hours: 8, paid_days: 26 }])}><Plus className="mr-1 h-4 w-4" /> Add line</Button>}
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Valid until"><Input disabled={locked} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></F>
          <F label="Notes"><Input disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} /></F>
        </div>
        <p className="text-xs text-muted-foreground">The detailed rate card (Basic, DA, allowances, PF, ESIC, reliever, fee) is completed on the contract after conversion.</p>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!locked && <>
            <Button variant="outline" onClick={() => save.mutate(undefined)} disabled={save.isPending}>Save draft</Button>
            <Button variant="outline" onClick={() => save.mutate("rejected")} disabled={save.isPending}><XCircle className="mr-1 h-4 w-4" /> Rejected</Button>
            {quote?.status === "draft" && <Button onClick={() => save.mutate("sent")} disabled={save.isPending || lines.length === 0}><Send className="mr-1 h-4 w-4" /> Mark sent</Button>}
            <Button onClick={() => save.mutate("signed")} disabled={save.isPending || lines.length === 0}><CheckCircle2 className="mr-1 h-4 w-4" /> Mark signed</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Activities({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QK.activities(leadId), queryFn: () => fetchActivities(leadId) });
  const [f, setF] = useState({ activity_type: "call", subject: "", details: "", scheduled_at: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await crmDb.from("crm_activities").insert({
        lead_id: leadId, activity_type: f.activity_type, subject: f.subject.trim(), details: f.details.trim(),
        scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
        completed: !f.scheduled_at || new Date(f.scheduled_at) <= new Date(), created_by: auth.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      if (f.scheduled_at && new Date(f.scheduled_at) > new Date()) {
        await crmDb.from("crm_leads").update({ next_follow_up_at: new Date(f.scheduled_at).toISOString() }).eq("id", leadId);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm"] }); setF({ activity_type: "call", subject: "", details: "", scheduled_at: "" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const label = (t: string) => ACTIVITY_TYPES.find((a) => a.value === t)?.label ?? (t === "stage_change" ? "Stage" : t);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Activity</h2>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select value={f.activity_type} onValueChange={(v) => setF({ ...f, activity_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIVITY_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="datetime-local" aria-label="When" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
        </div>
        <Input placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <Textarea rows={2} placeholder="Details" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
        <Button className="w-full" onClick={() => add.mutate()} disabled={!f.subject.trim() || add.isPending}>Log activity</Button>
        <p className="text-xs text-muted-foreground">A future date schedules it and sets the next follow-up.</p>
      </div>
      <ol className="mt-4 space-y-3 border-l border-border pl-4">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="relative">
            <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full", a.completed ? "bg-primary" : "bg-amber-500")} />
            <div className="text-xs text-muted-foreground">{label(a.activity_type)} · {new Date(a.scheduled_at ?? a.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{!a.completed && " · upcoming"}</div>
            <div className="text-sm font-medium">{a.subject}</div>
            {a.details && <div className="whitespace-pre-wrap text-sm text-muted-foreground">{a.details}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function LostDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (reason: string) => void }) {
  const q = useQuery({ queryKey: QK.lostReasons, queryFn: fetchLostReasons });
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark prospect as lost</DialogTitle></DialogHeader>
        <Select value={reason || undefined} onValueChange={setReason}>
          <SelectTrigger><SelectValue placeholder="Why was it lost?" /></SelectTrigger>
          <SelectContent>{(q.data ?? []).map((r) => <SelectItem key={r.id} value={r.label}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" disabled={!reason} onClick={() => onConfirm(reason)}>Mark lost</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Opt = { id: string; label: string };
async function fetchOpts(table: string, labelCol: string): Promise<Opt[]> {
  const { data, error } = await anyDb.from(table).select(`id,${labelCol}`).eq("enabled", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string>[]).map((r) => ({ id: r.id, label: r[labelCol] }));
}

function nextProspectCode(existing: string[]): string {
  let max = 0;
  for (const c of existing) { const m = c?.match(/PROS-(\d+)/i); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `PROS-${String(max + 1).padStart(4, "0")}`;
}

function ConvertDialog({ lead, onClose, wonKey }: { lead: CrmLead; onClose: () => void; wonKey: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const chain = useOrgUnitChain({ customerId: lead.customer_id, unitId: lead.unit_id, orgName: lead.company_name, city: lead.city, state: lead.state, pincode: lead.pincode, address: lead.address });
  const windowsQ = useQuery({ queryKey: ["crm", "payroll-windows"], queryFn: () => fetchOpts("payroll_windows", "label") });
  const billingQ = useQuery({ queryKey: ["crm", "billing-types"], queryFn: () => fetchOpts("billing_types", "name") });
  const serviceQ = useQuery({ queryKey: ["crm", "service-types"], queryFn: () => fetchOpts("service_types", "name") });
  const quotesQ = useQuery({ queryKey: [...QK.quotes, lead.id], queryFn: () => fetchQuotes(lead.id) });
  const signed = (quotesQ.data ?? []).find((q) => q.status === "signed") ?? (quotesQ.data ?? [])[0];
  const today = new Date().toISOString().slice(0, 10);
  const [c, setC] = useState({ start: today, end: "", window: "", billing: "", service: "", gst: "csgst" });
  const [saving, setSaving] = useState(false);

  async function convert() {
    setSaving(true);
    try {
      const { customerId, unitId } = await chain.commit();
      const { data: codes } = await anyDb.from("client_contracts").select("prospect_code").not("prospect_code", "is", null);
      const prospectCode = nextProspectCode(((codes ?? []) as { prospect_code: string }[]).map((r) => r.prospect_code));
      const { data: auth } = await supabase.auth.getUser();
      const { data: contract, error } = await anyDb.from("client_contracts").insert({
        unit_id: unitId, start_date: c.start || null, end_date: c.end || null, expiry_date: c.end || null, original_start_date: c.start || null,
        description: `From ${lead.lead_code} ${lead.company_name}${signed ? ` · quote ${signed.quote_no} v${signed.version}` : ""}`,
        service_type_id: c.service || null, payroll_window_id: c.window || null, billing_type_id: c.billing || null, gst_option: c.gst,
        record_type: "prospect", prospect_code: prospectCode, status: "inactive", approval_status: "pending", prospect_stage: "new",
        created_by: auth.user?.id ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      // Seed contract posts from the signed quote; the detailed rate card is filled on the contract.
      if (signed) {
        const lines = await fetchQuoteLines(signed.id);
        const rows = lines.filter((l) => l.designation_id).map((l, i) => ({
          contract_id: contract.id, designation_id: l.designation_id, service_type_id: c.service || null,
          quantity: l.quantity, shift_hours: l.shift_hours, gross: l.gross_salary, sort_order: i,
        }));
        if (rows.length) { const { error: e2 } = await anyDb.from("contract_resources").insert(rows); if (e2) throw new Error(e2.message); }
      }
      const { error: e3 } = await crmDb.from("crm_leads").update({
        customer_id: customerId, unit_id: unitId, converted_contract_id: contract.id, converted_at: new Date().toISOString(), stage_key: wonKey,
      }).eq("id", lead.id);
      if (e3) throw new Error(e3.message);
      void logActivity({ module: CRM_MODULE, action: "convert", entityType: "crm_leads", entityId: lead.id, entityLabel: lead.lead_code, details: { contract_id: contract.id, prospect_code: prospectCode, unit_id: unitId } });
      void logActivity({ module: "Client Contracts", action: "create", entityType: "client_contracts", entityId: contract.id, entityLabel: prospectCode, details: { from_lead: lead.lead_code } });
      await qc.invalidateQueries();
      toast.success(`Contract draft ${prospectCode} created — complete the rate card and approve it`);
      onClose();
      navigate({ to: "/admin/contracts/client-contracts", search: { tab: "prospect", status: "pending_approval" } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not convert");
    } finally {
      setSaving(false);
    }
  }

  const sel = (value: string, onChange: (v: string) => void, opts: Opt[], placeholder: string) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Convert {lead.company_name} to a contract</DialogTitle></DialogHeader>
        {chain.view}
        <section className="space-y-3 rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">3. Contract</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Start date"><Input type="date" value={c.start} onChange={(e) => setC({ ...c, start: e.target.value })} /></F>
            <F label="End date"><Input type="date" value={c.end} onChange={(e) => setC({ ...c, end: e.target.value })} /></F>
            <F label="Payroll window">{sel(c.window, (v) => setC({ ...c, window: v }), windowsQ.data ?? [], "Select window")}</F>
            <F label="Billing type">{sel(c.billing, (v) => setC({ ...c, billing: v }), billingQ.data ?? [], "Select billing type")}</F>
            <F label="Service type">{sel(c.service, (v) => setC({ ...c, service: v }), serviceQ.data ?? [], "Select service")}</F>
            <F label="GST">
              <Select value={c.gst} onValueChange={(v) => setC({ ...c, gst: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="csgst">CGST + SGST</SelectItem><SelectItem value="igst">IGST</SelectItem><SelectItem value="none">No GST</SelectItem></SelectContent>
              </Select>
            </F>
          </div>
          <p className="text-xs text-muted-foreground">
            {signed ? `Posts from quote ${signed.quote_no} v${signed.version} (${signed.status}) are copied onto the contract.` : "No quote yet — posts can be added on the contract."} The contract is created as a draft for approval; complete its rate card there.
          </p>
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={convert} disabled={!chain.isComplete || !c.start || !c.window || saving}>{saving ? "Creating…" : "Create contract"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
