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

type Client = typeof supabase;

export async function fetchAttendanceEntriesForPeriod(params: {
  unitId?: string;
  unitIds?: string[];
  start: string;
  end: string;
  includeUnitId?: boolean;
}, client: Client = supabase): Promise<AttendanceEntryFetchRow[]> {
  const unitIds = params.unitId ? [params.unitId] : Array.from(new Set(params.unitIds ?? []));
  if (unitIds.length === 0) return [];

  const rows: AttendanceEntryFetchRow[] = [];
  const selectCols = `id, ${params.includeUnitId ? "unit_id, " : ""}candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours`;

  const fetched = await fetchInChunks<AttendanceEntryFetchRow>(unitIds, (chunk, from, to) =>
    client
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

/** Attendance grouped per (unit, person, line, code) — `days` rows each. */
export type AttendanceEntryTotalRow = AttendanceEntryFetchRow & { unit_id: string; days: number };

/**
 * Charter-scale read: one grouped server request per window instead of paging
 * every raw row. Multiply per-day values by `days`; `ot_hours` is already summed.
 */
export async function fetchAttendanceTotalsForPeriod(params: {
  unitIds: string[];
  start: string;
  end: string;
}): Promise<AttendanceEntryTotalRow[]> {
  const unitIds = Array.from(new Set(params.unitIds));
  if (unitIds.length === 0) return [];
  const { data, error } = await (supabase.rpc as any)("finance_charter_entry_totals", {
    _unit_ids: unitIds,
    _start: params.start,
    _end: params.end,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    unit_id: r.unit_id as string,
    candidate_id: r.candidate_id as string,
    designation_id: (r.designation_id ?? null) as string | null,
    shift_hours: r.shift_hours == null ? null : Number(r.shift_hours),
    code: r.code as string,
    days: Number(r.days) || 0,
    ot_hours: Number(r.ot_hours) || 0,
    entry_date: params.start,
  }));
}
