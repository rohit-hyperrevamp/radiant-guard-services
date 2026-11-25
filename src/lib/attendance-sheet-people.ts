import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-resolution of people found on an uploaded attendance sheet.
 *
 * Uploading a muster must never require the user to pre-map resources on the
 * unit. Every sheet row already carries an employee ID (and a name), so we
 * resolve it ourselves:
 *   1. find the employee by employee code / candidate code (or an unambiguous
 *      full-name match),
 *   2. create the employee when no record exists,
 *   3. map primary guards to this unit; keep relievers as people-only records,
 * and only then write attendance.
 */

export type SheetPersonRef = {
  /** Candidate cells from the row that could be an employee / candidate code. */
  codeTokens: string[];
  /** Candidate cells from the row that could be a person's name. */
  nameTokens: string[];
  /** Contract designation resolved from the sheet's designation column, if any. */
  designationId: string | null;
  designationName: string | null;
  /** True only when the sheet row itself marks the person as a reliever / (R). */
  isReliever?: boolean;
};

export type ResolvedSheetPerson = {
  candidateId: string;
  designationId: string | null;
  name: string;
  employeeCode: string | null;
  created: boolean;
  mapped: boolean;
  isPrimary: boolean;
  isReliever: boolean;
};

export type AttendanceUnitMapping = {
  mapped: boolean;
  isPrimary: boolean;
  isReliever: boolean;
};

type CandidateRow = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  unit_id: string | null;
  designation_id: string | null;
};

const CANDIDATE_SELECT = "id, full_name, employee_code, unit_id, designation_id";

const looksLikeCode = (value: string) => /\d/.test(value) && value.trim().length >= 3;
const looksLikeName = (value: string) =>
  /[a-zA-Z]/.test(value) && value.replace(/[^a-zA-Z]/g, "").length >= 3;

/** A sheet row is a reliever line only when it says so: "reliever", "(R)", "R -". */
export const looksLikeRelieverText = (...parts: Array<string | null | undefined>) => {
  const text = parts.filter(Boolean).join(" ");
  return /\breliever\b|\brelief\b|\(\s*r\s*\)|\bR\s*[-–]\s/i.test(text);
};


function cleanTokens(tokens: string[]) {
  return Array.from(
    new Set(
      tokens
        .map((t) => String(t ?? "").trim())
        .filter((t) => t.length > 0 && t.length <= 80),
    ),
  );
}

/** Lookup outcome: one record, nothing, or more than one candidate (never guess). */
type Lookup = CandidateRow | "ambiguous" | null;

/** Pick the single record from a lookup, or report ambiguity — never the first hit. */
export function uniqueMatch<T extends { id: string }>(rows: T[]): T | "ambiguous" | null {
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size === 0) return null;
  if (ids.size > 1) return "ambiguous";
  return rows[0];
}

/** Escape LIKE wildcards so ilike behaves as an exact, case-insensitive match. */
export const exactIlikePattern = (value: string) =>
  value.trim().replace(/\s+/g, " ").replace(/[\\%_]/g, (c) => `\\${c}`);

async function findByCodes(codes: string[]): Promise<Lookup> {
  if (!codes.length) return null;
  for (const column of ["employee_code", "candidate_code"] as const) {
    const { data, error } = await supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .in(column, codes)
      .limit(5);
    if (error) throw new Error(`Could not look up employee codes: ${error.message}`);
    const hit = uniqueMatch((data ?? []) as CandidateRow[]);
    if (hit) return hit;
  }
  return null;
}

async function findByName(names: string[]): Promise<Lookup> {
  for (const name of names) {
    const { data, error } = await supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .ilike("full_name", exactIlikePattern(name))
      .limit(2);
    if (error) throw new Error(`Could not look up employee names: ${error.message}`);
    // Only trust a name when it is unambiguous company-wide.
    const hit = uniqueMatch((data ?? []) as CandidateRow[]);
    if (hit) return hit;
  }
  return null;
}

/**
 * Imports may move postings (primary unit, reliever flag, candidates.unit_id)
 * only for the current or a future attendance window. Importing a past month
 * must never move a guard's present home unit.
 */
export function importMayChangePostings(periodEnd: string, todayIso: string): boolean {
  return !!periodEnd && periodEnd >= todayIso;
}

async function roleKeyForDesignation(contractId: string | null, designationId: string | null) {
  if (!contractId || !designationId) return null;
  const { data } = await supabase
    .from("contract_resources")
    .select("role_key")
    .eq("contract_id", contractId)
    .eq("designation_id", designationId)
    .not("role_key", "is", null)
    .limit(1)
    .maybeSingle();
  return (data as { role_key?: string | null } | null)?.role_key ?? null;
}

/**
 * Reliever status comes from the sheet, never from other postings.
 *   - row marked reliever  -> reliever link on this unit (Extra Duty only),
 *     the guard's primary unit is left untouched / unset here.
 *   - row not marked       -> the guard is mapped to THIS unit as primary;
 *     any primary mapping at another unit is demoted so the one-primary rule
 *     still holds.
 */
export async function ensureAttendanceUnitMapping(
  candidateId: string,
  unitId: string,
  designationId: string | null,
  sheetReliever = false,
  /** False when importing a past period: add a missing link, never move postings. */
  allowPostingChanges = true,
): Promise<AttendanceUnitMapping> {
  const { data: existing } = await supabase
    .from("candidate_units")
    .select("id, designation_id, is_primary, is_reliever")
    .eq("candidate_id", candidateId)
    .eq("unit_id", unitId)
    .limit(1)
    .maybeSingle();

  const row = existing as {
    id: string;
    designation_id: string | null;
    is_primary: boolean | null;
    is_reliever: boolean | null;
  } | null;

  if (row && !allowPostingChanges) {
    // Past period: postings can't be changed, so record attendance on the line
    // that actually exists. If the existing link is a reliever link, the DB only
    // accepts reliever (Extra Duty) marks there — writing a regular line would be
    // rejected and abort the import halfway.
    return {
      mapped: false,
      isPrimary: row.is_primary === true,
      isReliever: row.is_reliever === true || sheetReliever,
    };
  }

  if (!row && !allowPostingChanges) {
    // Past period: the person needs a link to appear on this sheet, but it must
    // not become their primary posting or demote their current one.
    const { error } = await supabase.from("candidate_units").insert({
      candidate_id: candidateId,
      unit_id: unitId,
      designation_id: designationId,
      is_primary: false,
      is_reliever: sheetReliever,
      sort_order: 0,
    } as never);
    if (error) throw new Error(error.message);
    return { mapped: true, isPrimary: false, isReliever: sheetReliever };
  }

  if (row) {
    const patch: Record<string, unknown> = {};
    const nextDesignation = designationId ?? row.designation_id;
    if (nextDesignation !== row.designation_id) patch["designation_id"] = nextDesignation;
    if (sheetReliever) {
      if (row.is_primary === true) patch["is_primary"] = false;
      if (row.is_reliever !== true) patch["is_reliever"] = true;
    } else {
      if (row.is_primary !== true) patch["is_primary"] = true;
      if (row.is_reliever === true) patch["is_reliever"] = false;
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("candidate_units")
        .update(patch as never)
        .eq("id", row.id);
      if (error) throw new Error(`Could not map employee for attendance: ${error.message}`);
    }
    if (!sheetReliever) await demoteOtherPrimaries(candidateId, unitId);
    return { mapped: false, isPrimary: !sheetReliever, isReliever: sheetReliever };
  }

  const { error } = await supabase.from("candidate_units").insert({
    candidate_id: candidateId,
    unit_id: unitId,
    designation_id: designationId,
    is_primary: !sheetReliever,
    is_reliever: sheetReliever,
    sort_order: 0,
  } as never);
  if (error) throw new Error(error.message);
  if (!sheetReliever) await demoteOtherPrimaries(candidateId, unitId);
  return { mapped: true, isPrimary: !sheetReliever, isReliever: sheetReliever };
}

/**
 * Force this unit to be the guard's posted (primary) line, clearing any stale
 * reliever flag. Used as a self-heal when the database rejects normal
 * attendance because an older mapping still marks the guard as a reliever.
 */
export async function forcePrimaryAttendanceMapping(
  candidateId: string,
  unitId: string,
  designationId: string | null,
) {
  const { error } = await supabase
    .from("candidate_units")
    .update({
      is_primary: true,
      is_reliever: false,
      ...(designationId ? { designation_id: designationId } : {}),
    } as never)
    .eq("candidate_id", candidateId)
    .eq("unit_id", unitId);
  if (error) throw new Error(`Could not post this employee to the site: ${error.message}`);
  await demoteOtherPrimaries(candidateId, unitId);
}

/** Keep exactly one primary posting: this unit, and keep the home unit in step. */
async function demoteOtherPrimaries(candidateId: string, unitId: string) {
  const { error } = await supabase
    .from("candidate_units")
    .update({ is_primary: false } as never)
    .eq("candidate_id", candidateId)
    .eq("is_primary", true)
    .neq("unit_id", unitId);
  if (error) throw new Error(`Could not update other postings: ${error.message}`);
  await syncGuardHomeUnit(candidateId, unitId);
}

/** A guard's home unit must always be the unit of their primary posting. */
async function syncGuardHomeUnit(candidateId: string, unitId: string) {
  const { error } = await supabase
    .from("candidates")
    .update({ unit_id: unitId } as never)
    .eq("id", candidateId)
    .eq("role_key", "guard")
    .neq("unit_id", unitId);
  if (error) throw new Error(`Could not update home unit: ${error.message}`);
}


export async function resolveSheetPersonForUnit(opts: {
  unitId: string;
  contractId: string | null;
  ref: SheetPersonRef;
  /** Joining / application date used when an employee has to be created. */
  joiningDate: string;
  createdBy?: string | null;
  /** False for a past period — see importMayChangePostings. Defaults to true. */
  allowPostingChanges?: boolean;
  /** Called (and null returned) when the row matches more than one employee. */
  onUnmatched?: (reason: string) => void;
}): Promise<ResolvedSheetPerson | null> {
  const { unitId, contractId, ref, joiningDate, createdBy } = opts;
  const allowPostingChanges = opts.allowPostingChanges !== false;
  const tokens = cleanTokens([...ref.codeTokens, ...ref.nameTokens]);
  const codes = tokens.filter(looksLikeCode);
  const names = tokens.filter(looksLikeName).sort((a, b) => b.length - a.length);

  let found = await findByCodes(codes);
  if (!found) found = await findByName(names);
  if (found === "ambiguous") {
    // Never pick one of several people, and never create a duplicate.
    opts.onUnmatched?.(
      `${names[0] ?? codes[0] ?? "Row"}: matches more than one employee — fix the ID on the sheet`,
    );
    return null;
  }

  if (found) {
    const mapping = await ensureAttendanceUnitMapping(
      found.id,
      unitId,
      ref.designationId ?? found.designation_id ?? null,
      ref.isReliever === true,
      allowPostingChanges,
    );
    return {
      candidateId: found.id,
      designationId: ref.designationId ?? found.designation_id ?? null,
      name: found.full_name || names[0] || "Employee",
      employeeCode: found.employee_code ?? null,
      created: false,
      ...mapping,
    };
  }

  // Nothing on record — create the employee from what the sheet gives us.
  const name = names[0];
  if (!name) return null;
  const employeeCode = codes[0] ?? null;
  const roleKey = (await roleKeyForDesignation(contractId, ref.designationId)) || "guard";

  const insertPayload = {
    full_name: name,
    status: "active",
    // Relievers get no primary unit; regular guards are based at this unit.
    unit_id: ref.isReliever === true ? null : unitId,
    designation_id: ref.designationId,
    role_key: roleKey,
    application_date: joiningDate,
    preferred_joining_date: joiningDate,
    ...(employeeCode ? { employee_code: employeeCode } : {}),
    ...(createdBy ? { created_by: createdBy } : {}),
  };
  const { data: created, error } = await supabase
    .from("candidates")
    .insert(insertPayload as never)
    .select("id, employee_code")
    .single();
  if (error) throw new Error(`Could not create ${name}: ${error.message}`);
  const candidateId = (created as { id: string; employee_code: string | null }).id;
  const mapping = await ensureAttendanceUnitMapping(
    candidateId,
    unitId,
    ref.designationId,
    ref.isReliever === true,
    // A just-created employee has no other posting to move.
    true,
  );

  return {
    candidateId,
    designationId: ref.designationId,
    name,
    employeeCode: (created as { employee_code: string | null }).employee_code ?? employeeCode,
    created: true,
    ...mapping,
  };
}

// ---------------------------------------------------------------------------
// Import replacement: only the dates the file actually covers are replaced.
// ---------------------------------------------------------------------------

/** One attendance line cell exactly as an import wrote it. */
export type ImportedCell = {
  candidate_id: string;
  designation_id: string | null;
  shift_hours: number | null;
  is_reliever: boolean | null;
  entry_date: string;
};

type StoredImportCell = ImportedCell & { id: string };

const importLineKey = (e: ImportedCell) =>
  `${e.candidate_id}|${e.designation_id ?? ""}|${Number(e.shift_hours) || 0}|${e.is_reliever ? 1 : 0}|${e.entry_date}`;

/**
 * Stored entries an import replaces: on a date the file covers for that person,
 * any line the import did not just write (e.g. a phantom designation). Dates
 * the file does not cover for the person are never touched.
 */
export function staleEntryIdsAfterImport(
  stored: StoredImportCell[],
  written: ImportedCell[],
  coveredDates: Map<string, Set<string>>,
): string[] {
  const writtenKeys = new Set(written.map(importLineKey));
  return stored
    .filter((e) => coveredDates.get(e.candidate_id)?.has(e.entry_date))
    .filter((e) => !writtenKeys.has(importLineKey(e)))
    .map((e) => e.id);
}

/** Add `dates` to `candidateId`'s covered set. */
export function addCoveredDates(
  covered: Map<string, Set<string>>,
  candidateId: string,
  dates: Iterable<string>,
) {
  const set = covered.get(candidateId) ?? new Set<string>();
  for (const d of dates) set.add(d);
  covered.set(candidateId, set);
}

/**
 * Run AFTER the import's writes succeeded: delete the stale lines on covered
 * dates only. Write-then-delete keeps old attendance if a write fails halfway.
 * (True atomicity needs a server RPC.)
 */
export async function removeEntriesReplacedByImport(opts: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  written: ImportedCell[];
  coveredDates: Map<string, Set<string>>;
}): Promise<number> {
  const candidateIds = Array.from(opts.coveredDates.keys());
  if (!candidateIds.length) return 0;
  const stored: StoredImportCell[] = [];
  for (let i = 0; i < candidateIds.length; i += 100) {
    const chunk = candidateIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("attendance_entries")
        .select("id, candidate_id, designation_id, shift_hours, is_reliever, entry_date" as never)
        .eq("unit_id", opts.unitId)
        .in("candidate_id", chunk)
        .gte("entry_date", opts.periodStart)
        .lte("entry_date", opts.periodEnd)
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      const rows = (data ?? []) as unknown as StoredImportCell[];
      stored.push(...rows);
      if (rows.length < 1000) break;
    }
  }
  const ids = staleEntryIdsAfterImport(stored, opts.written, opts.coveredDates);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from("attendance_entries")
      .delete()
      .in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
  return ids.length;
}
