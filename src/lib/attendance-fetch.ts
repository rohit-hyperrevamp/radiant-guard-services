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
  const selectCols = `${params.includeUnitId ? "unit_id, " : ""}candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours`;

  const fetched = await fetchInChunks<AttendanceEntryFetchRow>(unitIds, (chunk, from, to) =>
    supabase
      .from("attendance_entries")
      .select(selectCols)
      .gte("entry_date", params.start)
      .lte("entry_date", params.end)
      .in("unit_id", chunk)
      .order("entry_date", { ascending: true })
      .range(from, to),
  );
  rows.push(...fetched);

  return rows;
}
