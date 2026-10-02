import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications";
import { employeeNames, fetchMasters, fetchOnboarding, fmtDateTime, inr, openResume, PAGE_SIZE, QK, recDb, REC_MODULE, type RecCandidate, type RecOnboarding } from "@/lib/recruitment";

export const Route = createFileRoute("/admin/hr/recruitment/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding Requests — Radiant" },
      { name: "description", content: "HR-approved recruits waiting for the HR Head to onboard and generate an employee ID." },
      { property: "og:title", content: "Onboarding Requests — Radiant" },
      { property: "og:description", content: "HR-approved recruits waiting for the HR Head to onboard and generate an employee ID." },
    ],
  }),
  component: OnboardingQueue,
});

type Row = RecOnboarding & { rec_candidates: RecCandidate | null; requested_by?: string | null };

function OnboardingQueue() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: QK.onboarding, queryFn: fetchOnboarding });
  const mq = useQuery({ queryKey: QK.masters, queryFn: fetchMasters, staleTime: 600_000 });
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [sendBack, setSendBack] = useState<Row | null>(null);
  const rows = ((q.data ?? []) as Row[]).filter((r) => tab === "pending" ? r.status === "pending" : r.status !== "pending");
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const namesQ = useQuery({ queryKey: ["rec", "onb-names", pageRows.map((r) => r.offer?.reports_to ?? "").join(",")], queryFn: () => employeeNames(pageRows.map((r) => r.offer?.reports_to ?? "")) });
  const nm = (list: { id: string; name: string }[] | undefined, id?: string) => (id && list?.find((x) => x.id === id)?.name) || "—";

  async function onboard(r: Row) {
    setBusy(r.id);
    try {
      const { data, error } = await recDb.rpc("rec_onboard_candidate", { _request_id: r.id });
      if (error) throw error;
      void logActivity({ module: REC_MODULE, action: "onboard", entityType: "rec_onboarding_requests", entityId: r.id, entityLabel: `${r.rec_candidates?.full_name ?? ""} → ${data}` });
      if (r.requested_by) void createNotification({ userId: r.requested_by, type: "recruitment", title: "Candidate onboarded", message: `${r.rec_candidates?.full_name} onboarded as employee ${data}.`, link: `/admin/hr/recruitment/candidates/${r.candidate_id}` }).catch(() => undefined);
      const doj = r.offer?.joining_date;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      toast.success(`Employee ID ${data} created — ${doj && doj > today ? `goes live on ${doj}` : "live now"}. Set up the salary next.`);
      await qc.invalidateQueries({ queryKey: ["rec"] });
      const { data: emp } = await recDb.from("rec_onboarding_requests").select("employee_candidate_id").eq("id", r.id).maybeSingle();
      const empId = (emp as { employee_candidate_id?: string } | null)?.employee_candidate_id;
      if (empId) void navigate({ to: "/admin/employees", search: { tab: "employee", edit: empId } });
    } catch (e) {
      const err = e as { message?: string; details?: string };
      toast.error(err?.message || err?.details || "Could not onboard");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Recruitment" title="Onboarding Requests" description="Review the offer, onboard and set up the salary. The employee ID is generated automatically and the person goes live on the joining date." icon={BadgeCheck} />
      <div className="flex gap-2">
        {(["pending", "done"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => { setTab(t); setPage(0); }}>{t === "pending" ? "Pending" : "Decided"}</Button>)}
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && pageRows.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      <div className="space-y-3">
        {pageRows.map((r) => {
          const c = r.rec_candidates; const o = r.offer ?? {};
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: r.candidate_id }} className="font-display font-semibold hover:text-accent">{c?.full_name}</Link>
                  <div className="text-xs text-muted-foreground">{c?.code} · {c?.mobile} · {c?.email} · sent {fmtDateTime(r.created_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c?.resume_path && <Button size="sm" variant="outline" onClick={() => openResume(c.resume_path).catch((e) => toast.error(e.message))}><FileText className="mr-1 h-4 w-4" />Resume</Button>}
                  {r.status === "pending" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setSendBack(r)}>Send back</Button>
                      <Button size="sm" disabled={busy === r.id} onClick={() => onboard(r)}>{busy === r.id ? "Onboarding…" : "Onboard & set up salary"}</Button>
                    </>
                  ) : r.status === "onboarded" && r.employee_candidate_id ? (
                    <Link to="/admin/candidates/$id/details" params={{ id: r.employee_candidate_id }} className="self-center text-sm font-medium text-accent">Onboarded · open employee →</Link>
                  ) : <span className="self-center text-sm text-destructive">Sent back{r.decision_note ? `: ${r.decision_note}` : ""}</span>}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
                <D k="Monthly CTC" v={inr(o.monthly_ctc)} /><D k="Monthly gross" v={inr(o.monthly_gross)} />
                <D k="Date of joining" v={o.joining_date ?? "—"} /><D k="Designation" v={nm(mq.data?.designations, o.designation_id)} />
                <D k="Department" v={nm(mq.data?.departments, o.department_id)} /><D k="Branch" v={nm(mq.data?.branches, o.branch_id)} />
                <D k="Reports to" v={o.reports_to ? namesQ.data?.get(o.reports_to) ?? "—" : "—"} /><D k="App role" v={(o.role_key && mq.data?.roles.find((x) => x.key === o.role_key)?.name) || "—"} />
                <D k="Experience" v={`${c?.experience_years ?? 0} yrs`} /><D k="Current CTC" v={inr(c?.current_ctc)} />
                <D k="Expected CTC" v={inr(c?.expected_ctc)} /><D k="Rounds cleared" v={`${c?.rounds_cleared ?? 0}/${c?.total_rounds ?? 0}`} />
              </dl>
              {o.notes && <p className="mt-2 rounded-lg bg-muted/40 p-2 text-sm">{o.notes}</p>}
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      {sendBack && <SendBackDialog row={sendBack} onClose={() => setSendBack(null)} />}
    </div>
  );
}

function D({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate">{v}</dd></div>;
}

function SendBackDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  async function save() {
    if (!note.trim()) return toast.error("Tell HR what to change");
    const { error } = await recDb.rpc("rec_send_back", { _request_id: row.id, _note: note.trim() });
    if (error) return toast.error(error.message);
    void logActivity({ module: REC_MODULE, action: "send_back", entityType: "rec_onboarding_requests", entityId: row.id, entityLabel: row.rec_candidates?.full_name ?? "", details: { note } });
    if (row.requested_by) void createNotification({ userId: row.requested_by, type: "recruitment", title: "Onboarding sent back", message: `${row.rec_candidates?.full_name}: ${note}`, link: `/admin/hr/recruitment/candidates/${row.candidate_id}` }).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["rec"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Send back to HR</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label className="text-xs">What needs to change? *</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Send back</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
