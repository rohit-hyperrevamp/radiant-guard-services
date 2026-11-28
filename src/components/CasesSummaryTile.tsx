import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TileNumber } from "@/components/TileNumber";
import { ACCENT_TILE_BG } from "@/components/tile-theme";

export function useCaseSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["case-summary"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("legal_cases").select("status,priority,case_number,next_hearing_on"); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (error) throw error;
      const rows = (data ?? []) as { status: string; priority: string; case_number: string; next_hearing_on: string | null }[];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const up = rows.filter((r) => r.status !== "closed" && r.next_hearing_on && new Date(r.next_hearing_on + "T00:00:00") >= today)
        .sort((a, b) => a.next_hearing_on!.localeCompare(b.next_hearing_on!));
      const next = up[0] ? { case_number: up[0].case_number, days: Math.round((new Date(up[0].next_hearing_on + "T00:00:00").getTime() - today.getTime()) / 86400000) } : null;
      const n = (s: string) => rows.filter((r) => r.status === s).length;
      return { total: rows.length, open: n("open"), progress: n("in_progress") + n("on_hold"), closed: n("closed"), high: rows.filter((r) => r.status !== "closed" && (r.priority === "high" || r.priority === "critical")).length, upcoming: up.length, next };
    },
  });
}

/** Case Desk counts: total, open, in progress, closed. */
export function CasesSummaryTile({ summary }: { summary: { total: number; open: number; progress: number; closed: number; high?: number; upcoming?: number; next?: { case_number: string; days: number } | null } | null }) {
  const cells = [
    { label: "Total", v: summary?.total },
    { label: "Open", v: summary?.open },
    { label: "Ongoing", v: summary?.progress },
    { label: "Upcoming", v: summary?.upcoming },
    { label: "High", v: summary?.high },
  ];
  return (
    <Link
      to="/admin/cases"
      search={{ view: "upcoming" }}
      className={`dashboard-summary-tile task-summary-tile group relative flex h-[124px] min-w-0 flex-col rounded-2xl border border-border/40 ${ACCENT_TILE_BG.indigo} p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:h-[172px] sm:rounded-[26px] sm:p-5`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="dashboard-tile-title flex items-center gap-1.5 font-display text-[13px] font-medium text-foreground sm:text-[15px]">
          <Scale className="h-3.5 w-3.5 shrink-0" />
          Case Desk
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border/60 sm:h-9 sm:w-9">
          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      {summary?.next && (
        <div className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">
          Next date: <span className="font-medium text-foreground">{summary.next.case_number}</span> · {summary.next.days === 0 ? "today" : summary.next.days === 1 ? "tomorrow" : `in ${summary.next.days} days`}
        </div>
      )}
      <div className="mt-auto grid min-w-0 grid-cols-5 gap-x-1 gap-y-1 text-center">
        {cells.map((c) => (
          <TileNumber variant="label" key={c.label} className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">{c.label}</TileNumber>
        ))}
        {cells.map((c) => (
          <TileNumber key={c.label + "v"} className="font-display text-[15px] font-medium text-foreground sm:text-[19px]">{c.v ?? 0}</TileNumber>
        ))}
      </div>
    </Link>
  );
}
