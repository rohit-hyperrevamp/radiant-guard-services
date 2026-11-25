// Attendance version control for post-payroll amendments.
//
// Normal life: attendance is draft → submitted → approved, payroll processes,
// period is frozen. Version 1 of the muster roll is the paid truth.
//
// If something was paid wrong, the sheet is NOT reopened (approved means
// approved). Instead an AMENDMENT is started: the live entries are frozen into
// `attendance_sheet_versions` as the previous version, `current_version` is
// bumped and `amendment_status` walks open → submitted → approved → processed.
// Payroll then posts only the delta for the employees whose attendance moved.

import { supabase } from "@/integrations/supabase/client";
import { fetchAttendanceEntriesForPeriod } from "@/lib/attendance-fetch";

export type AmendmentStatus = "none" | "open" | "submitted" | "approved" | "processed";

export type AttendanceSnapshotEntry = {
  candidate_id: string;
  designation_id: string | null;
  entry_date: string;
  code: string;
  ot_hours: number;
  /** Absent on snapshots frozen before line identity was stored (legacy). */
  shift_hours?: number | null;
  is_reliever?: boolean;
};

export type AttendanceVersionRow = {
  id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  version: number;
  status: string;
  reason: string;
  snapshot: AttendanceSnapshotEntry[];
  created_at: string;
  approved_at: string | null;
};

export type EntryDiff = {
  candidateId: string;
  designationId: string | null;
  date: string;
  shiftHours: number | null;
  isReliever: boolean;
  beforeCode: string;
  afterCode: string;
  beforeEd: number;
  afterEd: number;
};

type SnapshotKeySource = {
  candidate_id: string;
  designation_id: string | null;
  entry_date: string;
  shift_hours?: number | null;
  is_reliever?: boolean | null;
};

/** One attendance line = person + role + shift length + reliever flag + date.
 *  A regular and a reliever line on the same date are different lines. */
export const snapshotKeyOf = (e: SnapshotKeySource, legacy = false) =>
  legacy
    ? `${e.candidate_id}|${e.designation_id ?? ""}|${e.entry_date}`
    : `${e.candidate_id}|${e.designation_id ?? ""}|${e.shift_hours == null ? "" : Number(e.shift_hours)}|${e.is_reliever ? 1 : 0}|${e.entry_date}`;

/** Snapshots frozen before shift_hours/is_reliever were stored carry neither field. */
const isLegacySnapshot = (rows: AttendanceSnapshotEntry[]) =>
  rows.length > 0 && rows.every((e) => !("shift_hours" in e) && !("is_reliever" in e));

const toSnapshot = (e: {
  candidate_id: string;
  designation_id?: string | null;
  entry_date: string;
  code?: string | null;
  ot_hours?: number | string | null;
  shift_hours?: number | string | null;
  is_reliever?: boolean | null;
}): AttendanceSnapshotEntry => ({
  candidate_id: e.candidate_id,
  designation_id: e.designation_id ?? null,
  entry_date: e.entry_date,
  code: e.code ?? "",
  ot_hours: Number(e.ot_hours) || 0,
  shift_hours: e.shift_hours == null ? null : Number(e.shift_hours),
  is_reliever: !!e.is_reliever,
});

export async function fetchAttendanceVersions(
  unitId: string,
  periodStart: string,
  periodEnd: string,
): Promise<AttendanceVersionRow[]> {
  const { data, error } = await supabase
    .from("attendance_sheet_versions" as never)
    .select("id, unit_id, period_start, period_end, version, status, reason, snapshot, created_at, approved_at")
    .eq("unit_id", unitId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("version", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown) as AttendanceVersionRow[];
}

/** Freeze the live muster roll as `version` and open the next version for editing. */
export async function startAttendanceAmendment(params: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  sheetId: string | null;
  currentVersion: number;
  reason: string;
}): Promise<number> {
  const { unitId, periodStart, periodEnd, currentVersion } = params;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  const live = await fetchAttendanceEntriesForPeriod({ unitId, start: periodStart, end: periodEnd });
  const snapshot: AttendanceSnapshotEntry[] = live.map(toSnapshot);

  const { error: verErr } = await supabase.from("attendance_sheet_versions" as never).upsert(
    {
      unit_id: unitId,
      period_start: periodStart,
      period_end: periodEnd,
      version: currentVersion,
      status: "locked",
      reason: params.reason,
      snapshot: snapshot as never,
      created_by: uid,
      approved_at: new Date().toISOString(),
      approved_by: uid,
    } as never,
    { onConflict: "unit_id,period_start,period_end,version" } as never,
  );
  if (verErr) throw verErr;

  const nextVersion = currentVersion + 1;
  const patch = { current_version: nextVersion, amendment_status: "open" } as Record<string, unknown>;
  if (params.sheetId) {
    const { error } = await supabase.from("attendance_sheets" as never).update(patch as never).eq("id", params.sheetId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance_sheets" as never).insert({
      unit_id: unitId,
      period_start: periodStart,
      period_end: periodEnd,
      status: "approved",
      ...patch,
    } as never);
    if (error) throw error;
  }
  return nextVersion;
}

export async function setAmendmentStatus(sheetId: string, next: AmendmentStatus) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const patch: Record<string, unknown> = { amendment_status: next };
  if (next === "approved") { patch.approved_at = new Date().toISOString(); patch.approved_by = uid; }
  const { error } = await supabase.from("attendance_sheets" as never).update(patch as never).eq("id", sheetId);
  if (error) throw error;
}

/** Cell-level diff between a frozen snapshot and the live entries. */
export function diffAttendance(
  before: AttendanceSnapshotEntry[],
  after: AttendanceSnapshotEntry[],
): EntryDiff[] {
  // Legacy snapshots have no line identity; compare them on the old key so an
  // upgrade does not flag every row as changed.
  const legacy = isLegacySnapshot(before);
  const beforeMap = new Map(before.map((e) => [snapshotKeyOf(e, legacy), e]));
  // In legacy mode the old key can't tell a regular line from a reliever line on
  // the same date, so compare only the regular (non-reliever) live lines —
  // otherwise whichever line came last would overwrite the other.
  const comparable = legacy
    ? after.filter((e) => !(e as { is_reliever?: boolean | null }).is_reliever)
    : after;
  const afterMap = new Map(comparable.map((e) => [snapshotKeyOf(e, legacy), e]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const out: EntryDiff[] = [];
  for (const k of keys) {
    const b = beforeMap.get(k);
    const a = afterMap.get(k);
    const bCode = (b?.code ?? "").trim();
    const aCode = (a?.code ?? "").trim();
    const bEd = Number(b?.ot_hours) || 0;
    const aEd = Number(a?.ot_hours) || 0;
    if (bCode === aCode && Math.abs(bEd - aEd) < 0.0001) continue;
    const ref = a ?? b!;
    out.push({
      candidateId: ref.candidate_id,
      designationId: ref.designation_id ?? null,
      date: ref.entry_date,
      shiftHours: ref.shift_hours == null ? null : Number(ref.shift_hours),
      isReliever: !!ref.is_reliever,
      beforeCode: bCode,
      afterCode: aCode,
      beforeEd: bEd,
      afterEd: aEd,
    });
  }
  return out.sort((x, y) => (x.candidateId === y.candidateId ? x.date.localeCompare(y.date) : x.candidateId.localeCompare(y.candidateId)));
}

export async function fetchLiveSnapshot(unitId: string, periodStart: string, periodEnd: string) {
  const live = await fetchAttendanceEntriesForPeriod({ unitId, start: periodStart, end: periodEnd });
  return live.map(toSnapshot);
}

/** The same snapshot `fetchLiveSnapshot` builds, from rows already read. */
export function liveSnapshotFrom(rows: Parameters<typeof toSnapshot>[0][]): AttendanceSnapshotEntry[] {
  return rows.map(toSnapshot);
}

/**
 * The newest frozen version below `beforeVersion` (what
 * `fetchAttendanceVersions(...).filter(v < beforeVersion).sort(desc)[0]`
 * picked), reading one row instead of every version's full snapshot.
 */
export async function fetchPreviousAttendanceVersion(
  unitId: string,
  periodStart: string,
  periodEnd: string,
  beforeVersion: number,
): Promise<AttendanceVersionRow | null> {
  const { data, error } = await supabase
    .from("attendance_sheet_versions" as never)
    .select("id, unit_id, period_start, period_end, version, status, reason, snapshot, created_at, approved_at")
    .eq("unit_id", unitId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .lt("version", beforeVersion)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as unknown as AttendanceVersionRow | null;
}
