import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";
import { istAddDays, istDate } from "@/lib/dashboard-base";

export function currentActiveContract(row: { status: string; end_date: string | null }, today: string) {
  return row.status === "active" && (!row.end_date || row.end_date >= today);
}

/** Current master totals, not historical monthly activity. Ordinary caller RLS applies. */
export async function fetchDashboardMasterCounts(scope?: Set<string>) {
  const [units, customers, contracts, people, rehires] = await Promise.all([
    fetchAllPages<{ id: string; customer_id: string | null }>((from, to) => supabase.from("units").select("id,customer_id").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<{ id: string }>((from, to) => supabase.from("customers").select("id").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<{ id: string; contract_code: string; unit_id: string | null; status: string; end_date: string | null }>((from, to) => supabase.from("client_contracts").select("id,contract_code,unit_id,status,end_date").eq("status", "active").order("id").range(from, to)),
    fetchAllPages<{ id: string; unit_id: string | null; mobile: string | null; employee_code: string | null; status: string; is_enabled: boolean; approved_at: string | null; created_at: string | null; updated_at: string | null }>((from, to) => supabase.from("candidates").select("id,unit_id,mobile,employee_code,status,is_enabled,approved_at,created_at,updated_at").neq("status", "inactive").order("id").range(from, to)),
    fetchAllPages<{ previous_candidate_id: string | null; new_candidate_id: string | null }>((from, to) => supabase.from("rehire_requests" as never).select("previous_candidate_id,new_candidate_id").eq("status", "pending").order("id").range(from, to)),
  ]);
  const activeIds = new Set(units.map(u => u.id));
  const visibleUnits = scope ? units.filter(u => scope.has(u.id)) : units;
  const scopedCustomers = new Set(visibleUnits.map(u => u.customer_id));
  const pending = new Set(rehires.flatMap(r => [r.previous_candidate_id, r.new_candidate_id]).filter(Boolean));
  const groups = new Map<string, typeof people>();
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
  // India calendar day: a UTC "today" kept expired contracts active until 05:30 IST.
  const today = istDate();
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