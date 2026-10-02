import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarPlus, Check, MoreHorizontal, FileText, Pause, Send, Upload, UserCheck, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmployeePicker } from "@/components/EmployeePicker";
import { InterviewResultDialog } from "@/components/recruitment/InterviewResultDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createNotification } from "@/lib/notifications";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity-log";
import { useCurrentPermissions } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import {
  addEvent, employeeNames, fetchCandidate, fetchMasters, fetchOpenings, fmtDateTime, inr, notifyEmployee, notifyOnboarders,
  openResume, PUNE_HOME_UNIT, QK, recDb, REC_MODULE, stageLabel, stageTone, uploadResume,
  type RecCandidate, type RecInterview, type RecOffer,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/hr/recruitment/candidates/$recId")({
  head: () => ({
    meta: [
      { title: "Recruitment Candidate — Radiant" },
      { name: "description", content: "Candidate profile, interview rounds, offer and onboarding." },
      { property: "og:title", content: "Recruitment Candidate — Radiant" },
      { property: "og:description", content: "Candidate profile, interview rounds, offer and onboarding." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandidatePage,
});

const ACTIVE_FOR_SCHEDULE = ["new", "screening", "round_1", "round_2", "round_3"];

function CandidatePage() {
  const { recId } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QK.candidate(recId), queryFn: () => fetchCandidate(recId) });
  const oq = useQuery({ queryKey: QK.openings, queryFn: fetchOpenings });
  const mq = useQuery({ queryKey: QK.masters, queryFn: fetchMasters, staleTime: 600_000 });
  const { can } = useCurrentPermissions();
  const isRecruiter = can("recruitment");
  const meQ = useQuery({ queryKey: ["auth", "my-candidate-id"], queryFn: async () => (await supabase.rpc("current_user_candidate_id")).data as string | null, staleTime: 300_000 });
  const c = q.data?.candidate;
  const interviews = q.data?.interviews ?? [];
  const namesQ = useQuery({
    queryKey: ["rec", "cand-names", recId, interviews.map((i) => i.interviewer_id).join(","), c?.offer?.reports_to ?? ""],
    queryFn: () => employeeNames([...interviews.map((i) => i.interviewer_id), c?.offer?.reports_to ?? ""]),
    enabled: !!c,
  });
  const [schedule, setSchedule] = useState(false);
  const [result, setResult] = useState<{ i: RecInterview; d: "approved" | "rejected" } | null>(null);
  const [closeAs, setCloseAs] = useState<"rejected" | "withdrawn" | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [resched, setResched] = useState<RecInterview | null>(null);

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!c) return <div className="p-6 text-sm text-muted-foreground">Candidate not found or you don't have access.</div>;

  const opening = (oq.data ?? []).find((o) => o.id === c.opening_id);
  const rounds = [...(opening?.rec_opening_rounds ?? [])].sort((a, b) => a.round_no - b.round_no);
  const nextRound = c.rounds_cleared + 1;
  const hasScheduledNext = interviews.some((i) => i.round_no === nextRound && i.status === "scheduled");
  const canSchedule = ACTIVE_FOR_SCHEDULE.includes(c.stage) && nextRound <= c.total_rounds && !hasScheduledNext;
  const refresh = () => qc.invalidateQueries({ queryKey: ["rec"] });
  // Only the assigned interviewer decides a round; recruiters may only reschedule/cancel.
  const current = interviews.find((i) => i.status === "scheduled" && i.interviewer_id === meQ.data);
  const pendingForOthers = !current && isRecruiter ? interviews.find((i) => i.status === "scheduled") : undefined;
  const interviewerFor = (details: string) => {
    const m = details.match(/Round (\d)/i);
    if (!m) return "";
    const iv = [...interviews].reverse().find((i) => i.round_no === Number(m[1]));
    return iv ? namesQ.data?.get(iv.interviewer_id) ?? "" : "";
  };
  const closed = ["onboarded", "rejected", "withdrawn", "pending_onboarding"].includes(c.stage);

  async function setStage(stage: string, extra: Partial<RecCandidate> = {}) {
    const { error } = await recDb.from("rec_candidates").update({ stage, ...extra }).eq("id", c!.id);
    if (error) return toast.error(error.message);
    void logActivity({ module: REC_MODULE, action: "stage_change", entityType: "rec_candidates", entityId: c!.id, entityLabel: c!.code, details: { from: c!.stage, to: stage } });
    await refresh();
  }

  async function onResume(file: File) {
    try { await uploadResume(c!.id, file); await addEvent(c!.id, "resume", file.name); toast.success("Resume uploaded"); await refresh(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`Recruitment · ${c.code}`}
        title={c.full_name}
        description={[opening?.title, c.mobile, c.email].filter(Boolean).join(" · ")}
        icon={UserCheck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold", stageTone(c.stage))}>{stageLabel(c.stage)}</span>
            {current && (
              <>
                <Button onClick={() => setResult({ i: current, d: "approved" })}><Check />Approve round {current.round_no}</Button>
                <Button variant="destructive" onClick={() => setResult({ i: current, d: "rejected" })}><X />Reject</Button>
                <Button variant="outline" onClick={() => setResched(current)}><CalendarClock />Reschedule</Button>
              </>
            )}
            {pendingForOthers && (
              <Button variant="outline" onClick={() => setResched(pendingForOthers)}><CalendarClock />Reschedule round {pendingForOthers.round_no}</Button>
            )}
            {isRecruiter && c.stage === "new" && <Button variant="outline" onClick={() => setStage("screening")}><UserCheck />Move to screening</Button>}
            {isRecruiter && c.stage === "on_hold" && <Button variant="outline" onClick={() => setStage(c.rounds_cleared ? `round_${Math.min(3, c.rounds_cleared + 1)}` : "screening")}><UserCheck />Resume hiring</Button>}
            {isRecruiter && !closed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" aria-label="More candidate actions"><MoreHorizontal />More</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {ACTIVE_FOR_SCHEDULE.includes(c.stage) && <DropdownMenuItem onClick={() => setStage("on_hold")}><Pause className="mr-2 h-4 w-4" />Pause hiring (on hold)</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => setCloseAs("withdrawn")}><UserMinus className="mr-2 h-4 w-4" />Candidate dropped out</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setCloseAs("rejected")}><X className="mr-2 h-4 w-4" />Reject candidate (close)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {/* Round progress strip */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-xs text-muted-foreground">Round {Math.min(c.rounds_cleared, c.total_rounds)} of {c.total_rounds} approved</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: c.total_rounds }, (_, k) => k + 1).map((n) => {
            const last = interviews.filter((i) => i.round_no === n).at(-1);
            const st = last?.status ?? (n <= c.rounds_cleared ? "approved" : "pending");
            return (
              <div key={n} className={cn("flex min-w-0 items-center gap-2 rounded-xl border p-3", st === "scheduled" ? "border-accent/40 bg-accent/5" : "border-border/60 bg-muted/20")}>
                <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  st === "approved" && "border-primary bg-primary text-primary-foreground",
                  st === "rejected" && "border-destructive bg-destructive text-destructive-foreground",
                  st === "scheduled" && "border-accent text-accent")}>
                  {st === "approved" ? <Check className="h-4 w-4" /> : st === "rejected" ? <X className="h-4 w-4" /> : n}
                </div>
                <div className="min-w-0 text-xs">
                  <div className="truncate font-medium">{rounds.find((r) => r.round_no === n)?.name ?? `Round ${n}`}</div>
                  <div className="text-muted-foreground">{st === "pending" ? "Not scheduled" : st === "scheduled" ? fmtDateTime(last?.scheduled_at) : st}</div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <div className={cn("grid h-8 w-8 place-items-center rounded-full border text-xs", ["hr_approved", "pending_onboarding", "onboarded"].includes(c.stage) && "border-primary bg-primary text-primary-foreground")}><UserCheck className="h-4 w-4" /></div>
            <span className="text-xs font-medium">HR Head</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold">Details</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Item k="Location" v={c.current_location} />
            <Item k="Experience" v={`${c.experience_years} yrs`} />
            <Item k="Current CTC" v={inr(c.current_ctc)} />
            <Item k="Expected CTC" v={inr(c.expected_ctc)} />
            <Item k="Notice" v={`${c.notice_days} days`} />
            <Item k="Source" v={c.source} />
            <Item k="Referred by" v={c.referred_by} />
            <Item k="Added" v={new Date(c.created_at).toLocaleDateString("en-IN")} />
          </dl>
          {c.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-2 text-sm">{c.notes}</p>}
          {c.lost_reason && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{c.lost_reason}</p>}
          <div className="flex flex-wrap gap-2">
            {c.resume_path && <Button size="sm" variant="outline" onClick={() => openResume(c.resume_path).catch((e) => toast.error(e.message))}><FileText className="mr-1 h-4 w-4" />{c.resume_name || "Resume"}</Button>}
            {isRecruiter && (
              <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Upload className="mr-1 h-4 w-4" />{c.resume_path ? "Replace resume" : "Upload resume"}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={(e) => e.target.files?.[0] && onResume(e.target.files[0])} />
              </label>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Interviews</h2>
            {isRecruiter && canSchedule && <Button size="sm" onClick={() => setSchedule(true)}><CalendarPlus className="mr-1 h-4 w-4" />Schedule round {nextRound}</Button>}
          </div>
          {interviews.length === 0 ? <p className="text-sm text-muted-foreground">No interviews yet.</p> : (
            <ul className="divide-y divide-border">
              {interviews.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">Round {i.round_no}: {i.round_name} <span className={cn("ml-1 rounded-full px-2 py-0.5 text-[11px] capitalize", i.status === "approved" ? "bg-primary/15 text-primary" : i.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-accent/10 text-accent")}>{i.status}</span></div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(i.scheduled_at)} · {i.mode.replace("_", " ")}{i.location ? ` · ${i.location}` : ""} · {namesQ.data?.get(i.interviewer_id) ?? "Interviewer"}</div>
                    {i.feedback && <div className="mt-1 whitespace-pre-wrap text-xs">“{i.feedback}” {i.rating ? `· ${i.rating}/5` : ""}</div>}
                  </div>
                  {i.status === "scheduled" && (isRecruiter || i.interviewer_id === meQ.data) && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResched(i)}><CalendarClock className="mr-1 h-4 w-4" />Reschedule</Button>
                      {isRecruiter && <Button size="sm" variant="ghost" onClick={async () => { await recDb.from("rec_interviews").update({ status: "cancelled" }).eq("id", i.id); await addEvent(c.id, "interview_cancelled", `Round ${i.round_no}`); await refresh(); }}>Cancel</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(c.stage === "hr_approved" || c.stage === "pending_onboarding" || c.stage === "onboarded") && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Offer &amp; onboarding</h2>
            {isRecruiter && c.stage === "hr_approved" && <Button size="sm" onClick={() => setOfferOpen(true)}><Send className="mr-1 h-4 w-4" />Send to HR Head</Button>}
          </div>
          {isRecruiter && c.stage === "hr_approved" && <p className="text-sm text-muted-foreground">All rounds approved. Fill in the offer and send it to the HR Head to onboard.</p>}
          {c.offer?.monthly_ctc ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <Item k="Monthly CTC" v={inr(c.offer.monthly_ctc)} />
              <Item k="Monthly gross" v={inr(c.offer.monthly_gross)} />
              <Item k="Joining" v={c.offer.joining_date ?? ""} />
              <Item k="Reports to" v={c.offer.reports_to ? namesQ.data?.get(c.offer.reports_to) ?? "" : ""} />
            </dl>
          ) : null}
          {(q.data?.onboarding ?? []).filter((o) => o.status === "sent_back").slice(0, 1).map((o) => (
            <p key={o.id} className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">Sent back by HR Head: {o.decision_note || "no note"}</p>
          ))}
          {c.stage === "onboarded" && c.employee_candidate_id && (
            <Link to="/admin/candidates/$id/details" params={{ id: c.employee_candidate_id }} className="inline-flex text-sm font-medium text-accent hover:underline">Open employee record →</Link>
          )}
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-display text-sm font-semibold">Timeline</h2>
        <ul className="space-y-2 text-sm">
          {(q.data?.events ?? []).map((e) => (
            <li key={e.id} className="flex gap-3"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span><span><span className="font-medium capitalize">{e.event.replace(/_/g, " ")}</span>{e.details ? ` — ${e.details.replace(/round_(\d)/g, "Round $1").replace(/_/g, " ")}` : ""}{e.event.startsWith("interview_") && interviewerFor(e.details) ? <span className="text-muted-foreground"> · Interviewer: {interviewerFor(e.details)}</span> : null}</span></li>
          ))}
        </ul>
      </section>

      {schedule && <ScheduleDialog candidate={c} roundNo={nextRound} roundName={rounds.find((r) => r.round_no === nextRound)?.name ?? `Round ${nextRound}`} defaultInterviewer={rounds.find((r) => r.round_no === nextRound)?.default_interviewer_id ?? ""} onClose={() => setSchedule(false)} />}
      {result && <InterviewResultDialog interview={result.i} candidateName={c.full_name} decision={result.d} onClose={() => setResult(null)} />}
      {resched && <RescheduleDialog interview={resched} candidate={c} onClose={() => setResched(null)} />}
      {closeAs && <CloseDialog candidate={c} as={closeAs} onClose={() => setCloseAs(null)} />}
      {offerOpen && <OfferDialog candidate={c} openingDefaults={{ designation_id: opening?.designation_id ?? "", department_id: opening?.department_id ?? "", branch_id: opening?.branch_id ?? "" }} masters={mq.data} onClose={() => setOfferOpen(false)} />}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate">{v || "—"}</dd></div>;
}

function ScheduleDialog({ candidate, roundNo, roundName, defaultInterviewer, onClose }: { candidate: RecCandidate; roundNo: number; roundName: string; defaultInterviewer: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ when: "", mode: "in_person", location: "", interviewer: defaultInterviewer, name: roundName });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!f.when) return toast.error("Pick date and time");
    if (!f.interviewer) return toast.error("Pick the interviewer");
    setBusy(true);
    try {
      const scheduled_at = new Date(f.when).toISOString();
      const { data, error } = await recDb.from("rec_interviews").insert({ candidate_id: candidate.id, round_no: roundNo, round_name: f.name, interviewer_id: f.interviewer, scheduled_at, mode: f.mode, location: f.location }).select("id").single();
      if (error) throw error;
      const stage = `round_${roundNo}`;
      if (candidate.stage !== stage) await recDb.from("rec_candidates").update({ stage }).eq("id", candidate.id);
      await addEvent(candidate.id, "interview_scheduled", `Round ${roundNo} (${f.name}) on ${fmtDateTime(scheduled_at)}`);
      void logActivity({ module: REC_MODULE, action: "schedule", entityType: "rec_interviews", entityId: data.id, entityLabel: `${candidate.code} round ${roundNo}` });
      void notifyEmployee(f.interviewer, "Interview assigned", `${candidate.full_name} — Round ${roundNo} (${f.name}) on ${fmtDateTime(scheduled_at)}`, "/admin/hr/recruitment/interviews");
      await qc.invalidateQueries({ queryKey: ["rec"] });
      toast.success("Interview scheduled");
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Schedule round {roundNo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Round name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Date &amp; time *</Label><Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Mode</Label>
            <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in_person">In person</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">{f.mode === "video" ? "Meeting link" : "Location"}</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Interviewer *</Label><EmployeePicker value={f.interviewer} onChange={(id) => setF({ ...f, interviewer: id })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Schedule"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ interview, candidate, onClose }: { interview: RecInterview; candidate: RecCandidate; onClose: () => void }) {
  const qc = useQueryClient();
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [availability, setAvailability] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!when) return toast.error("Pick the new date and time");
    if (!reason.trim()) return toast.error("Reason is required");
    setBusy(true);
    const newAt = new Date(when).toISOString();
    const { data, error } = await supabase.rpc("rec_reschedule_interview" as never, { _interview_id: interview.id, _new_at: newAt, _reason: reason, _availability: availability } as never);
    if (error) { setBusy(false); return toast.error(error.message); }
    const row = (data as unknown as { interviewer_user_id: string | null; creator_user_id: string | null }[] | null)?.[0];
    const { data: me } = await supabase.auth.getUser();
    const msg = `${candidate.full_name} · Round ${interview.round_no} moved to ${fmtDateTime(newAt)}. Reason: ${reason.trim()}${availability.trim() ? `. Available: ${availability.trim()}` : ""}`;
    const link = `/admin/hr/recruitment/candidates/${candidate.id}`;
    const targets = new Set([row?.interviewer_user_id, row?.creator_user_id].filter((u): u is string => !!u && u !== me.user?.id));
    await Promise.all([...targets].map((userId) => createNotification({ userId, type: "interview_assigned", title: "Interview rescheduled", message: msg, link }).catch(() => undefined)));
    void logActivity({ module: REC_MODULE, action: "interview_rescheduled", entityType: "rec_interviews", entityId: interview.id, entityLabel: candidate.code, details: { to: newAt, reason } });
    toast.success("Interview rescheduled and notified");
    await qc.invalidateQueries({ queryKey: ["rec"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reschedule round {interview.round_no}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Currently {fmtDateTime(interview.scheduled_at)}. The recruiter and interviewer will be notified.</p>
          <div className="space-y-1.5"><Label>New date & time *</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Reason for reschedule *</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client visit clashes with the slot" /></div>
          <div className="space-y-1.5"><Label>Interviewer available on</Label><Input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="e.g. Mon–Wed after 3 pm" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Reschedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ candidate, as, onClose }: { candidate: RecCandidate; as: "rejected" | "withdrawn"; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  async function save() {
    if (!reason.trim()) return toast.error("Enter a reason");
    const { error } = await recDb.from("rec_candidates").update({ stage: as, lost_reason: reason.trim() }).eq("id", candidate.id);
    if (error) return toast.error(error.message);
    await recDb.from("rec_interviews").update({ status: "cancelled" }).eq("candidate_id", candidate.id).eq("status", "scheduled");
    void logActivity({ module: REC_MODULE, action: as === "rejected" ? "reject" : "withdraw", entityType: "rec_candidates", entityId: candidate.id, entityLabel: candidate.code, details: { reason } });
    await qc.invalidateQueries({ queryKey: ["rec"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{as === "rejected" ? "Reject candidate" : "Mark as withdrawn"}</DialogTitle></DialogHeader>
        <div className="space-y-1.5"><Label className="text-xs">Reason *</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={save}>Confirm</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfferDialog({ candidate, openingDefaults, masters, onClose }: { candidate: RecCandidate; openingDefaults: { designation_id: string; department_id: string; branch_id: string }; masters?: Awaited<ReturnType<typeof fetchMasters>>; onClose: () => void }) {
  const qc = useQueryClient();
  const o = candidate.offer ?? {};
  const [f, setF] = useState<Required<Pick<RecOffer, "designation_id" | "department_id" | "branch_id" | "reports_to" | "role_key" | "notes" | "joining_date">> & { monthly_ctc: string; monthly_gross: string }>({
    monthly_ctc: String(o.monthly_ctc ?? candidate.expected_ctc ?? ""), monthly_gross: String(o.monthly_gross ?? ""),
    joining_date: o.joining_date ?? "", designation_id: o.designation_id ?? openingDefaults.designation_id, department_id: o.department_id ?? openingDefaults.department_id,
    branch_id: o.branch_id ?? openingDefaults.branch_id, reports_to: o.reports_to ?? "", role_key: o.role_key ?? "", notes: o.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!Number(f.monthly_ctc)) return toast.error("Enter the offered monthly CTC");
    if (!f.joining_date) return toast.error("Enter the date of joining");
    if (!f.designation_id || !f.department_id) return toast.error("Pick designation and department");
    setBusy(true);
    try {
      const offer: RecOffer = { ...f, monthly_ctc: Number(f.monthly_ctc), monthly_gross: Number(f.monthly_gross || 0), unit_id: PUNE_HOME_UNIT };
      const { error: e1 } = await recDb.from("rec_candidates").update({ offer, stage: "pending_onboarding" }).eq("id", candidate.id);
      if (e1) throw e1;
      const { error: e2 } = await recDb.from("rec_onboarding_requests").insert({ candidate_id: candidate.id, offer });
      if (e2) throw e2;
      await addEvent(candidate.id, "sent_to_hr_head", `Offer ${inr(offer.monthly_ctc)} / month, joining ${offer.joining_date}`);
      void logActivity({ module: REC_MODULE, action: "submit", entityType: "rec_onboarding_requests", entityId: candidate.id, entityLabel: candidate.code, details: { offer } });
      void notifyOnboarders("Candidate ready to onboard", `${candidate.full_name} (${candidate.code}) is waiting for onboarding.`, "/admin/hr/recruitment/onboarding");
      await qc.invalidateQueries({ queryKey: ["rec"] });
      toast.success("Sent to HR Head");
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const sel = (k: "designation_id" | "department_id" | "branch_id", items: { id: string; name: string }[]) => (
    <Select value={f[k] || "none"} onValueChange={(v) => setF({ ...f, [k]: v === "none" ? "" : v })}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="none">—</SelectItem>{items.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
    </Select>
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Offer for {candidate.full_name}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs">Monthly CTC (₹) *</Label><Input type="number" min={0} value={f.monthly_ctc} onChange={(e) => setF({ ...f, monthly_ctc: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Monthly gross (₹)</Label><Input type="number" min={0} value={f.monthly_gross} onChange={(e) => setF({ ...f, monthly_gross: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Date of joining *</Label><Input type="date" value={f.joining_date} onChange={(e) => setF({ ...f, joining_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">App role</Label>
            <Select value={f.role_key || "none"} onValueChange={(v) => setF({ ...f, role_key: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{(masters?.roles ?? []).filter((r) => r.key !== "super_admin").map((r) => <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Designation *</Label>{sel("designation_id", masters?.designations ?? [])}</div>
          <div className="space-y-1.5"><Label className="text-xs">Department *</Label>{sel("department_id", masters?.departments ?? [])}</div>
          <div className="space-y-1.5"><Label className="text-xs">Branch</Label>{sel("branch_id", masters?.branches ?? [])}</div>
          <div className="space-y-1.5"><Label className="text-xs">Reporting manager</Label><EmployeePicker value={f.reports_to} onChange={(id) => setF({ ...f, reports_to: id })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Home unit</Label><Input disabled value="Radiant Guards - Pune Office (non-billable)" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Notes for HR Head</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={send}>{busy ? "Sending…" : "Send to HR Head"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
