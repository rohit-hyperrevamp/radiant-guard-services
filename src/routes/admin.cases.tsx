import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Eye, FileUp, X, Paperclip, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { supabase } from "@/integrations/supabase/client";
import { useFileViewer } from "@/components/FileViewer";
import { useCurrentPermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/PriorityBadge";

export const Route = createFileRoute("/admin/cases")({
  head: () => ({
    meta: [
      { title: "Case Desk | Radiant Guard Services" },
      { name: "description", content: "Log and track legal cases, hearings, penalties and documents." },
      { property: "og:title", content: "Case Desk | Radiant Guard Services" },
      { property: "og:description", content: "Log and track legal cases, hearings, penalties and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { view?: "upcoming"; case?: string } => ({
    view: s.view === "upcoming" ? ("upcoming" as const) : undefined,
    case: typeof s.case === "string" ? s.case : undefined,
  }),
  component: CaseDesk,
});

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Case = {
  id: string; case_number: string; title: string; case_type_id: string | null; status: string; priority: string;
  description: string; employee_id: string | null; unit_id: string | null; opposing_party: string | null;
  court_or_authority: string | null; reference_no: string | null; filed_on: string | null; next_hearing_on: string | null; next_hearing_time?: string | null;
  amount_involved: number | null; owner_id: string | null; outcome: string | null; created_at: string; updated_at: string;
};
const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-accent/15 text-accent" },
  in_progress: { label: "In progress", cls: "bg-primary/10 text-primary" },
  on_hold: { label: "On hold", cls: "bg-muted text-muted-foreground" },
  closed: { label: "Closed", cls: "bg-primary/20 text-primary" },
};
const PRIORITY = ["low", "medium", "high", "critical"];
const d = (v?: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");
const daysTo = (v: string) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(v + "T00:00:00").getTime() - t.getTime()) / 86400000); };
const tm = (t?: string | null) => (t ? format(new Date(`2000-01-01T${t}`), "h:mm a") : "");
function Countdown({ date, time, closed }: { date: string | null; time?: string | null; closed?: boolean }) {
  if (!date || closed) return null;
  const n = daysTo(date);
  const label = n < 0 ? `${-n}d overdue` : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `in ${n} days`;
  const cls = n < 0 ? "bg-destructive/15 text-destructive" : n <= 3 ? "bg-destructive/10 text-destructive" : n <= 7 ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", cls)}><CalendarClock className="h-3 w-3" />{label}{time ? ` · ${tm(time)}` : ""}</span>;
}

function useLookups() {
  return useQuery({
    queryKey: ["case-lookups"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [t, p, u] = await Promise.all([
        db.from("legal_case_types").select("id,name,is_active").order("sort_order"),
        db.from("candidates").select("id,full_name,employee_code").neq("status", "inactive").order("full_name").limit(5000),
        db.from("units").select("id,name,unit_code").order("name").limit(5000),
      ]);
      return {
        types: (t.data ?? []) as { id: string; name: string; is_active: boolean }[],
        people: (p.data ?? []) as { id: string; full_name: string; employee_code: string | null }[],
        units: (u.data ?? []) as { id: string; name: string; unit_code: string | null }[],
      };
    },
  });
}

function CaseDesk() {
  const { can } = useCurrentPermissions();
  const canEdit = can("legal_cases", "edit");
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [prio, setPrio] = useState("all");
  const [q, setQ] = useState("");
  const search = Route.useSearch();
  const [upcoming, setUpcoming] = useState(search.view === "upcoming");
  const [sort, setSort] = useState(search.view === "upcoming" ? "hearing" : "updated");
  const [editing, setEditing] = useState<Partial<Case> | null>(null);
  const [openId, setOpenId] = useState<string | null>(search.case ?? null);
  const lk = useLookups();
  const casesQ = useQuery({
    queryKey: ["legal-cases"],
    queryFn: async () => {
      const { data, error } = await db.from("legal_cases").select("*").order("updated_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as Case[];
    },
  });
  const typeName = (id: string | null) => lk.data?.types.find((t) => t.id === id)?.name ?? "—";
  const personName = (id: string | null) => lk.data?.people.find((p) => p.id === id)?.full_name ?? "—";
  const unitName = (id: string | null) => lk.data?.units.find((u) => u.id === id)?.name ?? "—";
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const PR: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const out = (casesQ.data ?? []).filter((c) =>
      (!upcoming || (c.status !== "closed" && !!c.next_hearing_on && daysTo(c.next_hearing_on) >= 0)) &&
      (status === "all" || c.status === status) && (prio === "all" || c.priority === prio) && (type === "all" || c.case_type_id === type) &&
      (!s || `${c.case_number} ${c.title} ${typeName(c.case_type_id)} ${c.priority} ${c.opposing_party ?? ""} ${c.reference_no ?? ""} ${personName(c.employee_id)} ${unitName(c.unit_id)}`.toLowerCase().includes(s)));
    if (sort === "hearing") out.sort((a, b) => (a.next_hearing_on ?? "9999") .localeCompare(b.next_hearing_on ?? "9999") || (a.next_hearing_time ?? "").localeCompare(b.next_hearing_time ?? ""));
    else if (sort === "priority") out.sort((a, b) => (PR[a.priority] ?? 9) - (PR[b.priority] ?? 9));
    else if (sort === "created") out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casesQ.data, status, prio, type, q, lk.data, upcoming, sort]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["legal-cases"] }); qc.invalidateQueries({ queryKey: ["case-summary"] }); };

  return (
    <div className="space-y-4">
      <PageHeader title="Case Desk" description="Every legal case, hearing, penalty and its documents in one place." crumbs={[{ label: "Case Desk" }]}
        actions={canEdit ? <Button onClick={() => setEditing({ status: "open", priority: "medium" })}><Plus className="mr-1 h-4 w-4" />New case</Button> : undefined} />
      {(() => {
        const all = casesQ.data ?? [];
        const by = (k: "status" | "priority", v: string) => all.filter((c) => c[k] === v).length;
        const statusCards = [
          { label: "Total cases", v: all.length, on: status === "all" && prio === "all" && !upcoming, click: () => { setStatus("all"); setPrio("all"); setUpcoming(false); } },
          { label: "Upcoming dates", v: all.filter((c) => c.status !== "closed" && c.next_hearing_on && daysTo(c.next_hearing_on) >= 0).length, on: upcoming, click: () => { const on = !upcoming; setUpcoming(on); if (on) setSort("hearing"); } },
          ...Object.entries(STATUS).map(([k, s]) => ({ label: s.label, v: by("status", k), on: status === k, click: () => setStatus(status === k ? "all" : k) })),
        ];
        const prioCards = [...PRIORITY].reverse().map((p) => ({ label: p[0].toUpperCase() + p.slice(1), key: p, v: by("priority", p), openV: all.filter((c) => c.priority === p && c.status !== "closed").length }));
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {statusCards.map((c) => (
                <button key={c.label} onClick={c.click} className={cn("rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/50", c.on && "ring-2 ring-primary")}>
                  <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{c.v}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {prioCards.map((c) => (
                <button key={c.key} onClick={() => setPrio(prio === c.key ? "all" : c.key)} className={cn("rounded-xl border border-border bg-card p-3 text-left transition hover:bg-muted/50", prio === c.key && "ring-2 ring-primary")}>
                  <div className="flex items-center justify-between gap-2"><PriorityBadge p={c.key} /><span className="text-[11px] text-muted-foreground">{c.openV} not closed</span></div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{c.v}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search case name, category, party, employee, client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <SearchSelect className="sm:w-48" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...Object.entries(STATUS).map(([v, s]) => ({ value: v, label: s.label }))]} />
        <SearchSelect className="sm:w-40" value={prio} onChange={setPrio} options={[{ value: "all", label: "All priorities" }, ...PRIORITY.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))]} />
        <SearchSelect className="sm:w-52" value={sort} onChange={setSort} options={[{ value: "updated", label: "Sort: Recently updated" }, { value: "hearing", label: "Sort: Next case date" }, { value: "priority", label: "Sort: Priority" }, { value: "created", label: "Sort: Newest first" }]} />
        <SearchSelect className="sm:w-56" value={type} onChange={setType} options={[{ value: "all", label: "All case types" }, ...(lk.data?.types ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((c) => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-0 hover:bg-accent/5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{c.case_number}</span>
                <span className="truncate font-medium text-foreground">{c.title}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {typeName(c.case_type_id)} · {c.employee_id ? personName(c.employee_id) : unitName(c.unit_id)} · Next date {d(c.next_hearing_on)}{c.next_hearing_time ? ` ${tm(c.next_hearing_time)}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5"><Countdown date={c.next_hearing_on} time={c.next_hearing_time} closed={c.status === "closed"} /><PriorityBadge p={c.priority} />
            <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", STATUS[c.status]?.cls)}>{STATUS[c.status]?.label}</span></div>
          </button>
        ))}
        {!casesQ.isLoading && rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No cases found.</div>}
      </div>
      {editing && <CaseForm initial={editing} lk={lk.data} onClose={() => setEditing(null)} onSaved={refresh} />}
      {openId && (() => {
        const c = casesQ.data?.find((x) => x.id === openId);
        return c ? <CaseDetail c={c} canEdit={canEdit} canDelete={can("legal_cases", "delete")} typeName={typeName} personName={personName} unitName={unitName}
          onEdit={() => { setEditing(c); setOpenId(null); }} onClose={() => setOpenId(null)} onChanged={refresh} /> : null;
      })()}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

function CaseForm({ initial, lk, onClose, onSaved }: { initial: Partial<Case>; lk?: ReturnType<typeof useLookups>["data"]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Case>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Case, v: unknown) => setF((p) => ({ ...p, [k]: v === "" ? null : v }));
  const save = async () => {
    if (!f.title?.trim()) return toast.error("Enter a case title");
    setBusy(true);
    const payload = {
      title: f.title.trim(), case_type_id: f.case_type_id ?? null, status: f.status ?? "open", priority: f.priority ?? "medium",
      description: f.description ?? "", employee_id: f.employee_id ?? null, unit_id: f.unit_id ?? null, opposing_party: f.opposing_party ?? null,
      court_or_authority: f.court_or_authority ?? null, reference_no: f.reference_no ?? null, filed_on: f.filed_on ?? null,
      next_hearing_on: f.next_hearing_on || null, next_hearing_time: f.next_hearing_on ? (f.next_hearing_time || null) : null, amount_involved: f.amount_involved ?? null, owner_id: f.owner_id ?? null, outcome: f.outcome ?? null,
      closed_at: f.status === "closed" ? new Date().toISOString() : null,
    };
    const res = f.id ? await db.from("legal_cases").update(payload).eq("id", f.id).select("id,case_number").single()
      : await db.from("legal_cases").insert(payload).select("id,case_number").single();
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    if (f.id && initial.status !== payload.status) await db.from("legal_case_notes").insert({ case_id: f.id, kind: "status", note: `Status changed to ${STATUS[payload.status].label}` });
    void logActivity({ module: "Case Desk", action: f.id ? "update" : "create", entityType: "legal_case", entityId: res.data.id, entityLabel: `${res.data.case_number} ${payload.title}`, details: payload });
    toast.success(f.id ? "Case updated" : `Case ${res.data.case_number} created`);
    onSaved(); onClose();
  };
  const people = (lk?.people ?? []).map((p) => ({ value: p.id, label: p.full_name, hint: p.employee_code ?? undefined }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? `Edit ${f.case_number}` : "New case"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Case title *"><Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field></div>
          <Field label="Case type"><SearchSelect value={f.case_type_id ?? ""} onChange={(v) => set("case_type_id", v)} placeholder="Select type" options={(lk?.types ?? []).filter((t) => t.is_active || t.id === f.case_type_id).map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="Status"><SearchSelect value={f.status ?? "open"} onChange={(v) => set("status", v)} options={Object.entries(STATUS).map(([v, s]) => ({ value: v, label: s.label }))} /></Field>
          <Field label="Priority"><SearchSelect value={f.priority ?? "medium"} onChange={(v) => set("priority", v)} options={PRIORITY.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} /></Field>
          <Field label="Handled by"><SearchSelect value={f.owner_id ?? ""} onChange={(v) => set("owner_id", v)} placeholder="Select person" options={people} /></Field>
          <Field label="Employee involved"><SearchSelect value={f.employee_id ?? ""} onChange={(v) => set("employee_id", v)} placeholder="Optional" options={people} /></Field>
          <Field label="Client / site"><SearchSelect value={f.unit_id ?? ""} onChange={(v) => set("unit_id", v)} placeholder="Optional" options={(lk?.units ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.unit_code ?? undefined }))} /></Field>
          <Field label="Opposite party"><Input value={f.opposing_party ?? ""} onChange={(e) => set("opposing_party", e.target.value)} /></Field>
          <Field label="Court / authority"><Input value={f.court_or_authority ?? ""} onChange={(e) => set("court_or_authority", e.target.value)} /></Field>
          <Field label="Reference / notice no."><Input value={f.reference_no ?? ""} onChange={(e) => set("reference_no", e.target.value)} /></Field>
          <Field label="Amount involved (₹)"><Input type="number" value={f.amount_involved ?? ""} onChange={(e) => set("amount_involved", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Filed / received on"><Input type="date" value={f.filed_on ?? ""} onChange={(e) => set("filed_on", e.target.value)} /></Field>
          <Field label="Next case date"><Input type="date" value={f.next_hearing_on ?? ""} onChange={(e) => set("next_hearing_on", e.target.value)} /></Field>
          <Field label="Time (optional)"><Input type="time" value={f.next_hearing_time?.slice(0, 5) ?? ""} onChange={(e) => set("next_hearing_time", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Details"><Textarea rows={4} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Outcome / resolution"><Textarea rows={2} value={f.outcome ?? ""} onChange={(e) => set("outcome", e.target.value)} /></Field></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save case"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseDetail({ c, canEdit, canDelete, typeName, personName, unitName, onEdit, onClose, onChanged }: {
  c: Case; canEdit: boolean; canDelete: boolean; typeName: (id: string | null) => string; personName: (id: string | null) => string;
  unitName: (id: string | null) => string; onEdit: () => void; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const extra = useQuery({
    queryKey: ["legal-case", c.id],
    queryFn: async () => {
      const [docs, notes] = await Promise.all([
        db.from("legal_case_documents").select("*").eq("case_id", c.id).order("created_at", { ascending: false }),
        db.from("legal_case_notes").select("*").eq("case_id", c.id).order("created_at", { ascending: false }),
      ]);
      return { docs: (docs.data ?? []) as { id: string; path: string; file_name: string; title: string | null; uploaded_by: string | null; created_at: string }[],
        notes: (notes.data ?? []) as { id: string; kind: string; note: string; author_id: string | null; created_at: string }[] };
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["legal-case", c.id] });
  const [pending, setPending] = useState<{ file: File; title: string }[] | null>(null);
  const [nextDate, setNextDate] = useState(c.next_hearing_on ?? "");
  const [nextTime, setNextTime] = useState(c.next_hearing_time?.slice(0, 5) ?? "");
  const saveNext = async () => {
    const { error } = await db.from("legal_cases").update({ next_hearing_on: nextDate || null, next_hearing_time: nextDate ? (nextTime || null) : null }).eq("id", c.id);
    if (error) return toast.error(error.message);
    await db.from("legal_case_notes").insert({ case_id: c.id, kind: "hearing", note: nextDate ? `Next case date set to ${d(nextDate)}${nextTime ? ` at ${tm(nextTime)}` : ""}` : "Next case date cleared" });
    void logActivity({ module: "Case Desk", action: "update", entityType: "legal_case", entityId: c.id, entityLabel: c.case_number, details: { next_hearing_on: nextDate, next_hearing_time: nextTime } });
    toast.success("Next case date saved; Legal and Leadership are notified"); onChanged(); reload();
  };
  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    const add = Array.from(files).map((file) => ({ file, title: file.name.replace(/\.[^.]+$/, "") }));
    setPending((p) => [...(p ?? []), ...add]);
  };
  const upload = async () => {
    if (!pending?.length) return;
    if (pending.some((x) => !x.title.trim())) return toast.error("Enter a name for every document");
    setBusy(true);
    for (const { file, title } of pending) {
      const path = `${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from("legal-docs").upload(path, file, { contentType: file.type || undefined });
      if (up.error) { setBusy(false); return toast.error(`Upload failed: ${up.error.message}`); }
      await db.from("legal_case_documents").insert({ case_id: c.id, path, file_name: file.name, title: title.trim() });
      void logActivity({ module: "Case Desk", action: "create", entityType: "legal_case_document", entityId: c.id, entityLabel: `${c.case_number} · ${title.trim()}` });
    }
    setBusy(false); setPending(null); toast.success("Documents saved"); reload();
  };
  const viewFile = useFileViewer();
  const openDoc = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("legal-docs").createSignedUrl(path, 3600);
    if (error || !data) return toast.error("Could not open file");
    viewFile({ url: data.signedUrl, name });
  };
  const addNote = async () => {
    if (!note.trim()) return;
    const { error } = await db.from("legal_case_notes").insert({ case_id: c.id, note: note.trim() });
    if (error) return toast.error(error.message);
    setNote(""); reload();
  };
  const setStatus = async (s: string) => {
    const { error } = await db.from("legal_cases").update({ status: s, closed_at: s === "closed" ? new Date().toISOString() : null }).eq("id", c.id);
    if (error) return toast.error(error.message);
    await db.from("legal_case_notes").insert({ case_id: c.id, kind: "status", note: `Status changed to ${STATUS[s].label}` });
    void logActivity({ module: "Case Desk", action: "update", entityType: "legal_case", entityId: c.id, entityLabel: c.case_number, details: { status: s } });
    onChanged(); reload();
  };
  const del = async () => {
    if (!confirm(`Delete case ${c.case_number}? This cannot be undone.`)) return;
    const { error } = await db.from("legal_cases").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    void logActivity({ module: "Case Desk", action: "delete", entityType: "legal_case", entityId: c.id, entityLabel: `${c.case_number} ${c.title}` });
    onChanged(); onClose();
  };
  const info: Array<[string, string]> = [
    ["Type", typeName(c.case_type_id)], ["Handled by", personName(c.owner_id)],
    ["Employee", personName(c.employee_id)], ["Client / site", unitName(c.unit_id)], ["Opposite party", c.opposing_party ?? "—"],
    ["Court / authority", c.court_or_authority ?? "—"], ["Reference no.", c.reference_no ?? "—"],
    ["Amount", c.amount_involved != null ? `₹${Number(c.amount_involved).toLocaleString("en-IN")}` : "—"],
    ["Filed on", d(c.filed_on)], ["Next case date", c.next_hearing_on ? `${d(c.next_hearing_on)}${c.next_hearing_time ? ` ${tm(c.next_hearing_time)}` : ""}` : "—"], ["Last updated", d(c.updated_at)],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6">{c.case_number} · {c.title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge p={c.priority} />
            {Object.entries(STATUS).map(([k, s]) => (
              <button key={k} disabled={!canEdit || c.status === k} onClick={() => setStatus(k)}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-border", c.status === k ? s.cls : "text-muted-foreground hover:bg-muted")}>{s.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-3">
            {info.map(([k, v]) => <div key={k}><div className="text-muted-foreground">{k}</div><div className="capitalize-first">{v}</div></div>)}
          </div>
          {canEdit && c.status !== "closed" && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium"><CalendarClock className="h-4 w-4 text-primary" />Next case date</div>
              <Input type="date" className="h-8 w-40" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              <Input type="time" className="h-8 w-28" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
              <Button size="sm" onClick={saveNext}>Save date</Button>
              <Countdown date={c.next_hearing_on} time={c.next_hearing_time} />
            </div>
          )}
          {c.description && <p className="whitespace-pre-wrap">{c.description}</p>}
          {c.outcome && <p className="whitespace-pre-wrap rounded-lg bg-primary/5 p-2 text-xs"><b>Outcome:</b> {c.outcome}</p>}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-medium">Documents</span>
              {canEdit && (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                  <FileUp className="h-3.5 w-3.5" />Add documents
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            {pending && pending.length > 0 && (
              <div className="mb-2 space-y-1.5 rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Name each document, then save.</div>
                {pending.map((x, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-8 flex-1" placeholder="Document name (e.g. Court notice)" value={x.title} onChange={(e) => setPending((p) => p!.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
                    <span className="max-w-[35%] truncate text-[11px] text-muted-foreground">{x.file.name}</span>
                    <button onClick={() => setPending((p) => p!.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                ))}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                  <Button size="sm" disabled={busy} onClick={upload}>{busy ? "Uploading…" : `Save ${pending.length} document${pending.length > 1 ? "s" : ""}`}</Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              {(extra.data?.docs ?? []).map((doc) => (
                <button key={doc.id} onClick={() => openDoc(doc.path, doc.title || doc.file_name)} className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted">
                  <Paperclip className="h-3.5 w-3.5" /><span className="flex-1 truncate"><span className="font-medium">{doc.title || doc.file_name}</span>{doc.title && <span className="ml-1.5 text-muted-foreground">{doc.file_name}</span>}</span><span className="text-muted-foreground">{d(doc.created_at)}</span><Eye className="h-3.5 w-3.5 text-primary" />
                </button>
              ))}
              {extra.data?.docs.length === 0 && <div className="text-xs text-muted-foreground">No documents yet.</div>}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-medium">Timeline</div>
            {canEdit && (
              <div className="mb-2 flex gap-2"><Input placeholder="Add an update, hearing note…" value={note} onChange={(e) => setNote(e.target.value)} /><Button size="sm" onClick={addNote}>Add</Button></div>
            )}
            <div className="space-y-1.5">
              {(extra.data?.notes ?? []).map((n) => (
                <div key={n.id} className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                  <div>{n.note}</div>
                  <div className="text-muted-foreground">{personName(n.author_id)} · {format(new Date(n.created_at), "dd MMM yyyy, h:mm a")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          {canDelete && <Button variant="ghost" onClick={del}>Delete</Button>}
          {canEdit && <Button variant="outline" onClick={onEdit}>Edit details</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
