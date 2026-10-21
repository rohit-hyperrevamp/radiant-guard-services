import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ScrollingText } from "@/components/ScrollingText";
import { EmployeePicker } from "@/components/EmployeePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity-log";
import { employeeNames, fetchCandidates, fetchMasters, fetchOpenings, inr, QK, recDb, REC_MODULE, type RecOpening } from "@/lib/recruitment";

export const Route = createFileRoute("/admin/hr/recruitment/openings")({
  head: () => ({
    meta: [
      { title: "Recruitment Openings — Radiant" },
      { name: "description", content: "Staff openings with positions, salary range and interview rounds." },
      { property: "og:title", content: "Recruitment Openings — Radiant" },
      { property: "og:description", content: "Staff openings with positions, salary range and interview rounds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpeningsPage,
});

function OpeningsPage() {
  const oq = useQuery({ queryKey: QK.openings, queryFn: fetchOpenings });
  const cq = useQuery({ queryKey: QK.candidates, queryFn: fetchCandidates });
  const mq = useQuery({ queryKey: QK.masters, queryFn: fetchMasters, staleTime: 600_000 });
  const openings = oq.data ?? [];
  const namesQ = useQuery({
    queryKey: ["rec", "opening-names", openings.length],
    queryFn: () => employeeNames(openings.flatMap((o) => (o.rec_opening_rounds ?? []).map((r) => r.default_interviewer_id ?? ""))),
  });
  const [edit, setEdit] = useState<RecOpening | "new" | null>(null);
  const dept = new Map((mq.data?.departments ?? []).map((d) => [d.id, d.name]));
  const desig = new Map((mq.data?.designations ?? []).map((d) => [d.id, d.name]));
  const countFor = (id: string) => (cq.data ?? []).filter((c) => c.opening_id === id);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Recruitment" title="Openings" description="Set up each post and how many interview rounds it needs." icon={Briefcase}
        actions={<Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New opening</Button>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {oq.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!oq.isLoading && openings.length === 0 && <p className="text-sm text-muted-foreground">No openings yet. Create one to start adding candidates.</p>}
        {openings.map((o) => {
          const cs = countFor(o.id);
          const filled = cs.filter((c) => c.stage === "onboarded").length;
          const rounds = [...(o.rec_opening_rounds ?? [])].sort((a, b) => a.round_no - b.round_no);
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <ScrollingText text={o.title} className="text-sm font-semibold" />
                  <ScrollingText text={[o.designation_id && desig.get(o.designation_id), o.department_id && dept.get(o.department_id)].filter(Boolean).join(" · ")} className="text-xs text-muted-foreground" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEdit(o)} aria-label="Edit opening"><Pencil className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/50 p-2"><div className="text-base font-semibold">{filled}/{o.positions}</div>Filled</div>
                <div className="rounded-lg bg-muted/50 p-2"><div className="text-base font-semibold">{cs.length}</div>Candidates</div>
                <div className="rounded-lg bg-muted/50 p-2"><div className="text-base font-semibold capitalize">{o.status.replace("_", " ")}</div>Status</div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Salary {inr(o.salary_min)} – {inr(o.salary_max)} / month</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="rounded-full bg-secondary px-2 py-1 capitalize">{o.workforce_class.replace("_", " ")}</span>
                <span className="rounded-full bg-secondary px-2 py-1 capitalize">{o.billing_class.replace("_", " ")}</span>
              </div>
              <ol className="mt-2 space-y-1 text-xs">
                {rounds.map((r) => <li key={r.id}>Round {r.round_no}: <span className="font-medium">{r.name}</span>{r.default_interviewer_id ? ` · ${namesQ.data?.get(r.default_interviewer_id) ?? ""}` : ""}</li>)}
              </ol>
            </div>
          );
        })}
      </div>
      {edit && <OpeningDialog opening={edit === "new" ? null : edit} onClose={() => setEdit(null)} masters={mq.data} />}
    </div>
  );
}

type RoundDraft = { name: string; default_interviewer_id: string };

function OpeningDialog({ opening, onClose, masters }: { opening: RecOpening | null; onClose: () => void; masters?: Awaited<ReturnType<typeof fetchMasters>> }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: opening?.title ?? "", designation_id: opening?.designation_id ?? "", department_id: opening?.department_id ?? "",
    branch_id: opening?.branch_id ?? "", positions: String(opening?.positions ?? 1), salary_min: String(opening?.salary_min ?? ""),
    salary_max: String(opening?.salary_max ?? ""), description: opening?.description ?? "", status: opening?.status ?? "open",
    workforce_class: opening?.workforce_class ?? "white_collar", billing_class: opening?.billing_class ?? "non_billable",
  });
  const initialRounds = [...(opening?.rec_opening_rounds ?? [])].sort((a, b) => a.round_no - b.round_no).map((r) => ({ name: r.name, default_interviewer_id: r.default_interviewer_id ?? "" }));
  const [rounds, setRounds] = useState<RoundDraft[]>(initialRounds.length ? initialRounds : [{ name: "HR Screening", default_interviewer_id: "" }]);
  const [busy, setBusy] = useState(false);
  const DEFAULT_NAMES = ["HR Screening", "Technical / Functional", "Final"];

  function setCount(n: number) {
    const next = [...rounds];
    while (next.length < n) next.push({ name: DEFAULT_NAMES[next.length] ?? `Round ${next.length + 1}`, default_interviewer_id: "" });
    setRounds(next.slice(0, n));
  }

  async function save() {
    if (!f.title.trim()) return toast.error("Enter a title");
    if (rounds.some((r) => !r.name.trim())) return toast.error("Name every round");
    setBusy(true);
    try {
      const row = {
        title: f.title.trim(), designation_id: f.designation_id || null, department_id: f.department_id || null, branch_id: f.branch_id || null,
        positions: Math.max(1, Number(f.positions || 1)), salary_min: Number(f.salary_min || 0), salary_max: Number(f.salary_max || 0),
        description: f.description, status: f.status, workforce_class: f.workforce_class, billing_class: f.billing_class, updated_at: new Date().toISOString(),
      };
      let id = opening?.id;
      if (id) {
        const { error } = await recDb.from("rec_openings").update(row).eq("id", id);
        if (error) throw error;
        const { error: de } = await recDb.from("rec_opening_rounds").delete().eq("opening_id", id);
        if (de) throw de;
      } else {
        const { data, error } = await recDb.from("rec_openings").insert(row).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { error: re } = await recDb.from("rec_opening_rounds").insert(rounds.map((r, i) => ({ opening_id: id, round_no: i + 1, name: r.name.trim(), default_interviewer_id: r.default_interviewer_id || null })));
      if (re) throw re;
      void logActivity({ module: REC_MODULE, action: opening ? "update" : "create", entityType: "rec_openings", entityId: id, entityLabel: row.title, details: { rounds: rounds.length } });
      await qc.invalidateQueries({ queryKey: ["rec"] });
      toast.success("Opening saved");
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const sel = (k: "designation_id" | "department_id" | "branch_id", items: { id: string; name: string }[], ph: string) => (
    <Select value={f[k] || "none"} onValueChange={(v) => setF({ ...f, [k]: v === "none" ? "" : v })}>
      <SelectTrigger><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent><SelectItem value="none">—</SelectItem>{items.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{opening ? "Edit opening" : "New opening"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Title *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. HR Executive – Pune" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Designation</Label>{sel("designation_id", masters?.designations ?? [], "Select designation")}</div>
          <div className="space-y-1.5"><Label className="text-xs">Department</Label>{sel("department_id", masters?.departments ?? [], "Select department")}</div>
          <div className="space-y-1.5"><Label className="text-xs">Branch</Label>{sel("branch_id", masters?.branches ?? [], "Select branch")}</div>
          <div className="space-y-1.5"><Label className="text-xs">Positions</Label><Input type="number" min={1} value={f.positions} onChange={(e) => setF({ ...f, positions: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Salary from (monthly ₹)</Label><Input type="number" min={0} value={f.salary_min} onChange={(e) => setF({ ...f, salary_min: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Salary to (monthly ₹)</Label><Input type="number" min={0} value={f.salary_max} onChange={(e) => setF({ ...f, salary_max: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="on_hold">On hold</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Workforce</Label>
            <Select value={f.workforce_class} onValueChange={(v) => setF({ ...f, workforce_class: v as "blue_collar" | "white_collar" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="blue_collar">Blue collar</SelectItem><SelectItem value="white_collar">White collar</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Billing</Label>
            <Select value={f.billing_class} onValueChange={(v) => setF({ ...f, billing_class: v as "billable" | "non_billable" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="billable">Billable</SelectItem><SelectItem value="non_billable">Non-billable</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Interview rounds</Label>
            <Select value={String(rounds.length)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n} round{n > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            {rounds.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Round {i + 1} name</Label>
                  <Input value={r.name} onChange={(e) => setRounds(rounds.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Default interviewer</Label>
                  <EmployeePicker value={r.default_interviewer_id} onChange={(id) => setRounds(rounds.map((x, j) => j === i ? { ...x, default_interviewer_id: id } : x))} /></div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Job description</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save opening"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
