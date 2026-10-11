import { supabase } from "@/integrations/supabase/client";

type Client = typeof supabase;

/**
 * Candidate ids with attendance at the unit inside the period. Payroll and
 * invoices add these to the roster even when the person has since left or was
 * disabled, so someone who worked part of the month is still paid and billed.
 */
export async function fetchAttendedCandidateIds(
  unitId: string,
  start: string,
  end: string,
  client: Client = supabase,
): Promise<string[]> {
  const ids = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from("attendance_entries")
      .select("candidate_id")
      .eq("unit_id", unitId)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error || !data) break;
    for (const r of data as { candidate_id: string }[]) ids.add(r.candidate_id);
    if (data.length < page) break;
  }
  return Array.from(ids);
}
