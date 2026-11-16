import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Percent, UserPlus, Users, XCircle } from "lucide-react";
import { PageHeader, PageStat } from "@/components/PageHeader";
import {
  employeeNames, fetchAllInterviews, fetchCandidates, fetchMasters, fetchOpenings, fmtDateTime,
  LOST, monthStartIso, PIPELINE, QK, STAGES,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";
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

  const funnelMax = Math.max(1, ...PIPELINE.map((k) => s.byStage.get(k) ?? 0), s.byStage.get("onboarded") ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="HR"
        title="Recruitment Dashboard"
        description="Staff hiring (non-billable roles) from application to onboarding."
        icon={UserPlus}
        actions={<Link to="/admin/hr/recruitment/candidates" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Candidates</Link>}
        kpis={
          <>
            <PageStat label="Open candidates" value={s.open} icon={Users} onClick={() => go("open")} />
            <PageStat label="In pipeline" value={s.pipeline} icon={CalendarClock} onClick={() => go("pipeline")} />
            <PageStat label="Closures this month" value={s.closures} icon={CheckCircle2} tone="success" onClick={() => go("onboarded")} />
            <PageStat label="Lost this month" value={s.lost} icon={XCircle} tone="destructive" onClick={() => go("lost")} />
            <PageStat label="Closure %" value={`${s.pct}%`} icon={Percent} tone="accent" sub="Onboarded ÷ (onboarded + lost)" />
          </>
        }
      />

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">Stages</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {STAGES.map((st) => (
            <button key={st.key} onClick={() => go(st.key)} className="rounded-lg border border-border p-3 text-left transition-colors hover:border-accent/40">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.tone)}>{st.label}</span>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{s.byStage.get(st.key) ?? 0}</div>
            </button>
          ))}
        </div>
      </section>

      <DocumentFollowupPanel compact />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">Funnel</h2>
          <div className="space-y-2">
            {[...PIPELINE, "onboarded" as const].map((k) => {
              const n = s.byStage.get(k) ?? 0;
              return (
                <button key={k} onClick={() => go(k)} className="flex w-full items-center gap-3 text-left">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">{STAGES.find((x) => x.key === k)?.label}</span>
                  <span className="h-6 flex-1 overflow-hidden rounded bg-muted">
                    <span className="block h-full rounded bg-accent/70" style={{ width: `${(n / funnelMax) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right text-sm tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">Interviews in the next 7 days</h2>
          {s.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No interviews scheduled.</p> : (
            <ul className="divide-y divide-border">
              {s.upcoming.slice(0, 10).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: i.candidate_id }} className="min-w-0 truncate font-medium hover:text-accent">
                    {candName.get(i.candidate_id) ?? "Candidate"} · Round {i.round_no}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(i.scheduled_at)} · {namesQ.data?.get(i.interviewer_id) ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
          {s.overdue.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-semibold text-destructive">Feedback overdue ({s.overdue.length})</h3>
              <ul className="divide-y divide-border">
                {s.overdue.slice(0, 8).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link to="/admin/hr/recruitment/candidates/$recId" params={{ recId: i.candidate_id }} className="min-w-0 truncate hover:text-accent">
                      {candName.get(i.candidate_id) ?? "Candidate"} · Round {i.round_no}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(i.scheduled_at)} · {namesQ.data?.get(i.interviewer_id) ?? ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="By opening" data={s.byOpening} />
        <Breakdown title="By department" data={s.byDept} />
        <Breakdown title="By source" data={s.bySource} />
      </div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Map<string, number> }) {
  const rows = Array.from(data.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No active candidates.</p> : (
        <ul className="space-y-1.5 text-sm">
          {rows.slice(0, 10).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2"><span className="truncate">{k}</span><span className="tabular-nums text-muted-foreground">{v}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

