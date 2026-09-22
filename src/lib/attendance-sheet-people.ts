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

async function findByCodes(codes: string[]): Promise<CandidateRow | null> {
  if (!codes.length) return null;
  for (const column of ["employee_code", "candidate_code"] as const) {
    const { data } = await supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .in(column, codes)
      .limit(2);
    const rows = (data ?? []) as CandidateRow[];
    if (rows.length === 1) return rows[0];
    if (rows.length > 1) return rows[0];
  }
  return null;
}

async function findByName(names: string[]): Promise<CandidateRow | null> {
  for (const name of names) {
    const { data } = await supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .ilike("full_name", name)
      .limit(2);
    const rows = (data ?? []) as CandidateRow[];
    // Only trust a name when it is unambiguous company-wide.
    if (rows.length === 1) return rows[0];
  }
  return null;
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

/** Keep exactly one primary posting: this unit. */
async function demoteOtherPrimaries(candidateId: string, unitId: string) {
  await supabase
    .from("candidate_units")
    .update({ is_primary: false } as never)
    .eq("candidate_id", candidateId)
    .eq("is_primary", true)
    .neq("unit_id", unitId);
}


export async function resolveSheetPersonForUnit(opts: {
  unitId: string;
  contractId: string | null;
  ref: SheetPersonRef;
  /** Joining / application date used when an employee has to be created. */
  joiningDate: string;
  createdBy?: string | null;
}): Promise<ResolvedSheetPerson | null> {
  const { unitId, contractId, ref, joiningDate, createdBy } = opts;
  const tokens = cleanTokens([...ref.codeTokens, ...ref.nameTokens]);
  const codes = tokens.filter(looksLikeCode);
  const names = tokens.filter(looksLikeName).sort((a, b) => b.length - a.length);

  let found = await findByCodes(codes);
  if (!found) found = await findByName(names);

  if (found) {
    const mapping = await ensureAttendanceUnitMapping(
      found.id,
      unitId,
      ref.designationId ?? found.designation_id ?? null,
      ref.isReliever === true,
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
