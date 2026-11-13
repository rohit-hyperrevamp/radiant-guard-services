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
import { ArrowLeft, ChevronRight, Download, Search } from "lucide-react";
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
import {
  INSURANCE_HEADS,
  matchesHead,
  monthRange,
  type InsuranceHeadKey,
} from "@/components/InsuranceHeadTiles";

import { ComplianceAccessGate } from "@/components/ComplianceAccessGate";

function InsuranceRegisterPageGated() {
  return (
    <ComplianceAccessGate>
      <InsuranceRegisterPage />
    </ComplianceAccessGate>
  );
}

export const Route = createFileRoute("/admin/compliance-insurance")({
  component: InsuranceRegisterPageGated,
  validateSearch: (
    search: Record<string, unknown>,
  ): { ym?: string; head?: string; scope?: LedgerScope } => ({
    ym: typeof search.ym === "string" ? search.ym : undefined,
    scope: search.scope === "pending" || search.scope === "all" ? search.scope : "posted",
    head: typeof search.head === "string" ? search.head : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Insurance Register — Radiant Guard" },
      {
        name: "description",
        content:
          "GPAIP, ESIC and Workmen's Compensation recovered this month, employee by employee, grouped by the client that carries the cover.",
      },
      { property: "og:title", content: "Insurance Register" },
      {
        property: "og:description",
        content: "Month-wise insurance register recoveries with the employees covered.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const inr = complianceMoney;

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

type EsicBasis = "basic_da" | "gross" | "unknown";

const BASIS_LABEL: Record<EsicBasis, string> = {
  unknown: "Not recorded in posting",
  basic_da: "Basic + DA",
  gross: "Gross − washing",
};

type Row = {
  id: string;
  candidateId: string;
  name: string;
  code: string;
  unitId: string | null;
  unit: string;
  joining: string | null;
  amount: number;
  date: string;
  note: string;
  side: "ee" | "er";
  branchId: string | null;
  location: string;
  esicCode: string;
  basis: EsicBasis;
  stage: string;
};

type Policy = {
  id: string;
  name: string;
  provider: string | null;
  policy_number: string | null;
  end_date: string | null;
  sum_assured: number | null;
  is_active: boolean | null;
};

type Branch = { id: string; location: string; esic_code: string; enabled: boolean };

function useInsuranceRegister(ym: string, head: InsuranceHeadKey, scope: LedgerScope) {
  return useQuery({
    queryKey: ["insurance-register", ym, head, scope],
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async (): Promise<{
      rows: Row[];
      policies: Policy[];
      units: Array<{ id: string; name: string; enabled: boolean; amount: number }>;
      branches: Branch[];
    }> => {
      const [ledger, policies, branches, unitRows] = await Promise.all([
        complianceMonthQuery(ym, scope).queryFn(),
        fetchAllPages<Policy>((a, b) =>
          supabase.from("policies").select("*").order("id").range(a, b),
        ),
        fetchAllPages<Branch>((a, b) =>
          supabase
            .from("esic_branches")
            .select("id,location,esic_code,enabled")
            .order("id")
            .range(a, b),
        ),
        fetchAllPages<{
          id: string;
          name: string;
          gpaip_enabled: boolean | null;
          gpaip_amount: number | null;
        }>((a, b) =>
          supabase
            .from("units")
            .select("id,name,gpaip_enabled,gpaip_amount")
            .order("id")
            .range(a, b),
        ),
      ]);
      const deds = ledger.deds.filter((r) => matchesHead(r.deduction_name, head));
      const contribs = ledger.contribs.filter((r) => matchesHead(r.contribution_name, head));
      const directory = await complianceDirectory([...deds, ...contribs]);
      const branchMap = new Map(branches.map((r) => [r.id, r]));
      const raw = [
        ...deds.map((r) => ({
          ...r,
          side: "ee" as const,
          value: ledgerAmount(r),
          date: r.deduction_date,
          note: r.deduction_name ?? "",
        })),
        ...contribs.map((r) => ({
          ...r,
          side: "er" as const,
          value: ledgerAmount(r),
          date: r.contribution_date,
          note: r.contribution_name ?? "",
        })),
      ];
      const rows: Row[] = raw.map((r) => {
        const c = r.candidate_id ? directory.people.get(r.candidate_id) : undefined;
        const u = r.unit_id ? directory.units.get(r.unit_id) : undefined;
        const b = u?.esic_branch_id ? branchMap.get(u.esic_branch_id) : undefined;
        return {
          id: `${r.side}:${r.id}`,
          candidateId: r.candidate_id ?? r.id,
          name: c?.full_name ?? "Unknown employee",
          code: c?.employee_code ?? c?.candidate_code ?? "—",
          unitId: r.unit_id,
          unit: u?.name ?? "Unknown original site",
          joining: c?.preferred_joining_date ?? null,
          amount: r.value,
          date: r.date,
          note: r.note,
          side: r.side,
          branchId: b?.id ?? null,
          location: b?.location ?? "Unmapped location",
          esicCode: b?.esic_code ?? "—",
          basis: "unknown",
          stage: ledgerStage(r),
        };
      });
      return {
        rows,
        policies: policies.filter((p) =>
          INSURANCE_HEADS.find((h) => h.key === head)?.policyMatch.some((m) =>
            (p.name ?? "").toLowerCase().includes(m),
          ),
        ),
        branches,
        units: unitRows.map((u) => ({
          id: u.id,
          name: u.name,
          enabled: Boolean(u.gpaip_enabled),
          amount: Number(u.gpaip_amount ?? 0),
        })),
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

function InsuranceRegisterPage() {
  const now = new Date();
  const { ym: ymParam, head: headParam, scope: scopeParam } = Route.useSearch();
  const scope = scopeParam ?? "posted";
  const ym = ymParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const head: InsuranceHeadKey =
    headParam === "wc" ? "wc" : headParam === "esic" ? "esic" : "gpaip";
  const meta = INSURANCE_HEADS.find((h) => h.key === head)!;
  const navigate = useNavigate({ from: "/admin/compliance-insurance" });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loc, setLoc] = useState<string>("all");
  const [basisFilter, setBasisFilter] = useState<"all" | EsicBasis>("all");

  const { canExport, isLoading: permissionsLoading } = useCurrentPermissions();
  const { data, isLoading, isError, refetch } = useInsuranceRegister(ym, head, scope);
  const all = data?.rows ?? [];

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      if (head === "esic" && loc !== "all" && (r.branchId ?? "none") !== loc) return false;
      if (head === "esic" && basisFilter !== "all" && r.basis !== basisFilter) return false;
      if (!needle) return true;
      return `${r.name} ${r.code} ${r.unit} ${r.location} ${r.esicCode}`
        .toLowerCase()
        .includes(needle);
    });
  }, [all, q, loc, basisFilter, head]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const eeTotal = rows.filter((r) => r.side === "ee").reduce((s, r) => s + r.amount, 0);
  const erTotal = rows.filter((r) => r.side === "er").reduce((s, r) => s + r.amount, 0);
  const people = new Set(rows.map((r) => r.candidateId)).size;

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const list = map.get(r.unit) ?? [];
      list.push(r);
      map.set(r.unit, list);
    }
    return Array.from(map.entries())
      .map(([unit, members]) => ({
        unit,
        members,
        total: members.reduce((s, r) => s + r.amount, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // Location → unit → employee tree for the ESIC register
  const esicTree = useMemo(() => {
    type Emp = {
      candidateId: string;
      name: string;
      code: string;
      joining: string | null;
      ee: number;
      er: number;
    };
    type UnitNode = {
      unitId: string | null;
      unit: string;
      basis: EsicBasis;
      ee: number;
      er: number;
      emps: Emp[];
    };
    const locMap = new Map<
      string,
      {
        key: string;
        location: string;
        esicCode: string;
        ee: number;
        er: number;
        units: Map<string, UnitNode>;
      }
    >();
    for (const r of rows) {
      const key = r.branchId ?? "none";
      let node = locMap.get(key);
      if (!node) {
        node = { key, location: r.location, esicCode: r.esicCode, ee: 0, er: 0, units: new Map() };
        locMap.set(key, node);
      }
      let unit = node.units.get(r.unit);
      if (!unit) {
        unit = { unitId: r.unitId, unit: r.unit, basis: r.basis, ee: 0, er: 0, emps: [] };
        node.units.set(r.unit, unit);
      }
      let emp = unit.emps.find((e) => e.candidateId === r.candidateId);
      if (!emp) {
        emp = {
          candidateId: r.candidateId,
          name: r.name,
          code: r.code,
          joining: r.joining,
          ee: 0,
          er: 0,
        };
        unit.emps.push(emp);
      }
      emp[r.side] += r.amount;
      unit[r.side] += r.amount;
      node[r.side] += r.amount;
    }
    return Array.from(locMap.values())
      .map((n) => ({
        ...n,
        unitList: Array.from(n.units.values())
          .map((u) => ({ ...u, emps: u.emps.sort((a, b) => a.name.localeCompare(b.name)) }))
          .sort((a, b) => b.ee + b.er - (a.ee + a.er)),
      }))
      .sort((a, b) => b.ee + b.er - (a.ee + a.er));
  }, [rows]);

  const monthLabel = new Date(ym + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const enabledUnits = (data?.units ?? []).filter((u) => u.enabled);

  return (
    <div className="page-shell">
      <PageHeader
        icon={meta.icon}
        eyebrow="Governance"
        title={`${meta.label} Register`}
        description={`${meta.full} recovered in the month, employee by employee, grouped by the unit that carries the cover.`}
        crumbs={[
          { label: "Compliance", to: "/admin/compliance" },
          { label: `${meta.label} Register` },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthYearPicker
              value={ym}
              onChange={(next) => navigate({ search: { ym: next, head, scope } })}
            />
            {head === "gpaip" ? (
              <Button size="sm" asChild>
                <Link to="/admin/compliance-gpaip-register" search={{ ym, view: "staff" }}>
                  View register
                </Link>
              </Button>
            ) : null}
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
                  `${head}-register-${ym}`,
                  rows.map((r) => ({
                    location: r.location,
                    esicCode: r.esicCode,
                    basis: BASIS_LABEL[r.basis],

                    code: r.code,
                    name: r.name,
                    unit: r.unit,
                    joining: r.joining ?? "",
                    side: r.side === "ee" ? "Employee" : "Employer",
                    amount: r.amount,
                    date: r.date,
                    note: r.note,
                    stage: r.stage,
                  })),
                  [
                    ...(head === "esic"
                      ? [
                          { key: "location", header: "ESIC location" },
                          { key: "esicCode", header: "ESIC code" },
                          { key: "basis", header: "ESIC basis" },
                        ]
                      : []),
                    { key: "code", header: "Employee code" },
                    { key: "name", header: "Name" },
                    { key: "unit", header: "Client" },
                    { key: "joining", header: "Date of joining" },
                    ...(head === "esic" ? [{ key: "side", header: "Contribution" }] : []),
                    { key: "amount", header: `${meta.label} amount` },
                    { key: "date", header: "Recovered on" },
                    { key: "note", header: "Line" },
                    { key: "stage", header: "Posting status" },
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
          onChange={(next) => void navigate({ search: { ym, head, scope: next } })}
        />
      </div>
      {/* Search */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {head === "esic" ? (
          <Select value={loc} onValueChange={setLoc}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-[260px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {(data?.branches ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.location} · {b.esic_code}
                </SelectItem>
              ))}
              <SelectItem value="none">Unmapped location</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {head === "esic" ? (
          <Select value={basisFilter} onValueChange={(v) => setBasisFilter(v as "all" | EsicBasis)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-[220px]">
              <SelectValue placeholder="All ESIC bases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ESIC bases</SelectItem>
              <SelectItem value="basic_da">ESIC on Basic + DA</SelectItem>
              <SelectItem value="gross">ESIC on Gross − washing</SelectItem>
              <SelectItem value="unknown">Basis not recorded</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
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
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-5">
        <StatCard
          label={`${meta.label} recovered · ${monthLabel}`}
          value={inr(total)}
          sub={`${people} employees`}
        />
        <StatCard
          label="Employees covered"
          value={String(people)}
          sub={people ? `avg ${inr(total / people)} each` : "No records"}
        />
        {head === "esic" ? (
          <>
            <StatCard
              label="Employee contribution"
              value={inr(eeTotal)}
              sub="Saved deduction amounts"
            />
            <StatCard
              label="Employer contribution"
              value={inr(erTotal)}
              sub="Saved contribution amounts"
            />
            <StatCard
              label="ESIC locations"
              value={String(esicTree.length)}
              sub={`${groups.length} clients`}
            />
          </>
        ) : (
          <>
            <StatCard label="Clients covered" value={String(groups.length)} />
            <StatCard
              label="Clients with cover on"
              value={head === "gpaip" ? String(enabledUnits.length) : "—"}
              sub={head === "gpaip" ? "Client-level GPAIP toggle" : "Employer-borne cover"}
            />
          </>
        )}
      </div>

      {/* Policies backing this head */}
      {data?.policies?.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {data.policies.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2 text-[11px] backdrop-blur"
            >
              <p className="font-semibold">{p.name}</p>
              <p className="text-muted-foreground">
                {[
                  p.provider,
                  p.policy_number,
                  p.end_date ? `valid till ${fmtDate(p.end_date)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {isError ? (
        <div role="alert" className="border border-destructive p-4 text-destructive">
          Records could not be loaded.{" "}
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-xs text-muted-foreground">
          Loading {meta.label} recoveries…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-xs text-muted-foreground">
          No {meta.label} recovered for {monthLabel}.
        </div>
      ) : head === "esic" ? (
        <div className="space-y-3">
          {esicTree.map((node) => {
            const locOpen = open[`loc:${node.key}`] ?? true;
            return (
              <section
                key={node.key}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur"
              >
                <header
                  onClick={() =>
                    setOpen((s) => ({ ...s, [`loc:${node.key}`]: !(s[`loc:${node.key}`] ?? true) }))
                  }
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", locOpen && "rotate-90")}
                    />
                    <h2 className="truncate text-[13px] font-semibold">{node.location}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {node.esicCode}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {node.unitList.length} units
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] tabular-nums">
                    <span className="text-muted-foreground">
                      EE <b className="text-foreground">{inr(node.ee)}</b>
                    </span>
                    <span className="text-muted-foreground">
                      ER <b className="text-foreground">{inr(node.er)}</b>
                    </span>
                    <span className="text-[13px] font-semibold">{inr(node.ee + node.er)}</span>
                  </div>
                </header>

                {locOpen ? (
                  <div className="divide-y divide-border/60">
                    {node.unitList.map((u) => {
                      const uk = `unit:${node.key}:${u.unit}`;
                      const uOpen = open[uk] ?? false;
                      return (
                        <div key={uk}>
                          <div
                            onClick={() => setOpen((s) => ({ ...s, [uk]: !(s[uk] ?? false) }))}
                            className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 pl-6 hover:bg-muted/30"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <ChevronRight
                                className={cn("h-3 w-3 transition-transform", uOpen && "rotate-90")}
                              />
                              <span className="truncate text-[12px] font-medium">{u.unit}</span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  u.basis === "basic_da"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-primary/10 text-primary",
                                )}
                              >
                                {BASIS_LABEL[u.basis]}
                              </span>

                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                                {u.emps.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] tabular-nums">
                              <span className="text-muted-foreground">EE {inr(u.ee)}</span>
                              <span className="text-muted-foreground">ER {inr(u.er)}</span>
                              <span className="font-semibold">{inr(u.ee + u.er)}</span>
                            </div>
                          </div>
                          {uOpen ? (
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="border-y border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  <th className="px-3 py-2 pl-10 text-left font-semibold">
                                    Employee
                                  </th>
                                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                                  <th className="px-3 py-2 text-left font-semibold">
                                    Date of joining
                                  </th>
                                  <th className="px-3 py-2 text-right font-semibold">
                                    ESIC employee
                                  </th>
                                  <th className="px-3 py-2 text-right font-semibold">
                                    ESIC employer
                                  </th>
                                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {u.emps.map((e) => (
                                  <tr key={e.candidateId} className="hover:bg-muted/30">
                                    <td className="px-3 py-2 pl-10 font-medium">{e.name}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{e.code}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {fmtDate(e.joining)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {inr(e.ee)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {inr(e.er)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                      {inr(e.ee + e.er)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = open[g.unit] ?? true;
            return (
              <section
                key={g.unit}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur"
              >
                <header
                  onClick={() => setOpen((s) => ({ ...s, [g.unit]: !(s[g.unit] ?? true) }))}
                  className="flex cursor-pointer items-center justify-between gap-2 border-b border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                    />
                    <h2 className="text-[13px] font-semibold">{g.unit}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {new Set(g.members.map((m) => m.candidateId)).size} employees
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums">{inr(g.total)}</span>
                </header>

                {isOpen ? (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 text-left font-semibold">Employee</th>
                        <th className="px-3 py-2 text-left font-semibold">Code</th>
                        <th className="px-3 py-2 text-left font-semibold">Date of joining</th>
                        <th className="px-3 py-2 text-left font-semibold">Recovered on</th>
                        <th className="px-3 py-2 text-right font-semibold">{meta.label}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {g.members.map((m) => (
                        <Fragment key={m.id}>
                          <tr className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{m.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{m.code}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {fmtDate(m.joining)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{fmtDate(m.date)}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {inr(m.amount)}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
