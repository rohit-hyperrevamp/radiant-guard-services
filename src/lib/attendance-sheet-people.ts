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
 *   3. map the employee to this unit (so the unit's muster shows them),
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
 * Make sure the employee is mapped as a regular resource at this unit so both
 * the muster and the database attendance guard accept the uploaded marks. An
 * uploaded monthly muster is authoritative evidence that this is not merely an
 * extra-duty reliever posting. A new mapping becomes primary only when the
 * person has no primary posting anywhere yet.
 */
export async function ensureAttendanceUnitMapping(
  candidateId: string,
  unitId: string,
  designationId: string | null,
): Promise<AttendanceUnitMapping> {
  const { data: existing } = await supabase
    .from("candidate_units")
    .select("id, designation_id, is_primary, is_reliever")
    .eq("candidate_id", candidateId)
    .eq("unit_id", unitId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = existing as {
      id: string;
      designation_id: string | null;
      is_primary: boolean;
      is_reliever: boolean | null;
    };
    const nextDesignation = designationId ?? row.designation_id;
    if (nextDesignation !== row.designation_id) {
      const { error } = await supabase
        .from("candidate_units")
        .update({
          designation_id: nextDesignation,
        })
        .eq("id", row.id);
      if (error) throw new Error(`Could not map employee for attendance: ${error.message}`);
    }
    return {
      mapped: false,
      isPrimary: row.is_primary,
      isReliever: !row.is_primary || row.is_reliever === true,
    };
  }

  const { data: primaries } = await supabase
    .from("candidate_units")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("is_primary", true)
    .limit(1);
  const hasPrimary = (primaries ?? []).length > 0;

  // A guard already posted primarily elsewhere is a reliever here. Do not add
  // a unit mapping: reliever attendance is saved as Extra Duty by the caller,
  // while the employee's one-and-only primary posting remains untouched.
  if (hasPrimary) {
    return { mapped: false, isPrimary: false, isReliever: true };
  }

  const { error } = await supabase.from("candidate_units").insert({
    candidate_id: candidateId,
    unit_id: unitId,
    designation_id: designationId,
    is_primary: true,
    is_reliever: false,
    sort_order: 0,
  } as never);
  if (error) throw new Error(error.message);
  return { mapped: true, isPrimary: true, isReliever: false };
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
    unit_id: unitId,
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
  const mapping = await ensureAttendanceUnitMapping(candidateId, unitId, ref.designationId);

  return {
    candidateId,
    designationId: ref.designationId,
    name,
    employeeCode: (created as { employee_code: string | null }).employee_code ?? employeeCode,
    created: true,
    ...mapping,
  };
}
