import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";
import { istAddDays, istDate } from "@/lib/dashboard-base";

export function currentActiveContract(row: { status: string; end_date: string | null }, today: string) {
  return row.status === "active" && (!row.end_date || row.end_date >= today);
}

export type MasterUnitRow = { id: string; customer_id: string | null };
export type MasterContractRow = { id: string; contract_code: string; unit_id: string | null; status: string; end_date: string | null };
export type MasterPersonRow = { id: string; unit_id: string | null; mobile: string | null; employee_code: string | null; status: string; is_enabled: boolean; approved_at: string | null; created_at: string | null; updated_at: string | null };
export type MasterRehireRow = { previous_candidate_id: string | null; new_candidate_id: string | null };
export type MasterSourceRows = {
  /** units with status = 'active' */
  units: MasterUnitRow[];
  /** customers with status = 'active' */
  customers: { id: string }[];
  /** client_contracts with status = 'active' */
  contracts: MasterContractRow[];
  /** candidates with status <> 'inactive' */
  people: MasterPersonRow[];
  /** rehire_requests with status = 'pending' */
  rehires: MasterRehireRow[];
};
export type DashboardMasterCounts = {
  orgs: number;
  units: number;
  employees: number;
  contractsActive: number;
  contractsExpiring: (MasterContractRow & { unit_id: string; end_date: string })[];
};

/**
 * Pure master-count rule. The SQL function `dashboard_master_counts`
 * (db/prod-migrations/20261126002000_dashboard_master_counts.sql) mirrors this
 * step for step; keep both in sync. This stays as the fallback path when the
 * RPC is unavailable (e.g. migration not applied yet).
 */
export function computeDashboardMasterCounts(rows: MasterSourceRows, scope: Set<string> | undefined, today: string): DashboardMasterCounts {
  const { units, customers, contracts, people, rehires } = rows;
  const activeIds = new Set(units.map(u => u.id));
  const visibleUnits = scope ? units.filter(u => scope.has(u.id)) : units;
  const scopedCustomers = new Set(visibleUnits.map(u => u.customer_id));
  const pending = new Set(rehires.flatMap(r => [r.previous_candidate_id, r.new_candidate_id]).filter(Boolean));
  const groups = new Map<string, MasterPersonRow[]>();
  for (const p of people) {
    const key = p.mobile?.trim() || p.id;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const employeeStatus = (status: string) => status === "active" || status === "approved";
  const employees = [...groups.values()].flatMap(group => {
    const eligible = group.filter(p => employeeStatus(p.status));
    const number = (s: string | null) => Number((s ?? "").match(/(\d+)$/)?.[1] ?? 0);
    eligible.sort((a, b) => Number(b.is_enabled) - Number(a.is_enabled) || number(b.employee_code) - number(a.employee_code) || (b.approved_at || b.created_at || b.updated_at || "").localeCompare(a.approved_at || a.created_at || a.updated_at || "") || b.id.localeCompare(a.id));
    return eligible.slice(0, 1);
  }).filter(p => p.is_enabled && !pending.has(p.id) && (!scope || (!!p.unit_id && scope.has(p.unit_id))));
  const horizon = istAddDays(today, 60);
  const activeContracts = contracts.filter(c => (!c.unit_id || activeIds.has(c.unit_id)) && (!scope || (!!c.unit_id && scope.has(c.unit_id))) && currentActiveContract(c, today));
  return {
    orgs: customers.filter(c => !scope || scopedCustomers.has(c.id)).length,
    units: visibleUnits.length,
    employees: employees.length,
    contractsActive: activeContracts.length,
    contractsExpiring: activeContracts.filter(c => c.end_date && c.end_date <= horizon).sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? "")).map(c => ({ ...c, unit_id: c.unit_id ?? "", end_date: c.end_date ?? "" })),
  };
}

async function fetchDashboardMasterCountsInBrowser(scope?: Set<string>): Promise<DashboardMasterCounts> {
  const [units, customers, contracts, people, rehires] = await Promise.all([
    fetchAllPages<MasterUnitRow>((from, to) => supabase.from("units").select("id,customer_id").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<{ id: string }>((from, to) => supabase.from("customers").select("id").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<MasterContractRow>((from, to) => supabase.from("client_contracts").select("id,contract_code,unit_id,status,end_date").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<MasterPersonRow>((from, to) => supabase.from("candidates").select("id,unit_id,mobile,employee_code,status,is_enabled,approved_at,created_at,updated_at").neq("status", "inactive").order("id").range(from, to)),
    fetchAllPages<MasterRehireRow>((from, to) => supabase.from("rehire_requests" as never).select("previous_candidate_id,new_candidate_id").eq("status", "pending").order("id").range(from, to)),
  ]);
  // India calendar day: a UTC "today" kept expired contracts active until 05:30 IST.
  return computeDashboardMasterCounts({ units, customers, contracts, people, rehires }, scope, istDate());
}

/** Normalises the RPC payload into the exact client shape (numbers, "" for missing ids/dates). */
export function parseMasterCountsPayload(data: unknown): DashboardMasterCounts | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.employees !== "number" && typeof d.employees !== "string") return null;
  const expiring = Array.isArray(d.contractsExpiring) ? (d.contractsExpiring as Record<string, unknown>[]) : [];
  return {
    orgs: Number(d.orgs ?? 0),
    units: Number(d.units ?? 0),
    employees: Number(d.employees ?? 0),
    contractsActive: Number(d.contractsActive ?? 0),
    contractsExpiring: expiring.map(c => ({
      id: String(c.id ?? ""),
      contract_code: String(c.contract_code ?? ""),
      unit_id: String(c.unit_id ?? ""),
      status: String(c.status ?? "active"),
      end_date: String(c.end_date ?? "").slice(0, 10),
    })),
  };
}

/**
 * Current master totals, not historical monthly activity. Ordinary caller RLS
 * applies (the RPC is SECURITY INVOKER). One database round trip instead of
 * paging every unit / contract / employee into the browser; falls back to the
 * browser computation if the RPC is missing or fails.
 */
export async function fetchDashboardMasterCounts(scope?: Set<string>): Promise<DashboardMasterCounts> {
  try {
    const { data, error } = await supabase.rpc("dashboard_master_counts" as never, { p_scope: scope ? [...scope] : null, p_today: istDate() } as never);
    if (!error) {
      const parsed = parseMasterCountsPayload(data);
      if (parsed) return parsed;
    }
  } catch {
    /* fall through to the browser path */
  }
  return fetchDashboardMasterCountsInBrowser(scope);
}

export type EmployeeInsightsCounts = { employees: number; candidates: number; pendingApproval: number; offboarded: number };

/** Four candidate status counts in one RPC (one table scan); falls back to four head counts. */
export async function fetchEmployeeInsightsCounts(): Promise<EmployeeInsightsCounts> {
  try {
    const { data, error } = await supabase.rpc("employee_insights_counts" as never);
    const d = data as Record<string, unknown> | null;
    if (!error && d && typeof d === "object" && "employees" in d) {
      return { employees: Number(d.employees ?? 0), candidates: Number(d.candidates ?? 0), pendingApproval: Number(d.pendingApproval ?? 0), offboarded: Number(d.offboarded ?? 0) };
    }
  } catch {
    /* fall through */
  }
  const [employees, candidates, pendingApproval, offboarded] = await Promise.all([
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("is_enabled", true).in("status", ["active", "approved"]),
    supabase.from("candidates").select("id", { count: "exact", head: true }).in("status", ["draft", "submitted", "pending", "candidate"]),
    supabase.from("candidates").select("id", { count: "exact", head: true }).in("status", ["submitted", "pending"]),
    supabase.from("candidates").select("id", { count: "exact", head: true }).in("status", ["offboarded", "inactive", "exited"]),
  ]);
  return {
    employees: employees.count ?? 0,
    candidates: candidates.count ?? 0,
    pendingApproval: pendingApproval.count ?? 0,
    offboarded: offboarded.count ?? 0,
  };
}
