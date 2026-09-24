import { supabase } from "@/integrations/supabase/client";

/**
 * A contract can carry the same designation twice — once for 8-hour duty and
 * once for 12-hour duty. The guard's posting (candidate_units.shift_hours)
 * decides which line applies. When a posting has no duty length set, the
 * designation's default line is used (unchanged behaviour).
 */
export const normShift = (h: unknown): 8 | 12 => (Number(h) === 12 ? 12 : 8);
export const shiftKey = (designationId: string | null | undefined, hours: unknown) =>
  `${designationId ?? ""}|${normShift(hours)}`;

/** candidate_id -> 8 | 12 for postings on the given unit(s) (key `${unit}|${candidate}`). */
export async function fetchPostingShifts(unitIds: string[]): Promise<Map<string, 8 | 12>> {
  const out = new Map<string, 8 | 12>();
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  if (!ids.length) return out;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("candidate_units")
        .select("candidate_id, unit_id, shift_hours" as never)
        .in("unit_id", chunk)
        .not("shift_hours" as never, "is", null)
        .range(from, from + 999);
      if (error) break;
      const rows = (data ?? []) as unknown as { candidate_id: string; unit_id: string; shift_hours: number }[];
      for (const r of rows) out.set(`${r.unit_id}|${r.candidate_id}`, normShift(r.shift_hours));
      if (rows.length < 1000) break;
    }
  }
  return out;
}
