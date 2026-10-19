import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader, PageStat } from "@/components/PageHeader";
import { DataPagination, usePagination } from "@/components/DataPagination";
import { Input } from "@/components/ui/input";
import { fetchLeads, fetchQuotes, inr, QK, QUOTE_TONE, type CrmQuote } from "@/lib/crm";
import { cn } from "@/lib/utils";

type QStatus = CrmQuote["status"];

export const Route = createFileRoute("/admin/sales/quotes")({
  validateSearch: (s: Record<string, unknown>): { status?: QStatus } => ({
    status: ["draft", "sent", "signed", "rejected"].includes(String(s.status)) ? (s.status as QStatus) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Quotes — Radiant Sales" },
      { name: "description", content: "All sales quotes with their versions and signing status." },
      { property: "og:title", content: "Quotes — Radiant Sales" },
      { property: "og:description", content: "All sales quotes with their versions and signing status." },
    ],
  }),
  component: QuotesPage,
});


function QuotesPage() {
  const search = Route.useSearch();
  const [status, setStatus] = useState<QStatus | undefined>(search.status);
  const [q, setQ] = useState("");
  const quotesQ = useQuery({ queryKey: QK.quotes, queryFn: () => fetchQuotes() });
  const leadsQ = useQuery({ queryKey: QK.leads, queryFn: fetchLeads });
  const leadById = useMemo(() => new Map((leadsQ.data ?? []).map((l) => [l.id, l])), [leadsQ.data]);
  const quotes = quotesQ.data ?? [];
  const counts = useMemo(() => {
    const c: Record<QStatus, number> = { draft: 0, sent: 0, signed: 0, rejected: 0 };
    for (const x of quotes) c[x.status]++;
    return c;
  }, [quotes]);
  const filtered = quotes.filter((x) => {
    if (status && x.status !== status) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const l = leadById.get(x.lead_id);
    return `${x.quote_no} ${l?.company_name ?? ""} ${l?.lead_code ?? ""}`.toLowerCase().includes(s);
  });
  const pg = usePagination(filtered, 20);

  return (
    <div>
      <PageHeader
        eyebrow="Sales & Marketing"
        title="Quotes"
        description="Quotes are built on each prospect. Open a quote to edit lines or mark it sent or signed."
        crumbs={[{ label: "Sales & Marketing" }, { label: "Quotes" }]}
        kpis={
          <>
            <PageStat label="All" value={quotes.length} active={!status} onClick={() => setStatus(undefined)} />
            {(["draft", "sent", "signed", "rejected"] as const).map((k) => (
              <PageStat key={k} label={k[0].toUpperCase() + k.slice(1)} value={counts[k]} active={status === k} onClick={() => setStatus(status === k ? undefined : k)} tone={k === "signed" ? "success" : k === "rejected" ? "destructive" : k === "sent" ? "accent" : "default"} />
            ))}
          </>
        }
      />
      <div className="relative mb-3 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-10 rounded-xl border-transparent bg-card/80 pl-9 shadow-sm focus-visible:border-accent/30" placeholder="Search quote or company…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="ios-table w-full text-sm">
            <thead className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <tr><th className="px-4 py-3">Quote</th><th className="px-4 py-3">Prospect</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Monthly</th><th className="px-4 py-3">Valid until</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pg.pageRows.map((x) => {
                const l = leadById.get(x.lead_id);
                return (
                  <tr key={x.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs">{x.quote_no} v{x.version}</td>
                    <td className="px-4 py-3">
                      <Link to="/admin/sales/prospects/$leadId" params={{ leadId: x.lead_id }} className="font-medium hover:text-primary">{l?.company_name ?? "—"}</Link>
                      <div className="font-mono text-xs text-muted-foreground">{l?.lead_code}</div>
                    </td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", QUOTE_TONE[x.status])}>{x.status}</span></td>
                    <td className="px-4 py-3 tabular-nums">{inr(x.total_monthly)}</td>
                    <td className="px-4 py-3 text-xs">{x.valid_until ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{new Date(x.created_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                );
              })}
              {!quotesQ.isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No quotes yet. Create one from a prospect.</td></tr>}
              {quotesQ.error && <tr><td colSpan={6} className="px-4 py-10 text-center text-destructive">{(quotesQ.error as Error).message}</td></tr>}
            </tbody>
          </table>
        </div>
        <DataPagination {...pg} label="quotes" />
      </div>
    </div>
  );
}
