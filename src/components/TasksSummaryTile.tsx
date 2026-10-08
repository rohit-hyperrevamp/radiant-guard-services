import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { status: string; due_at: string | null; acknowledged_at: string | null; assignee_id: string; created_by: string };
type Sum = { total: number; open: number; notResponded: number; overdue: number; completed: number };

/** Shared task counts for the dashboard tiles (assigned to me / created by me). */
export function useTaskSummary() {
  return useQuery({
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
      const sum = (list: Row[]): Sum => ({
        total: list.length,
        open: list.filter(isOpen).length,
        notResponded: list.filter((r) => r.status === "open" && !r.acknowledged_at).length,
        overdue: list.filter((r) => isOpen(r) && r.due_at && new Date(r.due_at).getTime() < now).length,
        completed: list.filter((r) => r.status === "completed").length,
      });
      return { mine: sum(rows.filter((r) => r.assignee_id === cid)), created: sum(rows.filter((r) => r.created_by === cid)) };
    },
  });
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-card/70 px-1.5 py-1 text-center ring-1 ring-inset ring-black/5 dark:ring-white/10">
      <div className="font-display text-[15px] font-medium leading-none tabular-nums text-foreground sm:text-[17px]">{value}</div>
      <div className="mt-0.5 truncate text-[8px] uppercase tracking-[0.06em] text-muted-foreground sm:text-[9px]">{label}</div>
    </div>
  );
}

/** Square dashboard tile styled like the other metric tiles. */
function Tile({
  to,
  label,
  sub,
  value,
  chip,
  bg,
  children,
}: {
  to: string;
  label: string;
  sub: string;
  value: number;
  chip: React.ReactNode;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      search={{} as never}
      className={`group relative flex h-[124px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/40 ${bg} p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:h-[172px] sm:rounded-[26px] sm:p-5`}
    >
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="truncate whitespace-nowrap font-display text-[13px] font-medium leading-tight text-foreground sm:text-[15px]">
            {label}
          </div>
          <div className="mt-0.5 truncate whitespace-nowrap text-[10px] leading-snug text-muted-foreground sm:mt-1 sm:text-[11px]">
            {sub}
          </div>
        </div>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border/60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:h-9 sm:w-9">
          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      <div className="relative mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[26px] font-medium leading-none tabular-nums text-foreground sm:text-[34px]">
          {value}
        </div>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card/80 text-foreground/70 ring-1 ring-inset ring-black/5 dark:ring-white/10 sm:h-9 sm:w-9">
          {chip}
        </span>
      </div>
      <div className="relative mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">{children}</div>
    </Link>
  );
}

/** Tile: tasks assigned to me — open, not answered, overdue, done. */
export function TasksAssignedTile({ summary }: { summary: Sum | null }) {
  return (
    <Tile
      to="/admin/tasks"
      label="My tasks"
      sub="Assigned to me"
      value={summary?.open ?? 0}
      chip={<ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      bg="bg-violet-100/80 dark:bg-violet-500/15"
    >
      <Mini value={summary?.notResponded ?? 0} label="No reply" />
      <Mini value={summary?.overdue ?? 0} label="Overdue" />
      <Mini value={summary?.completed ?? 0} label="Done" />
    </Tile>
  );
}

/** Tile: tasks I assigned to others — open, waiting on reply, overdue, closed. */
export function TasksCreatedTile({ summary }: { summary: Sum | null }) {
  return (
    <Tile
      to="/admin/tasks"
      label="Tasks I gave"
      sub="Assigned by me"
      value={summary?.open ?? 0}
      chip={<Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      bg="bg-amber-100/80 dark:bg-amber-500/15"
    >
      <Mini value={summary?.notResponded ?? 0} label="No reply" />
      <Mini value={summary?.overdue ?? 0} label="Overdue" />
      <Mini value={summary?.completed ?? 0} label="Closed" />
    </Tile>
  );
}
