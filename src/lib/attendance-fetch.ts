import { supabase } from "@/integrations/supabase/client";
import { chunkIds, fetchAllPagesParallel, fetchInChunks, mapPool, runBulk } from "@/lib/supabase-batch";

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

  // Per id chunk: page 1 carries the exact count, then the remaining 1000-row
  // ranges are requested together (each through the tab-wide pool) instead of
  // one after another — a 6k-row month is 2 round trips, not 6.
  const pages = await mapPool(chunkIds(unitIds), 8, (chunk) =>
    fetchAllPagesParallel<AttendanceEntryFetchRow>(
      (from, to, first) =>
        client
          .from("attendance_entries")
          .select(selectCols, first ? { count: "exact" } : undefined)
          .gte("entry_date", params.start)
          .lte("entry_date", params.end)
          .in("unit_id", chunk)
          // A unique tie-breaker is mandatory: with only entry_date, rows sharing a
          // date are returned in an unstable order across 1000-row pages, so some
          // days were silently skipped and others repeated (MIS 25 vs sheet 26).
          .order("entry_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      { run: runBulk },
    ),
  );
  const fetched = pages.flat();
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

/** Columns of one attendance row as `fetchAttendanceEntriesForPeriod` returns it. */
export const ATTENDANCE_ENTRY_COLUMNS = "id, candidate_id, designation_id, shift_hours, is_reliever, entry_date, code, ot_hours";

type KeyedEntry = {
  id?: string;
  candidate_id: string;
  designation_id: string | null;
  shift_hours?: number | null;
  is_reliever?: boolean | null;
  entry_date: string;
};

/** One saved cell = person + role + shift + reliever flag + date (the upsert's conflict key). */
export const attendanceEntryLineKey = (r: KeyedEntry) =>
  `${r.candidate_id}|${r.designation_id ?? ""}|${Number(r.shift_hours) || 0}|${r.is_reliever ? 1 : 0}|${r.entry_date}`;

/** Server order of the period read: entry_date, then id (uuid order = lowercase hex order). */
function sortLikePeriodRead<T extends KeyedEntry>(rows: T[]): T[] {
  return rows.sort((a, b) =>
    a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : String(a.id ?? "") < String(b.id ?? "") ? -1 : String(a.id ?? "") > String(b.id ?? "") ? 1 : 0);
}

/**
 * Cached period rows with just-saved rows patched in (same id or same cell
 * replaces; new cells are added), in the order a fresh period read returns.
 */
export function patchAttendanceEntryRows<T extends KeyedEntry>(cached: T[] | undefined, saved: T[]): T[] {
  const savedIds = new Set(saved.map((r) => r.id).filter(Boolean));
  const savedKeys = new Set(saved.map(attendanceEntryLineKey));
  const kept = (cached ?? []).filter((r) => !(r.id && savedIds.has(r.id)) && !savedKeys.has(attendanceEntryLineKey(r)));
  return sortLikePeriodRead([...kept, ...saved]);
}

/**
 * Cached period rows with every row of `candidateIds` replaced by `fresh`
 * (their complete re-read): the database attendance rules recompute a guard's
 * whole month, so one person's re-read captures every side effect on their rows.
 */
export function replaceCandidateEntryRows<T extends KeyedEntry>(cached: T[] | undefined, candidateIds: Iterable<string>, fresh: T[]): T[] {
  const ids = new Set(candidateIds);
  const seen = new Set<string>();
  const unique = fresh.filter((r) => {
    const k = r.id ?? attendanceEntryLineKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return sortLikePeriodRead([...(cached ?? []).filter((r) => !ids.has(r.candidate_id)), ...unique]);
}

/** Every row of these people at one unit in the period (same columns/order as the period read). */
export async function fetchCandidateEntriesForPeriod(
  params: { unitId: string; candidateIds: string[]; start: string; end: string },
  client: Client = supabase,
): Promise<AttendanceEntryFetchRow[]> {
  const ids = Array.from(new Set(params.candidateIds.filter(Boolean)));
  if (!ids.length) return [];
  return fetchInChunks<AttendanceEntryFetchRow>(ids, (chunk, from, to) =>
    client
      .from("attendance_entries")
      .select(ATTENDANCE_ENTRY_COLUMNS)
      .eq("unit_id", params.unitId)
      .in("candidate_id", chunk)
      .gte("entry_date", params.start)
      .lte("entry_date", params.end)
      .order("entry_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}
