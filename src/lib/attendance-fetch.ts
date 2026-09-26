import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";

export type AttendanceEntryFetchRow = {
  unit_id?: string;
  candidate_id: string;
  designation_id: string | null;
  entry_date: string;
  code: string;
  ot_hours: number | string | null;
  shift_hours?: number | null;
  is_reliever?: boolean | null;
};

export async function fetchAttendanceEntriesForPeriod(params: {
  unitId?: string;
  unitIds?: string[];
  start: string;
  end: string;
  includeUnitId?: boolean;
}): Promise<AttendanceEntryFetchRow[]> {
  const unitIds = params.unitId ? [params.unitId] : Array.from(new Set(params.unitIds ?? []));
  if (unitIds.length === 0) return [];

  const rows: AttendanceEntryFetchRow[] = [];
  const selectCols = `id, ${params.includeUnitId ? "unit_id, " : ""}candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours`;

  const fetched = await fetchInChunks<AttendanceEntryFetchRow>(unitIds, (chunk, from, to) =>
    supabase
      .from("attendance_entries")
      .select(selectCols)
      .gte("entry_date", params.start)
      .lte("entry_date", params.end)
      .in("unit_id", chunk)
      // A unique tie-breaker is mandatory: with only entry_date, rows sharing a
      // date are returned in an unstable order across 1000-row pages, so some
      // days were silently skipped and others repeated (MIS 25 vs sheet 26).
      .order("entry_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  // Belt and braces: one row per (unit, person, line, day) — never double-count.
  const seen = new Set<string>();
  for (const r of fetched as (AttendanceEntryFetchRow & { id?: string })[]) {
    const key = r.id ?? `${r.unit_id ?? ""}|${r.candidate_id}|${r.designation_id ?? ""}|${r.shift_hours ?? ""}|${r.is_reliever ? 1 : 0}|${r.entry_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }

  return rows;
}
