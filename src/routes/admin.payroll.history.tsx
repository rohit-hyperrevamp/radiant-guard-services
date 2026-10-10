import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSessionState } from "@/lib/use-session-state";

export const Route = createFileRoute("/admin/payroll/history")({
  head: () => ({
    meta: [
      { title: "Payroll History (Pages archive) — Radiant" },
      { name: "description", content: "Past payslips from April 2023 to August 2026, copied from Pages Payroll." },
      { property: "og:title", content: "Payroll History — Radiant" },
      { property: "og:description", content: "Archived payslips by client, month and employee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayrollHistory,
});

type Row = {
  id: string; client_code: string | null; client_name: string | null; employee_code: string | null;
  employee_name: string | null; designation_name: string | null; period_year: number; period_month: number;
  period_start: string | null; period_end: string | null; duty: number; ot: number; gross: number;
  total_deductions: number; net_pay: number; earnings: { name: string; amount: number }[]; deductions: { name: string; amount: number }[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PERIODS: string[] = [];
for (let y = 2026; y >= 2023; y--) for (let m = 12; m >= 1; m--) {
  if ((y === 2026 && m > 8) || (y === 2023 && m < 4)) continue;
  PERIODS.push(`${y}-${m}`);
}
const inr = (n: number) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const PAGE = 200;

function PayrollHistory() {
  const [period, setPeriod] = useSessionState("payroll-history.period", PERIODS[0]);
  const [q, setQ] = useSessionState("payroll-history.q", "");
  const [term, setTerm] = useState(q);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Row | null>(null);
  const [y, m] = period.split("-").map(Number);

  const { data, isLoading } = useQuery({
    queryKey: ["pages-payslip-archive", period, q, page],
    queryFn: async () => {
      let qb = (supabase.from as any)("pages_payslip_archive")
        .select("id,client_code,client_name,employee_code,employee_name,designation_name,period_year,period_month,period_start,period_end,duty,ot,gross,total_deductions,net_pay,earnings,deductions", { count: "exact" })
        .eq("period_year", y).eq("period_month", m)
        .order("client_code").order("employee_code")
        .range(page * PAGE, page * PAGE + PAGE - 1);
      const s = q.trim().replace(/[,()%]/g, " ").trim();
      if (s) qb = qb.or(`client_code.ilike.%${s}%,client_name.ilike.%${s}%,employee_code.ilike.%${s}%,employee_name.ilike.%${s}%`);
      const { data, error, count } = await qb;
      if (error) throw error;
      return { rows: (data ?? []) as Row[], count: count ?? 0 };
    },
  });
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Payroll History" description="Past payslips copied from Pages Payroll (Apr 2023 – Aug 2026). Read only." />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild><Link to="/admin/payroll"><ArrowLeft className="mr-1 h-4 w-4" />Payroll</Link></Button>
        <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => { const [py, pm] = p.split("-").map(Number); return <SelectItem key={p} value={p}>{MONTHS[pm - 1]} {py}</SelectItem>; })}</SelectContent>
        </Select>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(term); setPage(0); }}>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Client ID, client, employee code or name" className="w-80" />
          <Button type="submit" size="sm"><Search className="h-4 w-4" /></Button>
        </form>
        <span className="text-sm text-muted-foreground">{data?.count ?? 0} payslips</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>{["Client ID","Client","Emp code","Employee","Role","Duties","ED","Gross","Deductions","Net pay"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No payslips for this month.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setOpen(r)}>
                <td className="px-3 py-2">{r.client_code}</td><td className="px-3 py-2">{r.client_name}</td>
                <td className="px-3 py-2">{r.employee_code}</td><td className="px-3 py-2">{r.employee_name}</td>
                <td className="px-3 py-2">{r.designation_name}</td><td className="px-3 py-2 text-right">{r.duty}</td>
                <td className="px-3 py-2 text-right">{r.ot}</td><td className="px-3 py-2 text-right">{inr(r.gross)}</td>
                <td className="px-3 py-2 text-right">{inr(r.total_deductions)}</td><td className="px-3 py-2 text-right font-medium">{inr(r.net_pay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm">Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (<>
            <DialogHeader><DialogTitle>{open.employee_name} ({open.employee_code}) — {MONTHS[open.period_month - 1]} {open.period_year}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{open.client_code} · {open.client_name} · {open.designation_name} · {open.period_start} to {open.period_end} · Duties {open.duty}, ED {open.ot}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([["Earnings", open.earnings, open.gross], ["Deductions", open.deductions, open.total_deductions]] as const).map(([t, list, tot]) => (
                <div key={t} className="rounded-md border p-3">
                  <div className="mb-2 font-medium">{t}</div>
                  {(list ?? []).filter((x) => x.amount).map((x, i) => <div key={i} className="flex justify-between text-sm"><span>{x.name}</span><span>{inr(x.amount)}</span></div>)}
                  <div className="mt-2 flex justify-between border-t pt-2 text-sm font-medium"><span>Total</span><span>{inr(tot)}</span></div>
                </div>
              ))}
            </div>
            <div className="text-right font-semibold">Net pay ₹{inr(open.net_pay)}</div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
