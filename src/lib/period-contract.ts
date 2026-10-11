import { supabase } from "@/integrations/supabase/client";

type Client = typeof supabase;

/**
 * The client contract that governs a payroll/invoice period: an active or
 * expired contract whose dates overlap the period (latest start wins), else
 * the latest active contract. A September payroll stays computable after the
 * contract expires on 30 Sep, and a superseded contract is never used for a
 * month it did not cover.
 */
export async function fetchPeriodContract<T extends Record<string, unknown>>(
  unitId: string,
  periodStart: string,
  periodEnd: string,
  columns: string,
  client: Client = supabase,
): Promise<T | null> {
  const { data: overlap } = await client
    .from("client_contracts")
    .select(columns)
    .eq("unit_id", unitId)
    .eq("record_type", "client")
    .in("status", ["active", "expired"])
    .lte("start_date", periodEnd)
    .or(`end_date.is.null,end_date.gte.${periodStart}`)
    .order("start_date", { ascending: false })
    .limit(1);
  if (overlap && overlap.length) return overlap[0] as unknown as T;
  const { data: active } = await client
    .from("client_contracts")
    .select(columns)
    .eq("unit_id", unitId)
    .eq("record_type", "client")
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1);
  return (active?.[0] as unknown as T) ?? null;
}
