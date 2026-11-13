import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { complianceMonthQuery, complianceDirectory } from "@/lib/compliance-month";
import { fetchAllPages } from "@/lib/supabase-batch";
import {
  statutoryHead,
  ledgerAmount,
  ledgerStage,
  complianceMoney,
  type LedgerScope,
} from "@/lib/statutory-heads";
import { ComplianceLedgerScope } from "@/components/ComplianceLedgerScope";
import { useCurrentPermissions } from "@/lib/rbac";
import { ArrowLeft, ChevronRight, Download, Landmark, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { MONTH_NAMES, type LwfRow as LwfMaster } from "@/lib/lwf-lookup";

import { ComplianceAccessGate } from "@/components/ComplianceAccessGate";

function LwfRegisterPageGated() {
  return (
    <ComplianceAccessGate>
      <LwfRegisterPage />
    </ComplianceAccessGate>
  );
}

export const Route = createFileRoute("/admin/compliance-lwf")({
  component: LwfRegisterPageGated,
  validateSearch: (search: Record<string, unknown>): { ym?: string; scope?: LedgerScope } => ({
    ym: typeof search.ym === "string" ? search.ym : undefined,
    scope: search.scope === "pending" || search.scope === "all" ? search.scope : "posted",
  }),
  head: () => ({
    meta: [
      { title: "Labour Welfare Fund Register — Radiant Guard" },
      {
        name: "description",
        content:
          "State-wise Labour Welfare Fund contributions by frequency, split into employee and employer share, drillable down to the client and employee.",
      },
      { property: "og:title", content: "Labour Welfare Fund Register" },
      {
        property: "og:description",
        content: "State-wise LWF employee and employer contributions for the month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const inr = complianceMoney;

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const isLwfName = (name: string | null | undefined) => {
  const n = (name ?? "").toLowerCase();
  return n.includes("lwf") || n.includes("labour welfare") || n.includes("labor welfare");
};

type LwfPersonRow = {
  candidateId: string;
  name: string;
  code: string;
  state: string;
  unitId: string;
  unit: string;
  employee: number;
  employer: number;
};

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
}

function frequencyLabel(f: string | null | undefined) {
  const s = (f ?? "").trim().toLowerCase();
  if (!s) return "—";
  if (s.startsWith("month")) return "Monthly";
  if (s.startsWith("half")) return "Half-yearly";
  if (s.startsWith("quarter")) return "Quarterly";
  if (s.startsWith("year") || s.startsWith("annual")) return "Yearly";
  return f as string;
}

const FREQ_TONE: Record<string, string> = {
  Monthly: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  "Half-yearly": "bg-sky-500/10 text-sky-600 ring-sky-500/20",
  Quarterly: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
  Yearly: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
};

function useLwfData(ym: string, scope: LedgerScope) {
  return useQuery({
    queryKey: ["lwf-register", ym, scope],
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async (): Promise<{ rows: LwfPersonRow[]; masters: LwfMaster[] }> => {
      const [ledger, masterRows] = await Promise.all([
        complianceMonthQuery(ym, scope).queryFn(),
        fetchAllPages<LwfMaster>((a, b) =>
          supabase.from("labour_welfare_funds").select("*").order("id").range(a, b),
        ),
      ]);
      const deds = ledger.deds.filter((r) => statutoryHead(r.deduction_name) === "lwf");
      const contribs = ledger.contribs.filter((r) => statutoryHead(r.contribution_name) === "lwf");
      const directory = await complianceDirectory([...deds, ...contribs]);
      const grouped = new Map<string, LwfPersonRow>();
      const add = (
        r: { id: string; candidate_id: string | null; unit_id: string | null },
        amount: number,
        side: "employee" | "employer",
      ) => {
        const key = `${r.candidate_id ?? r.id}|${r.unit_id ?? "unknown"}`;
        let row = grouped.get(key);
        if (!row) {
          const c = r.candidate_id ? directory.people.get(r.candidate_id) : undefined;
          const u = r.unit_id ? directory.units.get(r.unit_id) : undefined;
          row = {
            candidateId: r.candidate_id ?? r.id,
            name: c?.full_name ?? "Unknown employee",
            code: c?.employee_code ?? c?.candidate_code ?? "—",
            state: (
              u?.pt_state ||
              u?.billing_state ||
              u?.shipping_state ||
              "Unknown original state"
            ).trim(),
            unitId: r.unit_id ?? "unknown",
            unit: u?.name ?? "Unknown original site",
            employee: 0,
            employer: 0,
          };
          grouped.set(key, row);
        }
        row[side] += amount;
      };
      deds.forEach((r) => add(r, ledgerAmount(r), "employee"));
      contribs.forEach((r) => add(r, ledgerAmount(r), "employer"));
      return {
        rows: [...grouped.values()],
        masters: masterRows.filter((m) => m.enabled !== false),
      };
    },
  });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold whitespace-nowrap tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function LwfRegisterPage() {
  const now = new Date();
  const { ym: ymParam, scope: scopeParam } = Route.useSearch();
  const scope = scopeParam ?? "posted";
  const ym = ymParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const navigate = useNavigate({ from: "/admin/compliance-lwf" });
  const setYm = (next: string) => navigate({ search: { ym: next, scope } });
  const [state, setState] = useState("all");
  const [freq, setFreq] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { canExport, isLoading: permissionsLoading } = useCurrentPermissions();
  const { data, isLoading, isError, refetch } = useLwfData(ym, scope);
  const all = data?.rows ?? [];
  const masters = data?.masters ?? [];

  const masterByState = useMemo(() => {
    const m = new Map<string, LwfMaster>();
    for (const row of masters) m.set(norm(row.state), row);
    return m;
  }, [masters]);

  const states = useMemo(() => Array.from(new Set(all.map((r) => r.state))).sort(), [all]);

  const freqOf = (st: string) => frequencyLabel(masterByState.get(norm(st))?.frequency);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      if (state !== "all" && r.state !== state) return false;
      if (freq !== "all" && freqOf(r.state) !== freq) return false;
      if (!needle) return true;
      return `${r.name} ${r.code} ${r.unit}`.toLowerCase().includes(needle);
    });
  }, [all, state, freq, q, masterByState]);

  const frequencies = useMemo(
    () => Array.from(new Set(states.map(freqOf).filter((f) => f !== "—"))).sort(),
    [states, masterByState],
  );

  const totalEe = rows.reduce((s, r) => s + r.employee, 0);
  const totalEr = rows.reduce((s, r) => s + r.employer, 0);

  const groups = useMemo(() => {
    const byState = new Map<string, LwfPersonRow[]>();
    for (const r of rows) {
      const arr = byState.get(r.state) ?? [];
      arr.push(r);
      byState.set(r.state, arr);
    }
    return Array.from(byState, ([st, list]) => {
      const master = masterByState.get(norm(st));
      const unitMap = new Map<string, LwfPersonRow[]>();
      for (const r of list) {
        const arr = unitMap.get(r.unit) ?? [];
        arr.push(r);
        unitMap.set(r.unit, arr);
      }
      const units = Array.from(unitMap, ([unit, members]) => ({
        unit,
        members: members.slice().sort((a, b) => a.name.localeCompare(b.name)),
        employee: members.reduce((s, r) => s + r.employee, 0),
        employer: members.reduce((s, r) => s + r.employer, 0),
      })).sort((a, b) => a.unit.localeCompare(b.unit));
      const months = Array.isArray(master?.deduction_months) ? master!.deduction_months : [];
      return {
        state: st,
        frequency: frequencyLabel(master?.frequency),
        monthsLabel:
          months.length > 0
            ? months
                .slice()
                .sort((a, b) => a - b)
                .map((m) => MONTH_NAMES[m - 1] ?? m)
                .join(", ")
            : "Every month",
        rateEe: Number(master?.employee_contribution ?? 0),
        rateEr: Number(master?.employer_contribution ?? 0),
        units,
        count: list.length,
        employee: list.reduce((s, r) => s + r.employee, 0),
        employer: list.reduce((s, r) => s + r.employer, 0),
      };
    }).sort((a, b) => a.state.localeCompare(b.state));
  }, [rows, masterByState]);

  const monthLabel = new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="page-shell">
      <PageHeader
        icon={Landmark}
        eyebrow="Governance"
        title="Labour Welfare Fund Register"
        description="State-wise LWF for the month — frequency, employee share, employer share and total, drillable to client and employee."
        crumbs={[
          { label: "Compliance", to: "/admin/compliance" },
          { label: "Labour Welfare Fund" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthYearPicker value={ym} onChange={setYm} />
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/compliance">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Compliance
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || isError || permissionsLoading || !canExport("compliance")}
              onClick={() =>
                !isLoading &&
                !isError &&
                !permissionsLoading &&
                canExport("compliance") &&
                downloadCsv(
                  `lwf-register-${ym}`,
                  rows.map((r) => ({
                    code: r.code,
                    name: r.name,
                    state: r.state,
                    frequency: freqOf(r.state),
                    unit: r.unit,
                    employee: r.employee,
                    employer: r.employer,
                    total: r.employee + r.employer,
                  })),
                  [
                    { key: "code", header: "Employee code" },
                    { key: "name", header: "Name" },
                    { key: "state", header: "State" },
                    { key: "frequency", header: "Frequency" },
                    { key: "unit", header: "Client" },
                    { key: "employee", header: "Employee share" },
                    { key: "employer", header: "Employer share" },
                    { key: "total", header: "Total" },
                  ],
                )
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="mb-3">
        <ComplianceLedgerScope
          value={scope}
          onChange={(next) => void navigate({ search: { ym, scope: next } })}
        />
      </div>
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="h-9 w-full text-xs sm:w-[190px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {states.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={freq} onValueChange={setFreq}>
          <SelectTrigger className="h-9 w-full text-xs sm:w-[180px]">
            <SelectValue placeholder="Frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {frequencies.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label={`LWF total · ${monthLabel}`}
          value={inr(totalEe + totalEr)}
          sub={`${groups.length} state${groups.length === 1 ? "" : "s"}`}
        />
        <StatCard label="Employee share" value={inr(totalEe)} />
        <StatCard label="Employer share" value={inr(totalEr)} />
        <StatCard
          label="Employees covered"
          value={String(rows.length)}
          sub={
            rows.length ? `Avg ${inr((totalEe + totalEr) / rows.length)} per employee` : undefined
          }
        />
      </div>

      {isError ? (
        <div role="alert" className="border border-destructive p-4 text-destructive">
          Records could not be loaded.{" "}
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-xs text-muted-foreground">
          Loading labour welfare fund contributions…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-xs text-muted-foreground">
          No LWF contributions for {monthLabel} with the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section
              key={g.state}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[13px] font-semibold">{g.state}</h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                      FREQ_TONE[g.frequency] ?? "bg-muted text-muted-foreground ring-border/60",
                    )}
                  >
                    {g.frequency}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {g.count} employees
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Deducted in {g.monthsLabel} · EE {inr(g.rateEe)} + ER {inr(g.rateEr)}
                  </span>
                </div>
                <span className="text-[13px] font-semibold tabular-nums">
                  {inr(g.employee + g.employer)}
                </span>
              </header>

              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">Client</th>
                    <th className="px-3 py-2 text-right font-semibold">Employees</th>
                    <th className="px-3 py-2 text-right font-semibold">Employee share</th>
                    <th className="px-3 py-2 text-right font-semibold">Employer share</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {g.units.map((u) => {
                    const key = `${g.state}:${u.unit}`;
                    const isOpen = !!open[key];
                    return (
                      <Fragment key={key}>
                        <tr
                          onClick={() => setOpen((s) => ({ ...s, [key]: !s[key] }))}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/30",
                            isOpen && "bg-accent/5",
                          )}
                        >
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5 font-medium">
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 transition-transform",
                                  isOpen && "rotate-90",
                                )}
                              />
                              {u.unit}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.members.length}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{inr(u.employee)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{inr(u.employer)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {inr(u.employee + u.employer)}
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="bg-background/40">
                            <td colSpan={5} className="px-3 py-2">
                              <ul className="divide-y divide-border/50">
                                {u.members.map((r) => (
                                  <li
                                    key={`${r.candidateId}|${r.unitId}`}
                                    className="flex items-center justify-between gap-3 py-1.5"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-[12px] font-medium">
                                        {r.name}
                                      </span>
                                      <span className="block truncate text-[10px] text-muted-foreground">
                                        {r.code} · EE {inr(r.employee)} · ER {inr(r.employer)}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-[12px] font-semibold tabular-nums">
                                      {inr(r.employee + r.employer)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 bg-background/40">
                    <td className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g.state} total
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold tabular-nums">
                      {g.count}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold tabular-nums">
                      {inr(g.employee)}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold tabular-nums">
                      {inr(g.employer)}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums">
                      {inr(g.employee + g.employer)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
