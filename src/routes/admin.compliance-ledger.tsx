import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Landmark } from "lucide-react";
import { ComplianceAccessGate } from "@/components/ComplianceAccessGate";
import { ComplianceLedgerScope } from "@/components/ComplianceLedgerScope";
import { MonthYearPicker } from "@/components/MonthYearPicker";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { complianceMonthQuery, complianceDirectory } from "@/lib/compliance-month";
import {
  statutoryHead,
  ledgerAmount,
  ledgerStage,
  complianceMoney,
  type LedgerScope,
} from "@/lib/statutory-heads";
import { useCurrentPermissions } from "@/lib/rbac";
import { downloadCsv } from "@/lib/csv-export";
import { matchesSearch } from "@/lib/search-match";
export const Route = createFileRoute("/admin/compliance-ledger")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { ym: string; head: "epf" | "levy"; scope: LedgerScope } => ({
    ym:
      typeof s.ym === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.ym)
        ? s.ym
        : new Date().toISOString().slice(0, 7),
    head: s.head === "levy" ? "levy" : "epf",
    scope: s.scope === "pending" || s.scope === "all" ? s.scope : "posted",
  }),
  head: () => ({
    meta: [
      { title: "Statutory Contribution Ledger — Radiant Guard Services" },
      {
        name: "description",
        content:
          "Monthly employee deductions and employer contributions reconciled to original payroll postings.",
      },
      { property: "og:title", content: "Radiant Statutory Contribution Ledger" },
      {
        property: "og:description",
        content: "Employee and employer statutory postings with original sites and posting status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComplianceAccessGate>
      <Ledger />
    </ComplianceAccessGate>
  ),
});
function Ledger() {
  const { ym, head, scope } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/compliance-ledger" });
  const [search, setSearch] = useState("");
  const { canExport, isLoading: permissionsLoading } = useCurrentPermissions();
  const query = useQuery({
    queryKey: ["compliance-head-ledger", ym, head, scope],
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async () => {
      const ledger = await complianceMonthQuery(ym, scope).queryFn();
      const deds = ledger.deds.filter((r) => statutoryHead(r.deduction_name) === head);
      const contribs = ledger.contribs.filter((r) => statutoryHead(r.contribution_name) === head);
      const directory = await complianceDirectory([...deds, ...contribs]);
      return [
        ...deds.map((r) => ({
          ...r,
          name: r.deduction_name ?? "",
          date: r.deduction_date,
          side: "Employee",
          value: ledgerAmount(r),
        })),
        ...contribs.map((r) => ({
          ...r,
          name: r.contribution_name ?? "",
          date: r.contribution_date,
          side: "Employer",
          value: ledgerAmount(r),
        })),
      ].map((r) => {
        const person = r.candidate_id ? directory.people.get(r.candidate_id) : undefined;
        const unit = r.unit_id ? directory.units.get(r.unit_id) : undefined;
        return {
          id: `${r.side}:${r.id}`,
          code: person?.employee_code ?? person?.candidate_code ?? "—",
          employee: person?.full_name ?? "Unknown employee",
          unit: unit?.name ?? "Unknown original site",
          name: r.name,
          date: r.date,
          side: r.side,
          amount: r.value,
          status: ledgerStage(r),
          source: r.source_ref ?? "",
        };
      });
    },
  });
  const rows = (query.data ?? []).filter((r) =>
    matchesSearch(search, [r.code, r.employee, r.unit, r.name]),
  );
  const allowed =
    !permissionsLoading && canExport("compliance") && !query.isLoading && !query.isError;
  const label = head === "epf" ? "EPF" : "Guard Board Levy";
  const columns = [
    { key: "code", header: "Employee code" },
    { key: "employee", header: "Employee" },
    { key: "unit", header: "Original client/site" },
    { key: "name", header: "Original statutory head" },
    { key: "side", header: "Contribution" },
    { key: "amount", header: "Amount" },
    { key: "date", header: "Posting date" },
    { key: "status", header: "Posting status" },
    { key: "source", header: "Payroll reference" },
  ];
  return (
    <div className="page-shell">
      <PageHeader
        icon={Landmark}
        title={`${label} Register`}
        crumbs={[{ label: "Compliance", to: "/admin/compliance" }, { label }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <MonthYearPicker
              value={ym}
              onChange={(v) => void navigate({ search: { ym: v, head, scope } })}
            />
            <Button
              variant="outline"
              disabled={!allowed}
              onClick={() => {
                if (allowed) downloadCsv(`${head}-register-${ym}`, rows, columns);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/compliance">Compliance</Link>
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <ComplianceLedgerScope
          value={scope}
          onChange={(v) => void navigate({ search: { ym, head, scope: v } })}
        />
        <Input
          aria-label="Search statutory ledger"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee or site"
          className="max-w-sm"
        />
      </div>
      {query.isError ? (
        <div role="alert">
          Records could not be loaded.{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.isLoading ? (
        <p>Loading postings…</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-6">
            <p>
              Employee:{" "}
              <strong>
                {complianceMoney(
                  rows.filter((r) => r.side === "Employee").reduce((s, r) => s + r.amount, 0),
                )}
              </strong>
            </p>
            <p>
              Employer:{" "}
              <strong>
                {complianceMoney(
                  rows.filter((r) => r.side === "Employer").reduce((s, r) => s + r.amount, 0),
                )}
              </strong>
            </p>
            <p>
              Total: <strong>{complianceMoney(rows.reduce((s, r) => s + r.amount, 0))}</strong>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {columns.slice(0, 8).map((c) => (
                    <th key={c.key} className="border-b p-2 text-left">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {columns.slice(0, 8).map((c) => (
                      <td key={c.key} className="border-b p-2">
                        {c.key === "amount"
                          ? complianceMoney(r.amount)
                          : String(r[c.key as keyof typeof r])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-6">No {scope} records for this month.</p>}
          </div>
        </>
      )}
    </div>
  );
}
