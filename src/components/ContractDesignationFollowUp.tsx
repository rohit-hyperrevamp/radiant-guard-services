import { TileNumber } from "@/components/TileNumber";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BadgeIndianRupee, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type MissingContractDesignation = {
  candidate_id: string;
  full_name: string;
  employee_code: string | null;
  candidate_code: string | null;
  unit_id: string;
  unit_name: string;
  unit_code: string;
  customer_name: string;
  designation_id: string;
  designation_name: string;
  contract_id: string | null;
  missing_since: string;
};

type FollowUpRow = MissingContractDesignation & { due: string; days: number };
const QUERY_KEY = ["contract-designation-follow-up"] as const;
const RPC = "get_missing_contract_designations" as never;
const PAGE = 1000;
/** Results are cached for five minutes: the RPC takes seconds per call. */
export const FOLLOW_UP_TTL_MS = 5 * 60_000;

function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Latest `missing_since` date that counts as overdue (7+ days old) — the same
 * rule as `withAge(row).days >= 7`, as a server-side filter value.
 */
export function followUpOverdueCutoff(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return localIsoDate(d);
}

export function withAge(row: MissingContractDesignation, now: Date = new Date()): FollowUpRow {
  const source = row.missing_since.slice(0, 10);
  const start = new Date(`${source}T00:00:00`).getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((today.getTime() - start) / 86_400_000));
  return {
    ...row,
    missing_since: source,
    due: new Date(start + 7 * 86_400_000).toISOString().slice(0, 10),
    days,
  };
}

/** Tile numbers: two head-only count calls (no rows are transferred). */
async function fetchFollowUpCounts(): Promise<{ total: number; overdue: number }> {
  const [all, late] = await Promise.all([
    supabase.rpc(RPC, undefined as never, { count: "exact", head: true }),
    supabase
      .rpc(RPC, undefined as never, { count: "exact", head: true })
      .lte("missing_since" as never, followUpOverdueCutoff() as never),
  ]);
  if (all.error) throw all.error;
  if (late.error) throw late.error;
  return { total: all.count ?? 0, overdue: late.count ?? 0 };
}

/** Full list — only loaded once the dialog is opened. */
async function fetchFollowUpRows(): Promise<FollowUpRow[]> {
  // Page through every row: a single RPC call is capped at 1,000 rows.
  const all: MissingContractDesignation[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc(RPC).range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as MissingContractDesignation[];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all.map((row) => withAge(row));
}

export function ContractDesignationFollowUp({
  fieldOfficer = false,
  compact: _compact = false,
  actionable = false,
  className,
}: {
  fieldOfficer?: boolean;
  compact?: boolean;
  actionable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const scope = fieldOfficer ? "mine" : "all";

  useEffect(() => {
    // Drop the old device-wide snapshot (it was not tied to the signed-in user).
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`contract-designation-follow-up:${scope}`);
    } catch {
      /* ignore */
    }
  }, [scope]);

  const countsQ = useQuery({
    queryKey: [...QUERY_KEY, scope, "counts"],
    staleTime: FOLLOW_UP_TTL_MS,
    gcTime: FOLLOW_UP_TTL_MS * 2,
    refetchInterval: FOLLOW_UP_TTL_MS,
    queryFn: fetchFollowUpCounts,
  });
  const listQ = useQuery({
    queryKey: [...QUERY_KEY, scope, "rows"],
    enabled: open,
    staleTime: FOLLOW_UP_TTL_MS,
    gcTime: FOLLOW_UP_TTL_MS * 2,
    queryFn: fetchFollowUpRows,
  });

  useEffect(() => {
    // Mark everything stale; only active queries (the counts, and the list
    // while open) refetch. Debounced so a bulk edit triggers one refresh.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: QUERY_KEY }), 3_000);
    };
    const channel = supabase
      .channel(`contract-designation-follow-up-${scope}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "candidate_units" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_resources" },
        refresh,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "client_contracts" }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [scope, queryClient]);

  const rows = listQ.data ?? [];
  // Once the list is loaded it is the source of truth; until then the counts.
  const total = listQ.data ? rows.length : countsQ.data?.total;
  const overdue = useMemo(
    () => (listQ.data ? rows.filter((row) => row.days >= 7).length : countsQ.data?.overdue ?? 0),
    [listQ.data, rows, countsQ.data],
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          "dashboard-summary-tile group flex w-full min-w-0 flex-col items-stretch border border-border/50 bg-secondary text-left shadow-sm transition hover:border-primary/35 hover:bg-secondary hover:shadow-md",
          className,
        )}
      >
        <div className="min-w-0">
          <TileNumber variant="label" className="dashboard-tile-title text-foreground">
            Contract designation
          </TileNumber>
          <TileNumber variant="label" className="mt-1 text-[11px] text-muted-foreground">
            {overdue ? `${overdue} overdue` : "Seven-day follow-up"}
          </TileNumber>
        </div>
        <div className="mt-auto flex min-w-0 items-end justify-between gap-3">
          <TileNumber className="font-display font-medium text-foreground">
            {total == null ? "—" : total}
          </TileNumber>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-primary ring-1 ring-border sm:h-9 sm:w-9">
            <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        </div>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract designation follow-up</DialogTitle>
            <DialogDescription>
              Postings whose designation still needs a billing line in the unit contract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {listQ.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading follow-ups…</div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                All posted designations are covered by their contracts.
              </div>
            ) : (
              rows.map((row) => {
                const tone =
                  row.days >= 7
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : row.days >= 4
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                return (
                  <div
                    key={`${row.candidate_id}:${row.unit_id}:${row.designation_id}`}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{row.full_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row.employee_code || row.candidate_code || "Code pending"} ·{" "}
                        {row.designation_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.customer_name} · {row.unit_name} ({row.unit_code})
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Missing since {row.missing_since} · Due {row.due}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] font-semibold",
                          tone,
                        )}
                      >
                        {row.days >= 7 ? `${row.days - 7}d overdue` : `${7 - row.days}d left`}
                      </span>
                      {actionable && (
                        <Button
                          asChild
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          title="Open this unit's contract"
                        >
                          <Link
                            to="/admin/contracts/client-contracts"
                            search={{ tab: "client", unit: row.unit_id }}
                            aria-label={`Open contract for ${row.unit_name}`}
                          >
                            <BadgeIndianRupee className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {(listQ.isError || countsQ.isError) && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Could not load contract designation follow-ups.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
