import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  employeeNames, fetchAllInterviews, fetchCandidates, fetchMasters, fetchOpenings, fmtDateTime,
  LOST, monthStartIso, PIPELINE, QK, STAGES,
} from "@/lib/recruitment";
import { DocumentFollowupPanel } from "@/components/recruitment/DocumentFollowupPanel";

export const Route = createFileRoute("/admin/hr/recruitment/dashboard")({
  head: () => ({
    meta: [
      { title: "Recruitment Dashboard — Radiant" },
      { name: "description", content: "Open candidates, pipeline, closures, losses and closure rate for staff hiring." },
      { property: "og:title", content: "Recruitment Dashboard — Radiant" },
      { property: "og:description", content: "Open candidates, pipeline, closures, losses and closure rate for staff hiring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecruitmentDashboard,
});

function RecruitmentDashboard() {
  const navigate = useNavigate();
  const cq = useQuery({ queryKey: QK.candidates, queryFn: fetchCandidates });
  const oq = useQuery({ queryKey: QK.openings, queryFn: fetchOpenings });
  const iq = useQuery({ queryKey: QK.interviews, queryFn: fetchAllInterviews });
  const mq = useQuery({ queryKey: QK.masters, queryFn: fetchMasters, staleTime: 600_000 });
  const cands = cq.data ?? [];
  const openings = oq.data ?? [];
  const interviews = iq.data ?? [];

  const s = useMemo(() => {
    const ms = monthStartIso();
    const byStage = new Map<string, number>();
    let open = 0, pipeline = 0, closures = 0, lost = 0;
    const bySource = new Map<string, number>();
    const byOpening = new Map<string, number>();
    const byDept = new Map<string, number>();
    const openingOf = new Map(openings.map((o) => [o.id, o]));
    const deptName = new Map((mq.data?.departments ?? []).map((d) => [d.id, d.name]));
    for (const c of cands) {
      byStage.set(c.stage, (byStage.get(c.stage) ?? 0) + 1);
      const active = PIPELINE.includes(c.stage);
      if (active) {
        pipeline++;
        if (c.stage === "new" || c.stage === "screening") open++;
        bySource.set(c.source || "Unknown", (bySource.get(c.source || "Unknown") ?? 0) + 1);
        const op = c.opening_id ? openingOf.get(c.opening_id) : undefined;
        byOpening.set(op?.title || "No opening", (byOpening.get(op?.title || "No opening") ?? 0) + 1);
        const dn = (op?.department_id && deptName.get(op.department_id)) || "Unassigned";
        byDept.set(dn, (byDept.get(dn) ?? 0) + 1);
      }
      if (c.stage === "onboarded" && (c.onboarded_at ?? c.stage_changed_at) >= ms) closures++;
      if (LOST.includes(c.stage) && c.stage_changed_at >= ms) lost++;
    }
    const pct = closures + lost > 0 ? Math.round((closures / (closures + lost)) * 100) : 0;
    const now = Date.now();
    const upcoming = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() >= now && new Date(i.scheduled_at).getTime() <= now + 7 * 86400000);
    const overdue = interviews.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() < now - 2 * 3600000);
    return { byStage, open, pipeline, closures, lost, pct, upcoming, overdue, bySource, byOpening, byDept };
  }, [cands, openings, interviews, mq.data]);

  const namesQ = useQuery({
    queryKey: ["rec", "dash-names", s.upcoming.map((i) => i.interviewer_id).concat(s.overdue.map((i) => i.interviewer_id)).join(",")],
    queryFn: () => employeeNames([...s.upcoming, ...s.overdue].map((i) => i.interviewer_id)),
  });
  const candName = new Map(cands.map((c) => [c.id, c.full_name]));
  const go = (stage?: string) => navigate({ to: "/admin/hr/recruitment/candidates", search: { stage: stage ?? "" } as never });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Recruitment Dashboard"
        icon={UserPlus}
        actions={<Button asChild size="sm"><Link to="/admin/hr/recruitment/candidates">Candidates<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>}
      />
      <section aria-label="Recruitment summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          {label:"Open candidates",value:s.open,stage:"open",tone:"text-primary"},
          {label:"In pipeline",value:s.pipeline,stage:"pipeline",tone:"text-foreground"},
          {label:"Joined this month",value:s.closures,stage:"onboarded",tone:"text-primary"},
          {label:"Lost this month",value:s.lost,stage:"lost",tone:"text-destructive"},
        ].map(item=><button key={item.stage} type="button" onClick={()=>go(item.stage)} className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${item.tone}`}>{cq.isLoading||cq.error?"—":item.value.toLocaleString("en-IN")}</p></button>)}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground">Closure rate</p><p className="mt-1 text-2xl font-semibold tabular-nums text-primary">{cq.isLoading||cq.error?"—":`${s.pct}%`}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${s.pct}%`}}/></div></div>
      </section>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Hiring stages</h2>
        {cq.error?<p className="text-sm text-destructive">Candidate summary unavailable.</p>:<div className="flex flex-wrap gap-2">
          {STAGES.map(st=>{const n=s.byStage.get(st.key)??0;return <button key={st.key} type="button" onClick={()=>go(st.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:border-primary/50 ${n>0?"border-primary/30 bg-primary/10 text-foreground":"border-border text-muted-foreground"}`}><span>{st.label}</span><span className={`min-w-5 rounded-full px-1.5 text-center font-semibold tabular-nums ${n>0?"bg-primary text-primary-foreground":"bg-muted"}`}>{cq.isLoading?"—":n}</span></button>;})}
        </div>}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Interviews · next 7 days</h2><Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/admin/hr/recruitment/interviews">View all<ArrowRight className="ml-1 h-3 w-3"/></Link></Button></div>
          {iq.isLoading?<p className="text-sm text-muted-foreground">Loading interviews…</p>:iq.error?<p className="text-sm text-destructive">Interviews unavailable.</p>:s.upcoming.length === 0 ? <p className="rounded-lg bg-muted/50 py-6 text-center text-sm text-muted-foreground">No interviews scheduled.</p> : (
            <ul className="divide-y divide-border">
              {s.upcoming.slice(0, 6).map((i) => (
                <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm">
                  <Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: i.candidate_id }} className="min-w-0 truncate font-medium hover:text-primary">
                    {candName.get(i.candidate_id) ?? "Candidate"} · Round {i.round_no}
                  </Link>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(i.scheduled_at)} · {namesQ.data?.get(i.interviewer_id) ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
          {s.overdue.length > 0 && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">Feedback overdue for {s.overdue.length} interview{s.overdue.length>1?"s":""}</p>}
        </section>
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <DocumentFollowupPanel compact />
        </section>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <Breakdown title="By opening" data={s.byOpening} />
        <Breakdown title="By department" data={s.byDept} />
        <Breakdown title="By source" data={s.bySource} />
      </section>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Map<string, number> }) {
  const rows = Array.from(data.entries()).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No active candidates.</p> : (
        <ul className="space-y-2 text-sm">
          {rows.slice(0, 5).map(([k, v]) => (
            <li key={k}><div className="flex justify-between gap-2 text-xs"><span className="truncate">{k}</span><span className="tabular-nums text-muted-foreground">{v}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{width:`${(v/max)*100}%`}}/></div></li>
          ))}
        </ul>
      )}
    </section>
  );
}
