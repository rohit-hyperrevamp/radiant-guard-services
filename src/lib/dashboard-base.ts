/**
 * Shared base lookups for the dashboard coverage cards.
 *
 * The Workforce and Attendance coverage cards render on the same screen and
 * each used to read the same six tables independently — twelve requests for
 * six results — and each read was unbounded, so PostgREST silently cut them at
 * 1000 rows (with ~4000 units, most units simply went missing).
 *
 * This module loads each table once, fully paged, and hands the same payload
 * to every caller for a short window.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";

export type BaseRow = Record<string, unknown>;

export type DashboardBase = {
  /** Active client contracts. */
  contracts: BaseRow[];
  units: BaseRow[];
  customers: BaseRow[];
  designations: BaseRow[];
  /** Active employees. */
  candidates: BaseRow[];
  candidateUnits: BaseRow[];
  /** Contract resources for the active client contracts above. */
  resources: BaseRow[];
  attendanceCodes: BaseRow[];
};

const TTL_MS = 60_000;

let cached: { at: number; data: DashboardBase } | null = null;
let inflight: Promise<DashboardBase> | null = null;

async function load(): Promise<DashboardBase> {
  const [
    contracts,
    units,
    customers,
    designations,
    candidates,
    candidateUnits,
    allResources,
    attendanceCodes,
  ] = await Promise.all([
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("client_contracts" as never)
        .select("id,contract_code,unit_id,status,record_type,approval_status")
        .eq("record_type", "client")
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("units" as never).select("id,name,customer_id").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("customers" as never).select("id,name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase.from("designations" as never).select("id,name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("candidates" as never)
        .select(
          "id,full_name,designation_id,role_key,status,non_billable,unit_id,employee_code,candidate_code,is_enabled",
        )
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("candidate_units" as never)
        .select("candidate_id,unit_id")
        .order("candidate_id", { ascending: true })
        .range(from, to),
    ),
    // One paged read of every resource line beats an `.in(...)` over several
    // hundred contract ids, which overflows the request URL.
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("contract_resources" as never)
        .select("contract_id,designation_id,role_key,quantity")
        .order("contract_id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<BaseRow>((from, to) =>
      supabase
        .from("attendance_codes" as never)
        .select("code,counts_as_present,is_leave,is_paid,day_value")
        .range(from, to),
    ),
  ]);

  const activeContractIds = new Set(contracts.map((c) => String(c.id)));
  const resources = allResources.filter((r) => activeContractIds.has(String(r.contract_id)));

  return {
    contracts,
    units,
    customers,
    designations,
    candidates,
    candidateUnits,
    resources,
    attendanceCodes,
  };
}

/** Load the shared lookups, reusing a recent result or an in-flight request. */
export function loadDashboardBase(): Promise<DashboardBase> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.data);
  if (inflight) return inflight;
  inflight = load()
    .then((data) => {
      cached = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cache so the next read hits the database (used after writes). */
export function invalidateDashboardBase() {
  cached = null;
}
