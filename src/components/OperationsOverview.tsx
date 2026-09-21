import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight, MapPinned, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";
import { ROLE_KEYS } from "@/lib/role-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ActiveUnit = {
  id: string;
  code: string | null;
  name: string | null;
  billing_city: string | null;
  billing_state: string | null;
  customer: { name: string | null } | null;
};

type VisitRow = { unit_id: string; visit_date: string; check_out_at: string | null };

export type RankedSite = { id: string; label: string; code: string | null; count: number };

export type OperationsOverviewData = {
  fieldOfficers: number;
  activeSites: number;
  sitesVisitedToday: number;
  topVisited: RankedSite[];
  bottomVisited: RankedSite[];
  locations: Array<{ label: string; code: string | null; city: string; state: string }>;
};

function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function loadOperationsOverview(): Promise<OperationsOverviewData> {
  const [units, visits, foCount] = await Promise.all([
    fetchAllPages<ActiveUnit>((from, to) =>
      supabase
        .from("units")
        .select("id,code,name,billing_city,billing_state,customer:customers(name)")
        .eq("status", "active")
        .order("name")
        .range(from, to),
    ),
    fetchAllPages<VisitRow>((from, to) =>
      supabase
        .from("field_visits")
        .select("unit_id,visit_date,check_out_at")
        .gte("visit_date", monthStart())
        .lte("visit_date", localDate())
        .range(from, to),
    ),
    supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("role_key", ROLE_KEYS.FIELD_OFFICER)
      .in("status", ["approved", "active"]),
  ]);

  if (foCount.error) throw foCount.error;
  const activeIds = new Set(units.map((u) => u.id));
  const today = localDate();
  const sitesVisitedToday = new Set(
    visits.filter((v) => v.visit_date === today && activeIds.has(v.unit_id)).map((v) => v.unit_id),
  ).size;
  const counts = new Map<string, number>();
  for (const visit of visits) {
    if (!visit.check_out_at || !activeIds.has(visit.unit_id)) continue;
    counts.set(visit.unit_id, (counts.get(visit.unit_id) ?? 0) + 1);
  }
  const ranked: RankedSite[] = units.map((u) => ({
    id: u.id,
    code: u.code,
    label: [u.customer?.name, u.name || u.code].filter(Boolean).join(" — ") || "Unnamed client site",
    count: counts.get(u.id) ?? 0,
  }));
  const ascending = [...ranked].sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
  const descending = [...ranked].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    fieldOfficers: foCount.count ?? 0,
    activeSites: units.length,
    sitesVisitedToday,
    topVisited: descending.slice(0, 5),
    bottomVisited: ascending.slice(0, 5),
    locations: units.map((u) => ({
      label: [u.customer?.name, u.name || u.code].filter(Boolean).join(" — ") || "Unnamed client site",
      code: u.code,
      city: u.billing_city?.trim() || "Not recorded",
      state: u.billing_state?.trim() || "Not recorded",
    })),
  };
}

export function useOperationsOverview() {
  return useQuery({
    queryKey: ["operations-overview", monthStart(), localDate()],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: loadOperationsOverview,
  });
}

const PAGE_SIZE = 10;

export function OperationsClientLocations({ data }: { data?: OperationsOverviewData }) {
  const [mode, setMode] = useState<"city" | "state">("city");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const rows = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of data?.locations ?? []) {
      const key = mode === "city" ? item.city : item.state;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    const tokens = search.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return Array.from(groups, ([label, count]) => ({ label, count }))
      .filter((row) => tokens.length === 0 || tokens.every((t) => row.label.toLowerCase().includes(t)))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [data, mode, search]);

  const groupClients = useMemo(() => {
    if (!openGroup) return [];
    return (data?.locations ?? [])
      .filter((item) => (mode === "city" ? item.city : item.state) === openGroup)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, mode, openGroup]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const max = rows[0]?.count ?? 1;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Client footprint</div>
          <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-bold text-foreground">
            <MapPinned className="h-4 w-4 text-muted-foreground" /> Active sites by {mode}
          </h3>
        </div>
        <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5 text-[11px] font-semibold">
          {(["city", "state"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={mode === value ? "default" : "ghost"}
              onClick={() => { setMode(value); setPage(0); }}
              className="h-7 px-3 capitalize"
            >
              By {value}
            </Button>
          ))}
        </div>
      </header>
      <div className="border-b border-border/50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder={`Search ${mode}`}
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>
      <ul className="divide-y divide-border/50 px-4">
        {visible.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-foreground">{row.label}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold tabular-nums text-foreground">{row.count}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">sites</div>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setOpenGroup(row.label)}>
              View clients
            </Button>
          </li>
        ))}
        {visible.length === 0 && <li className="py-8 text-center text-xs text-muted-foreground">No locations match.</li>}
      </ul>
      <footer className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
        <span>{rows.length} {mode === "city" ? "cities" : "states"} · {data?.activeSites ?? 0} active sites</span>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" className="h-7 w-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-12 text-center">{current + 1} / {pageCount}</span>
          <Button type="button" size="icon" variant="outline" className="h-7 w-7" disabled={current + 1 >= pageCount} onClick={() => setPage(current + 1)} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </footer>

      <Dialog open={openGroup !== null} onOpenChange={(open) => !open && setOpenGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {openGroup} · {groupClients.length} active client site{groupClients.length === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border/50 overflow-y-auto">
            {groupClients.map((item, index) => (
              <li key={`${item.code ?? item.label}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-[13px] text-foreground">{item.label}</span>
                {item.code && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.code}</span>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function VisitInsightTile({ kind, items }: { kind: "most" | "least"; items: RankedSite[] }) {
  const most = kind === "most";
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <Link
      to="/admin/field-sense"
      search={{ range: "this_month", highlight: kind }}
      className={`group relative flex h-[124px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/40 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:h-[172px] sm:rounded-[26px] sm:p-5 ${most ? "bg-emerald-100/80 dark:bg-emerald-500/15" : "bg-amber-100/80 dark:bg-amber-500/15"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="truncate whitespace-nowrap font-display text-[13px] font-medium text-foreground sm:text-[15px]">
            {most ? "Top 5 most visited" : "Bottom 5 least visited"}
          </div>
          <div className="mt-0.5 truncate whitespace-nowrap text-[10px] text-muted-foreground sm:mt-1 sm:text-[11px]">This month · all field officers</div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display whitespace-nowrap text-[26px] font-medium leading-none tabular-nums text-foreground sm:text-[40px]">{total}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">visits</span>
      </div>
      <ul className="mt-1 hidden space-y-1 sm:block">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 truncate text-foreground/90">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{item.count}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-[11px] text-muted-foreground">No visits recorded yet</li>}
      </ul>
      <div className="mt-auto pt-2 text-[10px] font-semibold text-muted-foreground">
        <Building2 className="mr-1 inline h-3 w-3" /> Open filtered list in Radar
      </div>
    </Link>
  );
}
