import { matchesSearch } from "@/lib/search-match";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { CreatableSelect } from "@/components/CreatableSelect";
import { EmployeePicker } from "@/components/EmployeePicker";
import { confirmAction } from "@/components/ConfirmProvider";
import {
  customerAddress,
  downloadNoticePdf,
  ensureAdvocate,
  ensureParty,
  LEGAL_MASTERS_KEY,
  NOTICE_TEMPLATES,
  useLegalMasters,
} from "@/lib/legal";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
type Notice = {
  id?: string;
  notice_number?: string;
  template: string;
  status: string;
  case_id: string | null;
  party_id: string | null;
  customer_id: string | null;
  employee_id: string | null;
  advocate_id: string | null;
  notice_date: string;
  mode: string;
  to_name: string;
  to_address: string;
  from_name: string;
  from_address: string;
  subject: string;
  body: string;
  demand_amount: number | null;
  deadline_days: number | null;
  sent_on: string | null;
};
const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", replied: "Replied", closed: "Closed" };
const MODES = ["RPAD", "Speed Post", "Registered Post A.D.", "Email", "Hand delivery", "Courier"];

export function NoticesTab({ canEdit, cases }: { canEdit: boolean; cases: { id: string; case_number: string; title: string }[] }) {
  const qc = useQueryClient();
  const m = useLegalMasters();
  const [editing, setEditing] = useState<Notice | null>(null);
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["legal-notices"],
    queryFn: async () => {
      const { data, error } = await db.from("legal_notices").select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });
  const org = m.data?.org;
  const company = org?.company_name || "Radiant Guard Services Pvt. Ltd.";
  const blank = (): Notice => {
    const t = NOTICE_TEMPLATES[0];
    const ctx = { company, toName: "", deadline: 15 };
    return {
    template: "payment_recovery",
    status: "draft",
    case_id: null,
    party_id: null,
    customer_id: null,
    employee_id: null,
    advocate_id: null,
    notice_date: new Date().toISOString().slice(0, 10),
    mode: "RPAD",
    to_name: "",
    to_address: "",
    from_name: company,
    from_address: [org?.corporate_address || org?.registered_address, org?.phone, org?.email].filter(Boolean).join(" · "),
    subject: t.subject(ctx),
    body: t.body(ctx),
    demand_amount: null,
    deadline_days: 15,
    sent_on: null,
    };
  };
  const rows = (list.data ?? []).filter((n) =>
    matchesSearch(q, [n.notice_number, n.to_name, n.subject, n.status]),
  );
  const signer = (n: Notice) => {
    const a = m.data?.advocates.find((x) => x.id === n.advocate_id);
    return a
      ? { signatory: `${a.name}${a.bar_council_no ? ` (${a.bar_council_no})` : ""}`, signatoryLine: `Advocate for ${company}` }
      : { signatory: `For ${company}`, signatoryLine: "Authorised Signatory" };
  };
  const pdf = (n: Notice) =>
    downloadNoticePdf({
      notice_number: n.notice_number ?? "DRAFT",
      notice_date: n.notice_date,
      mode: n.mode,
      to_name: n.to_name,
      to_address: n.to_address,
      from_name: n.from_name,
      from_address: n.from_address,
      subject: n.subject,
      body: n.body,
      ...signer(n),
    });
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Search notice no., recipient, subject…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit && (
          <Button onClick={() => setEditing(blank())}>
            <Plus className="mr-1 h-4 w-4" /> New notice
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((n) => (
          <div key={n.id} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <button data-panel="true" className="min-w-0 flex-1 text-left" onClick={() => setEditing(n)}>
              <div className="truncate font-medium text-foreground">
                <span className="mr-2 text-xs text-muted-foreground">{n.notice_number}</span>
                {n.subject || "Untitled notice"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                To {n.to_name || "—"} · {d(n.notice_date)} · {n.mode}
              </div>
            </button>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", n.status === "draft" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
              {STATUS[n.status]}
            </span>
            <Button size="icon" variant="ghost" aria-label="Download PDF" onClick={() => void pdf(n)}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!list.isLoading && rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No legal notices yet.</div>}
      </div>
      {editing && (
        <NoticeEditor
          initial={editing}
          canEdit={canEdit}
          cases={cases}
          company={company}
          onPdf={pdf}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["legal-notices"] });
            qc.invalidateQueries({ queryKey: LEGAL_MASTERS_KEY });
          }}
        />
      )}
    </div>
  );
}

function NoticeEditor({
  initial,
  canEdit,
  cases,
  company,
  onPdf,
  onClose,
  onSaved,
}: {
  initial: Notice;
  canEdit: boolean;
  cases: { id: string; case_number: string; title: string }[];
  company: string;
  onPdf: (n: Notice) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const m = useLegalMasters();
  const [f, setF] = useState<Notice>(initial);
  const [typedParty, setTypedParty] = useState<string | null>(null);
  const [typedAdvocate, setTypedAdvocate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Notice>(k: K, v: Notice[K]) => setF((p) => ({ ...p, [k]: v }));
  const partyValue = f.customer_id ? `c:${f.customer_id}` : f.party_id ? `p:${f.party_id}` : "";
  const partyOptions = [
    ...(m.data?.customers ?? []).map((c) => ({ value: `c:${c.id}`, label: c.name, hint: `Our client${c.code ? ` · ${c.code}` : ""}${c.billing_state ? ` · ${c.billing_state}` : ""}` })),
    ...(m.data?.parties ?? []).map((p) => ({ value: `p:${p.id}`, label: p.name, hint: `Saved party${p.state ? ` · ${p.state}` : ""}` })),
  ];
  const applyTemplate = (key = f.template, n = f) => {
    const t = NOTICE_TEMPLATES.find((x) => x.key === key) ?? NOTICE_TEMPLATES[0];
    const caseRef = cases.find((c) => c.id === n.case_id)?.case_number;
    const ctx = { company, toName: n.to_name, amount: n.demand_amount, deadline: n.deadline_days, employee: n.to_name, caseRef };
    setF({ ...n, template: key, subject: t.subject(ctx), body: t.body(ctx) });
  };
  const pickParty = (v: string) => {
    setTypedParty(null);
    if (!v) return setF((p) => ({ ...p, customer_id: null, party_id: null }));
    const [kind, id] = v.split(":");
    if (kind === "c") {
      const c = m.data?.customers.find((x) => x.id === id);
      setF((p) => ({ ...p, customer_id: id, party_id: null, to_name: c?.billing_name || c?.name || p.to_name, to_address: c ? customerAddress(c) : p.to_address }));
    } else {
      const pt = m.data?.parties.find((x) => x.id === id);
      setF((p) => ({ ...p, party_id: id, customer_id: null, to_name: pt?.name ?? p.to_name, to_address: [pt?.address, pt?.city, pt?.state].filter(Boolean).join(", ") || p.to_address }));
    }
  };
  const pickEmployee = async (id: string) => {
    set("employee_id", id || null);
    if (!id) return;
    const { data } = await db
      .from("candidates")
      .select("full_name,employee_code,present_address1,present_address2,present_city,present_district,present_state,present_pincode")
      .eq("id", id)
      .maybeSingle();
    if (data)
      setF((p) => ({
        ...p,
        employee_id: id,
        to_name: `${data.full_name}${data.employee_code ? ` (Emp. ID ${data.employee_code})` : ""}`,
        to_address: [data.present_address1, data.present_address2, data.present_city, data.present_district, data.present_state, data.present_pincode].filter(Boolean).join(", "),
      }));
  };
  const save = async (): Promise<Notice | null> => {
    if (!f.to_name.trim()) {
      toast.error("Enter who the notice is to");
      return null;
    }
    setBusy(true);
    try {
      let party_id = f.party_id;
      if (typedParty) party_id = await ensureParty(typedParty, { address: f.to_address });
      let advocate_id = f.advocate_id;
      if (typedAdvocate) advocate_id = await ensureAdvocate(typedAdvocate);
      const { id, notice_number, ...rest } = f;
      void notice_number;
      const payload = { ...rest, party_id, advocate_id, sent_on: f.status === "sent" && !f.sent_on ? new Date().toISOString().slice(0, 10) : f.sent_on };
      const res = id
        ? await db.from("legal_notices").update(payload).eq("id", id).select("*").single()
        : await db.from("legal_notices").insert(payload).select("*").single();
      if (res.error) throw res.error;
      void logActivity({
        module: "Case Desk",
        action: id ? "update" : "create",
        entityType: "legal_notice",
        entityId: res.data.id,
        entityLabel: `${res.data.notice_number} ${payload.subject}`,
      });
      setF(res.data as Notice);
      setTypedParty(null);
      setTypedAdvocate(null);
      onSaved();
      toast.success(`Notice ${res.data.notice_number} saved`);
      return res.data as Notice;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const ro = !canEdit;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{f.notice_number ? `Legal notice ${f.notice_number}` : "New legal notice"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-muted-foreground">Notice type</span>
            <SearchSelect disabled={ro} value={f.template} onChange={(v) => applyTemplate(v)} options={NOTICE_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Date</span>
            <Input disabled={ro} type="date" value={f.notice_date} onChange={(e) => set("notice_date", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Sent by</span>
            <SearchSelect disabled={ro} value={f.mode} onChange={(v) => set("mode", v)} options={MODES.map((x) => ({ value: x, label: x }))} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">Client / party (pick ours to fill details, or type a new name)</span>
            <CreatableSelect
              disabled={ro}
              value={partyValue}
              label={typedParty}
              options={partyOptions}
              onChange={pickParty}
              onCreate={(t) => {
                setTypedParty(t);
                setF((p) => ({ ...p, customer_id: null, party_id: null, to_name: t }));
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Or an employee</span>
            <EmployeePicker value={f.employee_id ?? ""} onChange={(v) => void pickEmployee(v)} placeholder="Search employee" />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">To (name) *</span>
            <Input disabled={ro} value={f.to_name} onChange={(e) => set("to_name", e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">To (address)</span>
            <Input disabled={ro} value={f.to_address} onChange={(e) => set("to_address", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Letterhead name</span>
            <Input disabled={ro} value={f.from_name} onChange={(e) => set("from_name", e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">Letterhead address / contact</span>
            <Input disabled={ro} value={f.from_address} onChange={(e) => set("from_address", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Signed by advocate</span>
            <CreatableSelect
              disabled={ro}
              value={f.advocate_id ?? ""}
              label={typedAdvocate}
              placeholder="Company signatory"
              options={(m.data?.advocates ?? []).map((a) => ({ value: a.id, label: a.name, hint: a.firm ?? undefined }))}
              onChange={(v) => {
                setTypedAdvocate(null);
                set("advocate_id", v || null);
              }}
              onCreate={(t) => {
                setTypedAdvocate(t);
                set("advocate_id", null);
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Amount demanded (₹)</span>
            <Input disabled={ro} type="number" value={f.demand_amount ?? ""} onChange={(e) => set("demand_amount", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Days to comply</span>
            <Input disabled={ro} type="number" value={f.deadline_days ?? ""} onChange={(e) => set("deadline_days", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Linked case</span>
            <SearchSelect
              disabled={ro}
              value={f.case_id ?? ""}
              onChange={(v) => set("case_id", v || null)}
              placeholder="None"
              options={[{ value: "", label: "None" }, ...cases.map((c) => ({ value: c.id, label: `${c.case_number} · ${c.title}` }))]}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Status</span>
            <SearchSelect disabled={ro} value={f.status} onChange={(v) => set("status", v)} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} />
          </label>
          <div className="flex items-end">
            {canEdit && (
              <Button type="button" variant="outline" className="w-full" onClick={() => applyTemplate()}>
                Fill text from notice type
              </Button>
            )}
          </div>
          <label className="space-y-1 sm:col-span-3">
            <span className="text-muted-foreground">Subject</span>
            <Input disabled={ro} value={f.subject} onChange={(e) => set("subject", e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-3">
            <span className="text-muted-foreground">Notice text (edit freely; blank lines separate paragraphs)</span>
            <Textarea disabled={ro} rows={16} className="font-serif text-sm leading-relaxed" value={f.body} onChange={(e) => set("body", e.target.value)} />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const saved = canEdit ? await save() : f;
              if (saved) await onPdf(saved);
            }}
          >
            <Download className="mr-1 h-4 w-4" /> {canEdit ? "Save & download PDF" : "Download PDF"}
          </Button>
          {canEdit && (
            <Button
              data-no-confirm="true"
              disabled={busy}
              onClick={async () => {
                if (await confirmAction({ title: "Save this notice?", confirmText: "Yes, save" })) await save();
              }}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
