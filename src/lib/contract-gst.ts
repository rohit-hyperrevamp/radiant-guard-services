import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "./supabase-batch";

type Period = { unitId: string; periodStart: string; periodEnd: string };
type Contract = { unit_id: string; start_date: string; end_date: string | null; status: string; gst_option: string | null };

/** Rows arrive in the same order as fetchPeriodContract. */
export function periodGstOption(contracts: Contract[], period: Period): string | null {
  const rows = contracts.filter((c) => c.unit_id === period.unitId);
  const contract = rows.find((c) => c.start_date <= period.periodEnd && (!c.end_date || c.end_date >= period.periodStart))
    ?? rows.find((c) => c.status === "active");
  return contract?.gst_option ?? null;
}

export async function loadPeriodGstOptions(periods: Period[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(periods.map((p) => p.unitId))];
  const contracts: Contract[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await fetchAllPages<Contract>((from, to) => supabase.from("client_contracts")
      .select("unit_id,start_date,end_date,status,gst_option")
      .eq("record_type", "client").in("status", ["active", "expired"])
      .in("unit_id", ids.slice(i, i + 100))
      .order("start_date", { ascending: false }).order("status", { ascending: true })
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
    contracts.push(...rows);
  }
  return new Map(periods.map((p) => [p.unitId, periodGstOption(contracts, p)]));
}