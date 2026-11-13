import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { supabaseSessionReady } from "@/lib/supabase-ready";
import {
  originalUnitId,
  payrollReferenceId,
  inLedgerScope,
  type LedgerScope,
} from "@/lib/statutory-heads";

export type MonthDed = {
  id: string;
  candidate_id: string | null;
  unit_id: string | null;
  amount: number | null;
  computed_amount: number | null;
  deduction_name: string | null;
  deduction_date: string;
  status: string | null;
  source_kind: string | null;
  source_ref: string | null;
};
export type MonthContrib = {
  id: string;
  candidate_id: string | null;
  unit_id: string | null;
  payroll_run_id: string | null;
  amount: number | null;
  contribution_name: string | null;
  contribution_date: string;
  status: string | null;
  source_kind: string | null;
  source_ref: string | null;
};
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
}
export async function fetchComplianceMonth(ym: string) {
  if (!(await supabaseSessionReady())) throw new Error("Sign in to load Compliance records.");
  const { from, to } = monthRange(ym);
  const [deds, contribs] = await Promise.all([
    fetchAllPages<MonthDed>((a, b) =>
      supabase
        .from("deductions")
        .select(
          "id,candidate_id,unit_id,amount,computed_amount,deduction_name,deduction_date,status,source_kind,source_ref",
        )
        .gte("deduction_date", from)
        .lte("deduction_date", to)
        .order("id")
        .range(a, b),
    ),
    fetchAllPages<MonthContrib>((a, b) =>
      supabase
        .from("employer_contributions")
        .select(
          "id,candidate_id,unit_id,payroll_run_id,amount,contribution_name,contribution_date,status,source_kind,source_ref",
        )
        .gte("contribution_date", from)
        .lte("contribution_date", to)
        .order("id")
        .range(a, b),
    ),
  ]);
  const runIds = [
    ...new Set([...deds, ...contribs].map(payrollReferenceId).filter((id): id is string => !!id)),
  ];
  const runs = await fetchInChunks<{ id: string; unit_id: string | null }>(runIds, (ids, a, b) =>
    supabase.from("payroll_runs").select("id,unit_id").in("id", ids).order("id").range(a, b),
  );
  const map = new Map(runs.map((r) => [r.id, r.unit_id]));
  return {
    deds: deds.map((r) => ({ ...r, unit_id: originalUnitId(r, map) })),
    contribs: contribs.map((r) => ({ ...r, unit_id: originalUnitId(r, map) })),
  };
}
export const complianceMonthQuery = (ym: string, scope: LedgerScope = "posted") => ({
  queryKey: ["compliance-month-ledger", ym, scope],
  staleTime: 60_000,
  refetchOnMount: "always" as const,
  queryFn: async () => {
    const data = await fetchComplianceMonth(ym);
    return {
      deds: data.deds.filter((r) => inLedgerScope(r, scope)),
      contribs: data.contribs.filter((r) => inLedgerScope(r, scope)),
    };
  },
});
export type CompliancePerson = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  candidate_code: string | null;
  gender: string | null;
  preferred_joining_date: string | null;
};
export type ComplianceUnit = {
  id: string;
  name: string;
  billing_state: string | null;
  shipping_state: string | null;
  pt_state: string | null;
  esic_branch_id: string | null;
  gpaip_enabled: boolean | null;
  gpaip_amount: number | null;
};
export async function complianceDirectory(
  rows: Array<{ candidate_id: string | null; unit_id: string | null }>,
) {
  const ids = [...new Set(rows.map((r) => r.candidate_id).filter((id): id is string => !!id))];
  const uids = [...new Set(rows.map((r) => r.unit_id).filter((id): id is string => !!id))];
  const [people, units] = await Promise.all([
    fetchInChunks<CompliancePerson>(ids, (chunk, a, b) =>
      supabase
        .from("candidates")
        .select("id,full_name,employee_code,candidate_code,gender,preferred_joining_date")
        .in("id", chunk)
        .order("id")
        .range(a, b),
    ),
    fetchInChunks<ComplianceUnit>(uids, (chunk, a, b) =>
      supabase
        .from("units")
        .select(
          "id,name,billing_state,shipping_state,pt_state,esic_branch_id,gpaip_enabled,gpaip_amount" as never,
        )
        .in("id", chunk)
        .order("id")
        .range(a, b),
    ),
  ]);
  return {
    people: new Map(people.map((r) => [r.id, r])),
    units: new Map(units.map((r) => [r.id, r])),
  };
}
