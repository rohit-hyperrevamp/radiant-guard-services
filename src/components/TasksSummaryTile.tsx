import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { TileNumber } from "@/components/TileNumber";
import { ACCENT_TILE_BG } from "@/components/tile-theme";

type Row = {
  status: string;
  due_at: string | null;
  acknowledged_at: string | null;
  assignee_id: string;
  created_by: string;
};
type Sum = {
  total: number;
  open: number;
  notResponded: number;
  overdue: number;
  completed: number;
};

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
        overdue: list.filter((r) => isOpen(r) && r.due_at && new Date(r.due_at).getTime() < now)
          .length,
        completed: list.filter((r) => r.status === "completed").length,
      });
      return {
        mine: sum(rows.filter((r) => r.assignee_id === cid)),
        created: sum(rows.filter((r) => r.created_by === cid)),
      };
    },
  });
}

/** One square for tasks assigned to me and tasks I created. */
export function TasksSummaryTile({ summary }: { summary: { mine: Sum; created: Sum } | null }) {
  const rows = [
    { label: "Mine", counts: summary?.mine },
    { label: "Created", counts: summary?.created },
  ];
  return (
    <Link
      to="/admin/tasks"
      search={{} as never}
      className={`group relative flex h-[124px] min-w-0 flex-col rounded-2xl border border-border/40 ${ACCENT_TILE_BG.violet} p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:h-[172px] sm:rounded-[26px] sm:p-5`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-[13px] font-medium text-foreground sm:text-[15px]">
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          Tasks
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border/60 sm:h-9 sm:w-9">
          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,0.9fr)_repeat(4,minmax(0,1fr))] items-center gap-x-1 gap-y-1.5 text-center sm:gap-y-2">
        <span />
        {["Open", "Done", "No reply", "Overdue"].map((label) => (
          <span
            key={label}
            className="text-[8px] leading-tight text-muted-foreground sm:text-[9px]"
          >
            {label}
          </span>
        ))}
        {rows.map(({ label, counts }) => (
          <TaskRow key={label} label={label} counts={counts} />
        ))}
      </div>
    </Link>
  );
}
function TaskRow({ label, counts }: { label: string; counts: Sum | undefined }) {
  return (
    <>
      <span className="text-left text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
        {label}
      </span>
      {[counts?.open, counts?.completed, counts?.notResponded, counts?.overdue].map(
        (value, index) => (
          <TileNumber
            key={index}
            className="font-display text-[15px] font-medium text-foreground sm:text-[19px]"
          >
            {value ?? 0}
          </TileNumber>
        ),
      )}
    </>
  );
}
