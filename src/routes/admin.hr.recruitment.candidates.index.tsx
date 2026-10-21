import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ScrollingText } from "@/components/ScrollingText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv-export";
import { logActivity } from "@/lib/activity-log";
import {
  fetchCandidates, fetchOpenings, inr, LOST, PAGE_SIZE, PIPELINE, QK, recDb, REC_MODULE, SOURCES, STAGES,
  stageLabel, stageTone, uploadResume, type RecCandidate,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

type Search = { stage?: string; q?: string };

export const Route = createFileRoute("/admin/hr/recruitment/candidates/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    stage: typeof s.stage === "string" ? s.stage : "",
    q: typeof s.q === "string" ? s.q : "",
  }),
  head: () => ({
    meta: [
      { title: "Recruitment Candidates — Radiant" },
      { name: "description", content: "All staff-hiring candidates, their stage, opening and interviews." },
      { property: "og:title", content: "Recruitment Candidates — Radiant" },
      { property: "og:description", content: "All staff-hiring candidates, their stage, opening and interviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandidatesPage,
});

function matchStage(c: RecCandidate, f: string) {
  if (!f) return true;
  if (f === "open") return c.stage === "new" || c.stage === "screening";
  if (f === "pipeline") return PIPELINE.includes(c.stage);
  if (f === "lost") return LOST.includes(c.stage);
  return c.stage === f;
}

function CandidatesPage() {
  const { stage = "", q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/hr/recruitment/candidates/" });
  const cq = useQuery({ queryKey: QK.candidates, queryFn: fetchCandidates });
  const oq = useQuery({ queryKey: QK.openings, queryFn: fetchOpenings });
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const openingTitle = new Map((oq.data ?? []).map((o) => [o.id, o.title]));

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (cq.data ?? []).filter((c) => matchStage(c, stage) && (!t || `${c.full_name} ${c.code} ${c.mobile} ${c.email}`.toLowerCase().includes(t)));
  }, [cq.data, stage, q]);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const setSearch = (patch: Search) => { setPage(0); navigate({ search: (p: Search) => ({ ...p, ...patch }) }); };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Recruitment"
        title="Candidates"
        description={`${rows.length} candidate${rows.length === 1 ? "" : "s"}`}
        icon={Users}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCsv("recruitment-candidates", rows.map((c) => ({
              code: c.code, name: c.full_name, mobile: c.mobile, email: c.email, opening: c.opening_id ? openingTitle.get(c.opening_id) ?? "" : "",
              stage: stageLabel(c.stage), rounds: `${c.rounds_cleared}/${c.total_rounds}`, source: c.source, experience: c.experience_years,
              current_ctc: c.current_ctc, expected_ctc: c.expected_ctc, notice_days: c.notice_days, added: c.created_at.slice(0, 10),
            })))}><Download className="mr-1 h-4 w-4" />CSV</Button>
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />Add candidate</Button>
          </div>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, code, mobile, email" defaultValue={q} onChange={(e) => setSearch({ q: e.target.value })} />
        </div>
        <Select value={stage || "all"} onValueChange={(v) => setSearch({ stage: v === "all" ? "" : v })}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="open">Open (new + screening)</SelectItem>
            <SelectItem value="pipeline">In pipeline</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Candidate</th><th className="p-3">Opening</th><th className="p-3">Stage</th><th className="p-3">Rounds</th><th className="p-3">Expected CTC</th><th className="p-3">Added</th><th className="p-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cq.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!cq.isLoading && pageRows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No candidates.</td></tr>}
            {pageRows.map((c) => (
              <tr key={c.id} role="link" tabIndex={0} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate({ to: "/admin/hr/recruitment/candidates/$recId", params: { recId: c.id } })} onKeyDown={(e) => { if (e.key === "Enter") navigate({ to: "/admin/hr/recruitment/candidates/$recId", params: { recId: c.id } }); }}>
                <td className="p-3">
                   <Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: c.id }} className="block font-medium hover:text-accent"><ScrollingText text={c.full_name} /></Link>
                  <div className="text-xs text-muted-foreground">{c.code} · {c.mobile}</div>
                </td>
                 <td className="p-3"><ScrollingText text={c.opening_id ? openingTitle.get(c.opening_id) : null} /></td>
                <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", stageTone(c.stage))}>{stageLabel(c.stage)}</span></td>
                <td className="p-3 tabular-nums">{c.rounds_cleared}/{c.total_rounds}</td>
                <td className="p-3 tabular-nums">{inr(c.expected_ctc)}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                <td className="p-3 text-right"><Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}><Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: c.id }}>View</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>

      <AddCandidateDialog open={adding} onOpenChange={setAdding} openings={oq.data ?? []} />
    </div>
  );
}

function AddCandidateDialog({ open, onOpenChange, openings }: { open: boolean; onOpenChange: (v: boolean) => void; openings: { id: string; title: string; status: string; rec_opening_rounds?: unknown[] }[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const blank = { full_name: "", mobile: "", email: "", current_location: "", experience_years: "", current_ctc: "", expected_ctc: "", notice_days: "", source: "", referred_by: "", opening_id: "", notes: "" };
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.full_name.trim()) return toast.error("Enter the candidate's name");
    if (f.mobile && !/^\d{10}$/.test(f.mobile)) return toast.error("Mobile must be 10 digits");
    if (!f.opening_id) return toast.error("Pick the opening they applied for");
    setBusy(true);
    try {
      const op = openings.find((o) => o.id === f.opening_id);
      const total = Math.max(1, Math.min(3, op?.rec_opening_rounds?.length || 1));
      const { data, error } = await recDb.from("rec_candidates").insert({
        full_name: f.full_name.trim(), mobile: f.mobile, email: f.email.trim(), current_location: f.current_location.trim(),
        experience_years: Number(f.experience_years || 0), current_ctc: Number(f.current_ctc || 0), expected_ctc: Number(f.expected_ctc || 0),
        notice_days: Number(f.notice_days || 0), source: f.source, referred_by: f.referred_by.trim(), opening_id: f.opening_id,
        notes: f.notes, total_rounds: total,
      }).select("id,code").single();
      if (error) throw error;
      if (file) await uploadResume(data.id, file);
      void logActivity({ module: REC_MODULE, action: "create", entityType: "rec_candidates", entityId: data.id, entityLabel: `${data.code} ${f.full_name}` });
      await qc.invalidateQueries({ queryKey: ["rec"] });
      toast.success(`${data.code} added`);
      setF(blank); setFile(null); onOpenChange(false);
      navigate({ to: "/admin/hr/recruitment/candidates/$recId", params: { recId: data.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Full name *"><Input value={f.full_name} onChange={set("full_name")} /></F>
          <F label="Applied for (opening) *">
            <Select value={f.opening_id} onValueChange={(v) => setF({ ...f, opening_id: v })}>
              <SelectTrigger><SelectValue placeholder={openings.length ? "Select opening" : "Create an opening first"} /></SelectTrigger>
              <SelectContent>{openings.filter((o) => o.status === "open").map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Mobile"><Input inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "") })} /></F>
          <F label="Email"><Input type="email" value={f.email} onChange={set("email")} /></F>
          <F label="Current location"><Input value={f.current_location} onChange={set("current_location")} /></F>
          <F label="Experience (years)"><Input type="number" min={0} value={f.experience_years} onChange={set("experience_years")} /></F>
          <F label="Current CTC (monthly ₹)"><Input type="number" min={0} value={f.current_ctc} onChange={set("current_ctc")} /></F>
          <F label="Expected CTC (monthly ₹)"><Input type="number" min={0} value={f.expected_ctc} onChange={set("expected_ctc")} /></F>
          <F label="Notice period (days)"><Input type="number" min={0} value={f.notice_days} onChange={set("notice_days")} /></F>
          <F label="Source">
            <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Referred by"><Input value={f.referred_by} onChange={set("referred_by")} /></F>
          <F label="Resume (PDF/DOC/image)"><Input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></F>
          <div className="sm:col-span-2"><F label="Notes"><Textarea rows={3} value={f.notes} onChange={set("notes")} /></F></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Add candidate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
