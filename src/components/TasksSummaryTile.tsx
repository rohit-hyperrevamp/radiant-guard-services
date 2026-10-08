import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { status: string; due_at: string | null; acknowledged_at: string | null; assignee_id: string; created_by: string };

/** Dashboard tile: tasks assigned to me and tasks I created, with status counts. */
export function TasksSummaryTile() {
  const q = useQuery({
    queryKey: ["tasks-summary-tile"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: me } = await supabase.rpc("current_user_candidate_id" as never);
      const cid = me as unknown as string | null;
      if (!cid) return null;
      const { data } = await supabase
        .from("tasks" as never)
        .select("status,due_at,acknowledged_at,assignee_id,created_by")
        .or(`assignee_id.eq.${cid},created_by.eq.${cid}`)
        .limit(2000);
      const rows = (data ?? []) as unknown as Row[];
      const now = Date.now();
      const isOpen = (r: Row) => !["completed", "cancelled"].includes(r.status);
      const sum = (list: Row[]) => ({
        total: list.length,
        open: list.filter(isOpen).length,
        notResponded: list.filter((r) => r.status === "open" && !r.acknowledged_at).length,
        overdue: list.filter((r) => isOpen(r) && r.due_at && new Date(r.due_at).getTime() < now).length,
        completed: list.filter((r) => r.status === "completed").length,
      });
      return { mine: sum(rows.filter((r) => r.assignee_id === cid)), created: sum(rows.filter((r) => r.created_by === cid)) };
    },
  });
  const d = q.data;
  if (!q.isLoading && !d) return null;

  const Cell = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className={`rounded-xl px-2 py-1.5 text-center ${strong ? "bg-accent/15 text-accent" : "bg-secondary/60 text-foreground"}`}>
      <div className="font-display text-base font-bold leading-tight num">{q.isLoading ? "—" : value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );

  return (
    <Link
      to="/admin/tasks"
      search={{} as never}
      className="block rounded-[24px] border border-border/60 bg-card/70 p-4 backdrop-blur-2xl transition hover:border-accent/40"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Tasks</div>
          <div className="font-display text-[13px] font-bold text-foreground">My tasks</div>
        </div>
      </div>
      <div className="text-[10px] font-semibold text-muted-foreground mb-1">Assigned to me</div>
      <div className="grid grid-cols-4 gap-1.5">
        <Cell label="Open" value={d?.mine.open ?? 0} strong />
        <Cell label="No reply" value={d?.mine.notResponded ?? 0} />
        <Cell label="Overdue" value={d?.mine.overdue ?? 0} />
        <Cell label="Done" value={d?.mine.completed ?? 0} />
      </div>
      {(d?.created.total ?? 0) > 0 && (
        <>
          <div className="mt-3 text-[10px] font-semibold text-muted-foreground mb-1">Created by me ({d?.created.total})</div>
          <div className="grid grid-cols-4 gap-1.5">
            <Cell label="Open" value={d?.created.open ?? 0} strong />
            <Cell label="No reply" value={d?.created.notResponded ?? 0} />
            <Cell label="Overdue" value={d?.created.overdue ?? 0} />
            <Cell label="Closed" value={d?.created.completed ?? 0} />
          </div>
        </>
      )}
    </Link>
  );
}
