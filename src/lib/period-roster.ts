import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-batch";
import { visibleAttendanceCandidateIds } from "@/lib/attendance-roster-eligibility";

type Client = typeof supabase;

type CandidateRef = { candidate_id: string };
type Maybe<T> = T | PromiseLike<T>;

/**
 * Rows the caller has already loaded for the same unit + period. Each is
 * optional; a missing, null or failed value falls back to reading it here.
 *  - entries: attendance_entries for (unitId, start..end) — any columns incl. candidate_id
 *  - links:   every candidate_units row for unitId (candidate_id)
 */
export type AttendedPreloaded = {
  entries?: Maybe<CandidateRef[] | null | undefined>;
  links?: Maybe<CandidateRef[] | null | undefined>;
};

async function settle<T>(value: Maybe<T[] | null | undefined> | undefined): Promise<T[] | null> {
  if (value === undefined) return null;
  try {
    return (await value) ?? null;
  } catch {
    return null;
  }
}

/**
 * Candidate ids with attendance AND eligibility for the visible site sheet.
 * Money pages must not silently restore hidden, unassigned employees.
 */
export async function fetchAttendedCandidateIds(
  unitId: string,
  start: string,
  end: string,
  client: Client = supabase,
  preloaded?: AttendedPreloaded,
): Promise<string[]> {
  const ids = new Set<string>();
  const loadedEntries = await settle<CandidateRef>(preloaded?.entries);
  if (loadedEntries) {
    for (const r of loadedEntries) if (r.candidate_id) ids.add(r.candidate_id);
  } else {
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
      if (error) throw error;
      if (!data) break;
      for (const r of data as { candidate_id: string }[]) ids.add(r.candidate_id);
      if (data.length < page) break;
    }
  }
  if (!ids.size) return [];
  const [candidates, links, scopes] = await Promise.all([
    fetchInChunks<{ id: string; unit_id: string | null; is_enabled: boolean | null; status: string | null }>(Array.from(ids), (chunk, from, to) =>
      client.from("candidates").select("id, unit_id, is_enabled, status").in("id", chunk).order("id").range(from, to)),
    settle<CandidateRef>(preloaded?.links).then((rows) => rows ?? fetchInChunks<CandidateRef>([unitId], (chunk, from, to) =>
      client.from("candidate_units").select("candidate_id").in("unit_id", chunk).order("id").range(from, to))),
    fetchInChunks<CandidateRef>([unitId], (chunk, from, to) =>
      client.from("employee_scope_assignments").select("candidate_id").eq("scope_type", "unit").in("scope_id", chunk).order("id").range(from, to)),
  ]);
  return visibleAttendanceCandidateIds(unitId, candidates, links.map((l) => l.candidate_id), scopes.map((s) => s.candidate_id));
}
