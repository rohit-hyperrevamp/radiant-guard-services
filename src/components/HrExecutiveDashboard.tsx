import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
  client_type: string | null;
  mapping_payroll_window_id: string | null;
  mapping_pay_day: number | null;
  dividing_factor: number | null;
  compliance_frequency: string | null;
  salary_slip_required: boolean | null;
  payroll_manager_id: string | null;
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
      .select("id,code,name,status,client_type,mapping_payroll_window_id,mapping_pay_day,dividing_factor,compliance_frequency,salary_slip_required,payroll_manager_id,customers:customer_id(name,code)")
      .eq("hr_executive_id", me as string)
      .order("code")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const { data: w } = await supabase.from("payroll_windows").select("id,label");
  const windows = new Map((w ?? []).map((x: any) => [x.id as string, String(x.label ?? "")]));
  const ids = [...new Set(rows.map((r) => r.payroll_manager_id).filter(Boolean))] as string[];
  const people = new Map<string, string>();
  if (ids.length) {
    const { data: p } = await supabase.from("candidates").select("id,full_name").in("id", ids);
    (p ?? []).forEach((x: any) => people.set(x.id, x.full_name));
  }
  return { rows, windows, people };
}

function Breakdown({ title, items, active, onPick }: { title: string; items: [string, number][]; active: string | null; onPick: (k: string | null) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.map(([k, n]) => (
          <button key={k} onClick={() => onPick(active === k ? null : k)}
            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted ${active === k ? "bg-muted font-medium" : ""}`}>
            <span>{k}</span><span className="tabular-nums text-muted-foreground">{n}</span>
          </button>
        ))}
        {!items.length && <span className="text-sm text-muted-foreground">No data</span>}
      </CardContent>
    </Card>
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
    const df = (r: Row) => (r.dividing_factor == null ? "Not set" : String(Number(r.dividing_factor)));
    const day = (r: Row) => (r.mapping_pay_day ? ordinal(r.mapping_pay_day) : "Not set");
    const type = (r: Row) => r.client_type || "Not set";
    const count = (fn: (r: Row) => string) => {
      const m = new Map<string, number>();
      rows.forEach((r) => m.set(fn(r), (m.get(fn(r)) ?? 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const pick = { df, cycle, day, type };
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((r) =>
      (!filter || pick[filter.kind](r) === filter.value) &&
      (!term || [r.code, r.name, r.customers?.name].some((v) => (v ?? "").toLowerCase().includes(term))));
    return { rows, filtered, cycle, df, day, type, byDf: count(df), byCycle: count(cycle), byDay: count(day), byType: count(type) };
  }, [q.data, search, filter]);

  const setF = (kind: "df" | "cycle" | "day" | "type") => (v: string | null) => { setFilter(v ? { kind, value: v } : null); setPage(0); };
  const act = (k: string) => (filter?.kind === k ? filter.value : null);
  const pages = Math.max(1, Math.ceil(view.filtered.length / PAGE));
  const shown = view.filtered.slice(page * PAGE, page * PAGE + PAGE);
  const monthly = view.rows.filter((r) => r.compliance_frequency === "monthly").length;
  const slips = view.rows.filter((r) => r.salary_slip_required).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["My clients", view.rows.length], ["Banks", view.rows.filter((r) => r.client_type === "Bank").length], ["Monthly compliance", monthly], ["Salary slips to send", slips]].map(([l, v]) => (
          <Card key={l as string} className="bg-gradient-to-br from-primary/10 to-transparent">
            <CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold tabular-nums">{q.isLoading ? "…" : v}</div></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Breakdown title="By client type" items={view.byType} active={act("type")} onPick={setF("type")} />
        <Breakdown title="By dividing factor" items={view.byDf} active={act("df")} onPick={setF("df")} />
        <Breakdown title="By pay cycle" items={view.byCycle} active={act("cycle")} onPick={setF("cycle")} />
        <Breakdown title="By pay date" items={view.byDay} active={act("day")} onPick={setF("day")} />
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">My clients {filter && <Badge variant="secondary" className="ml-2 cursor-pointer" onClick={() => setF(filter.kind)(null)}>{filter.value} ✕</Badge>}</CardTitle>
          <Input className="max-w-xs" placeholder="Search client ID or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3">Client ID</th><th className="pr-3">Client</th><th className="pr-3">Organization</th><th className="pr-3">Type</th><th className="pr-3">Pay cycle</th><th className="pr-3">Pay date</th><th className="pr-3">Dividing factor</th><th className="pr-3">Compliance</th><th className="pr-3">Salary slip</th><th>Payroll manager</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 pr-3 font-medium">{r.code}</td>
                  <td className="pr-3">{r.name}</td>
                  <td className="pr-3 text-muted-foreground">{r.customers?.name}</td>
                  <td className="pr-3">{view.type(r)}</td>
                  <td className="pr-3">{view.cycle(r)}</td>
                  <td className="pr-3">{view.day(r)}</td>
                  <td className="pr-3 tabular-nums">{view.df(r)}</td>
                  <td className="pr-3 capitalize">{r.compliance_frequency ?? "—"}</td>
                  <td className="pr-3">{r.salary_slip_required == null ? "—" : r.salary_slip_required ? "Yes" : "No"}</td>
                  <td>{(r.payroll_manager_id && q.data?.people.get(r.payroll_manager_id)) || "—"}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">{q.isLoading ? "Loading…" : "No clients"}</td></tr>}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">Page {page + 1} of {pages} · {view.filtered.length} clients</span>
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
