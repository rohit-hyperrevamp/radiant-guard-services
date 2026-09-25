import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, Landmark, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageStat } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string; code: string | null; name: string | null; status: string | null;
  client_type: string | null; mapping_payroll_window_id: string | null;
  mapping_pay_day: number | null; dividing_factor: number | null;
  salary_slip_required: boolean | null; payroll_manager_id: string | null;
  customers: { name: string | null; code: string | null } | null;
};

const PAGE = 25;
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

async function fetchMyClients() {
  const { data: me } = await supabase.rpc("current_user_candidate_id");
  if (!me) return { rows: [] as Row[], windows: new Map<string, string>(), people: new Map<string, string>() };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase as any)
      .from("units")
      .select("id,code,name,status,client_type,mapping_payroll_window_id,mapping_pay_day,dividing_factor,salary_slip_required,payroll_manager_id,customers:customer_id(name,code)")
      .eq("hr_executive_id", me as string).order("code").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const { data: w } = await supabase.from("payroll_windows").select("id,label");
  const windows = new Map((w ?? []).map((x) => [x.id, String(x.label ?? "")]));
  const ids = [...new Set(rows.map((r) => r.payroll_manager_id).filter(Boolean))] as string[];
  const people = new Map<string, string>();
  if (ids.length) {
    const { data: p } = await supabase.from("candidates").select("id,full_name").in("id", ids);
    (p ?? []).forEach((x) => people.set(x.id, x.full_name));
  }
  return { rows, windows, people };
}

function Breakdown({ title, items, active, onPick }: { title: string; items: [string, number][]; active: string | null; onPick: (k: string | null) => void }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([key, count]) => (
          <Button key={key} type="button" variant={active === key ? "default" : "outline"} size="sm"
            onClick={() => onPick(active === key ? null : key)} className="h-8 gap-2 rounded-lg px-2.5 text-xs">
            <span className="max-w-40 truncate">{key}</span><span className="tabular-nums opacity-70">{count}</span>
          </Button>
        ))}
        {!items.length && <span className="text-xs text-muted-foreground">No data</span>}
      </div>
    </div>
  );
}

export function HrExecutiveDashboard() {
  const q = useQuery({ queryKey: ["hr-executive-clients"], queryFn: fetchMyClients, staleTime: 60_000 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<{ kind: "df" | "cycle" | "day" | "type"; value: string } | null>(null);
  const [page, setPage] = useState(0);
  const view = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const cycle = (r: Row) => (r.mapping_payroll_window_id && q.data?.windows.get(r.mapping_payroll_window_id)) || "Not set";
    const df = (r: Row) => r.dividing_factor == null ? "Not set" : String(Number(r.dividing_factor));
    const day = (r: Row) => r.mapping_pay_day ? ordinal(r.mapping_pay_day) : "Not set";
    const type = (r: Row) => r.client_type || "Not set";
    const count = (fn: (r: Row) => string) => {
      const values = new Map<string, number>();
      rows.forEach((r) => values.set(fn(r), (values.get(fn(r)) ?? 0) + 1));
      return [...values.entries()].sort((a, b) => b[1] - a[1]);
    };
    const pick = { df, cycle, day, type };
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((r) => (!filter || pick[filter.kind](r) === filter.value)
      && (!term || [r.code, r.name, r.customers?.name].some((v) => (v ?? "").toLowerCase().includes(term))));
    return { rows, filtered, cycle, df, day, type, byDf: count(df), byCycle: count(cycle), byDay: count(day), byType: count(type) };
  }, [q.data, search, filter]);
  const setF = (kind: "df" | "cycle" | "day" | "type") => (value: string | null) => { setFilter(value ? { kind, value } : null); setPage(0); };
  const active = (kind: string) => filter?.kind === kind ? filter.value : null;
  const pages = Math.max(1, Math.ceil(view.filtered.length / PAGE));
  const shown = view.filtered.slice(page * PAGE, page * PAGE + PAGE);
  const organizations = new Set(view.rows.map((r) => r.customers?.code || r.customers?.name).filter(Boolean)).size;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <PageStat label="My clients" value={q.isLoading ? "…" : view.rows.length} icon={Users} accent="sky" />
        <PageStat label="Organizations" value={q.isLoading ? "…" : organizations} icon={Building2} accent="violet" />
        <PageStat label="Banks" value={q.isLoading ? "…" : view.rows.filter((r) => r.client_type?.toLowerCase() === "bank").length} icon={Landmark} accent="emerald" />
        <PageStat label="Salary slips" value={q.isLoading ? "…" : view.rows.filter((r) => r.salary_slip_required).length} icon={CalendarDays} accent="amber" />
      </div>
      <div className="grid gap-4 border-y border-border/60 bg-card/45 px-3 py-4 sm:grid-cols-2 sm:px-4 xl:grid-cols-4">
        <Breakdown title="By client type" items={view.byType} active={active("type")} onPick={setF("type")} />
        <Breakdown title="By dividing factor" items={view.byDf} active={active("df")} onPick={setF("df")} />
        <Breakdown title="By pay cycle" items={view.byCycle} active={active("cycle")} onPick={setF("cycle")} />
        <Breakdown title="By pay date" items={view.byDay} active={active("day")} onPick={setF("day")} />
      </div>
      <section className="overflow-hidden rounded-xl border border-border/60 bg-card/70 shadow-sm sm:rounded-2xl">
        <div className="flex flex-col gap-2 border-b border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2"><h2 className="font-display text-base font-semibold">My clients</h2>
            {filter && <Badge variant="secondary" className="cursor-pointer" onClick={() => setF(filter.kind)(null)}>{filter.value} ×</Badge>}
          </div>
          <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 rounded-xl border-border/60 bg-background pl-9" placeholder="Search client ID or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-secondary/50"><TableRow><TableHead>Client ID</TableHead><TableHead>Client</TableHead><TableHead>Organization</TableHead><TableHead>Type</TableHead><TableHead>Pay cycle</TableHead><TableHead>Pay date</TableHead><TableHead>Dividing factor</TableHead><TableHead>Salary slip</TableHead><TableHead>Payroll manager</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.map((r) => <TableRow key={r.id}>
              <TableCell className="font-mono text-xs font-semibold text-accent">{r.code}</TableCell><TableCell className="min-w-56 font-semibold">{r.name}</TableCell>
              <TableCell className="min-w-48 text-muted-foreground">{r.customers?.name}</TableCell><TableCell>{view.type(r)}</TableCell><TableCell>{view.cycle(r)}</TableCell>
              <TableCell>{view.day(r)}</TableCell><TableCell className="tabular-nums">{view.df(r)}</TableCell><TableCell>{r.salary_slip_required == null ? "—" : r.salary_slip_required ? "Yes" : "No"}</TableCell>
              <TableCell className="min-w-44">{(r.payroll_manager_id && q.data?.people.get(r.payroll_manager_id)) || "—"}</TableCell>
            </TableRow>)}
            {!shown.length && <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">{q.isLoading ? "Loading…" : "No clients match this view"}</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-3 py-3 text-sm sm:px-5">
          <span className="text-muted-foreground">Page {page + 1} of {pages} · {view.filtered.length} clients</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </section>
    </div>
  );
}
