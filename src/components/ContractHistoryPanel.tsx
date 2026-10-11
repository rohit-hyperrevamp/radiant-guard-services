import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type ContractRow = {
  id: string;
  contract_code: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  contract_resources: { id: string; gross: number | null; quantity: number | null }[] | null;
};

type RateRow = {
  period_year: number;
  period_month: number;
  designation_name: string;
  payslips: number;
  duties: number;
  extra_duties: number;
  gross: number;
  net_pay: number;
  gross_per_duty: number | null;
  full_month_gross: number | null;
};

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** All contracts (revisions) for a site over time, plus past pay rates from archived Pages payslips. */
export function ContractHistoryPanel({ unitId, currentId }: { unitId: string; currentId: string }) {
  const [showRates, setShowRates] = useState(false);

  const contracts = useQuery({
    queryKey: ["contract-history", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts" as never)
        .select("id,contract_code,status,start_date,end_date,description,contract_resources(id,gross,quantity)")
        .eq("unit_id", unitId)
        .eq("record_type", "client")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContractRow[];
    },
  });

  const rates = useQuery({
    queryKey: ["pages-rate-history", unitId],
    enabled: !!unitId && showRates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages_rate_history" as never)
        .select("*")
        .eq("unit_id", unitId)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as RateRow[];
    },
  });

  const list = contracts.data ?? [];

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Contract history for this site ({list.length})
        </div>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setShowRates((v) => !v)}
        >
          {showRates ? "Hide past pay rates" : "Show past pay rates (from payslips)"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left">Contract</th>
              <th className="px-2 py-1.5 text-left">From</th>
              <th className="px-2 py-1.5 text-left">To</th>
              <th className="px-2 py-1.5 text-left">Status</th>
              <th className="px-2 py-1.5 text-right">Roles</th>
              <th className="px-2 py-1.5 text-right">Monthly gross (all roles)</th>
            </tr>
          </thead>
          <tbody>
            {contracts.isLoading && (
              <tr><td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {list.map((c) => {
              const res = c.contract_resources ?? [];
              const gross = res.reduce((s, r) => s + (Number(r.gross) || 0), 0);
              return (
                <tr key={c.id} className={c.id === currentId ? "bg-primary/10 font-semibold" : "border-t border-border"}>
                  <td className="px-2 py-1.5 font-mono">{c.contract_code ?? "—"}</td>
                  <td className="px-2 py-1.5">{c.start_date ?? "—"}</td>
                  <td className="px-2 py-1.5">{c.end_date ?? "—"}</td>
                  <td className="px-2 py-1.5 capitalize">{c.status ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{res.length || "No rates"}</td>
                  <td className="px-2 py-1.5 text-right">{res.length ? inr(gross) : "See past pay rates"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showRates && (
        <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Month</th>
                <th className="px-2 py-1.5 text-left">Role</th>
                <th className="px-2 py-1.5 text-right">Payslips</th>
                <th className="px-2 py-1.5 text-right">Duties</th>
                <th className="px-2 py-1.5 text-right">Extra Duty</th>
                <th className="px-2 py-1.5 text-right">Gross per duty</th>
                <th className="px-2 py-1.5 text-right">Full-month gross</th>
                <th className="px-2 py-1.5 text-right">Total gross</th>
                <th className="px-2 py-1.5 text-right">Total net pay</th>
              </tr>
            </thead>
            <tbody>
              {rates.isLoading && (
                <tr><td colSpan={9} className="px-2 py-3 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!rates.isLoading && (rates.data ?? []).length === 0 && (
                <tr><td colSpan={9} className="px-2 py-3 text-center text-muted-foreground">No past payslips for this site.</td></tr>
              )}
              {(rates.data ?? []).map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1.5">{MONTHS[r.period_month - 1]} {r.period_year}</td>
                  <td className="px-2 py-1.5">{r.designation_name}</td>
                  <td className="px-2 py-1.5 text-right">{r.payslips}</td>
                  <td className="px-2 py-1.5 text-right">{Number(r.duties)}</td>
                  <td className="px-2 py-1.5 text-right">{Number(r.extra_duties)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(r.gross_per_duty)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(r.full_month_gross)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(r.gross)}</td>
                  <td className="px-2 py-1.5 text-right">{inr(r.net_pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
