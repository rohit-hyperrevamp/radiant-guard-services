import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";

import {
  isNonBillableRoleKey,
  matchesAttendanceScope,
  type AttendanceScopeAssignment,
  type AttendanceUnitContext,
} from "@/lib/attendance";

/**
 * Shared unit roster used by the Attendance / Invoice / Payroll charters.
 * All three surfaces browse the same list of units with active contracts and
 * billable deployed employees, so the fetch lives here once.
 */

export type EmployeeRef = { id: string; name: string };

export type ClientEmployee = {
  id: string;
  name: string;
  designation: string;
  unit_id: string;
  unit_name: string;
  unit_code: string;
};

export type CharterUnitRow = {
  id: string;
  code: string;
  name: string;
  location: string;
  branch_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  billing_state: string | null;
  contract_codes: string[];
  contract_end: string | null;
  active_employee_count: number;
  security_guards: EmployeeRef[];
};

export type CharterPageData = {
  units: CharterUnitRow[];
  organizations: { id: string; name: string; code: string }[];
  employeesByCustomer: Record<string, ClientEmployee[]>;
  summary: { organizations: number; units: number; activeEmployees: number };
};

const ACTIVE_EMPLOYEE_STATUSES = ["active"] as const;

export const CHARTER_UNITS_QK = ["charter-units-v1"] as const;

export async function fetchCharterUnits(): Promise<CharterPageData> {
  type UnitRow = {
    id: string;
    code: string;
    name: string;
    location: string | null;
    branch_id: string | null;
    customer_id: string | null;
    billing_state: string | null;
  };
  type CandidateRow = {
    id: string;
    full_name: string;
    designation_id: string | null;
    role_key: string | null;
    unit_id: string | null;
  };

  // One paginated read per table, all in parallel. Filtering by big id lists
  // (`.in(...)` with hundreds of uuids) meant dozens of sequential round
  // trips; the tables involved are small enough to pull once and join in
  // memory, which is what made every charter page slow to appear.
  const [
    contracts,
    allUnits,
    allCandidates,
    candidateLinks,
    scopeAssignments,
    allDesignations,
    allCustomers,
  ] = await Promise.all([
    fetchAllPages<{ unit_id: string | null; contract_code: string | null; end_date: string | null }>(
      (from, to) =>
        supabase
          .from("client_contracts")
          .select("unit_id, contract_code, end_date")
          .eq("status", "active")
          .order("unit_id", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages<UnitRow>((from, to) =>
      supabase
        .from("units")
        .select("id, code, name, location, branch_id, customer_id, billing_state")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<CandidateRow & { non_billable: boolean | null }>((from, to) =>
      supabase
        .from("candidates")
        .select("id, full_name, designation_id, role_key, unit_id, non_billable")
        .eq("is_enabled", true)
        .in("status", [...ACTIVE_EMPLOYEE_STATUSES])
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<{ candidate_id: string; unit_id: string }>((from, to) =>
      supabase
        .from("candidate_units")
        .select("candidate_id, unit_id")
        .order("candidate_id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<AttendanceScopeAssignment>((from, to) =>
      supabase
        .from("employee_scope_assignments")
        .select("candidate_id, scope_type, scope_id")
        .range(from, to),
    ),
    fetchAllPages<{ id: string; name: string }>((from, to) =>
      supabase.from("designations").select("id, name").order("id", { ascending: true }).range(from, to),
    ),
    fetchAllPages<{ id: string; name: string; code: string | null }>((from, to) =>
      supabase.from("customers").select("id, name, code").order("id", { ascending: true }).range(from, to),
    ),
  ]);

  const contractsByUnit = new Map<string, { codes: string[]; end: string | null }>();
  for (const c of contracts) {
    if (!c.unit_id) continue;
    const cur = contractsByUnit.get(c.unit_id) ?? { codes: [], end: null };
    if (c.contract_code) cur.codes.push(c.contract_code);
    if (!cur.end || (c.end_date && c.end_date > cur.end)) cur.end = c.end_date;
    contractsByUnit.set(c.unit_id, cur);
  }

  const unitIdSet = new Set<string>(contractsByUnit.keys());
  for (const row of allCandidates) {
    if (row.unit_id) unitIdSet.add(row.unit_id);
  }

  const unitIds = Array.from(unitIdSet);
  if (unitIds.length === 0) {
    return {
      units: [],
      organizations: [],
      employeesByCustomer: {},
      summary: { organizations: 0, units: 0, activeEmployees: 0 },
    };
  }

  const units = allUnits.filter((u) => unitIdSet.has(u.id));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  const billableCandidates = allCandidates.filter((c) => c.non_billable !== true);
  const candidatesById = new Map(billableCandidates.map((c) => [c.id, c]));
  const primaryCandidates = billableCandidates.filter((c) => c.unit_id && unitIdSet.has(c.unit_id));

  const scopeAssignmentRows = (scopeAssignments ?? []) as AttendanceScopeAssignment[];
  const secondaryMap = candidatesById;

  // Resolve each scope assignment to the units it covers, once.
  const unitContexts: AttendanceUnitContext[] = units.map((unit) => ({
    id: unit.id,
    branch_id: unit.branch_id,
    customer_id: unit.customer_id,
    billing_state: unit.billing_state,
  }));
  const scopeUnitsByAssignment = new Map<AttendanceScopeAssignment, string[]>();
  for (const assignment of scopeAssignmentRows) {
    if (!candidatesById.has(assignment.candidate_id)) continue;
    const matched = unitContexts
      .filter((context) => matchesAttendanceScope(context, assignment))
      .map((context) => context.id);
    if (matched.length) scopeUnitsByAssignment.set(assignment, matched);
  }

  const dMap = new Map(allDesignations.map((d) => [d.id, d.name as string]));
  const customerMap = new Map(
    allCustomers.map((c) => [c.id, { name: c.name as string, code: (c.code as string) || "" }]),
  );



  type UnitAcc = {
    employees: Map<string, { name: string; designation: string; roleKey: string | null }>;
  };
  const acc = new Map<string, UnitAcc>();
  const ensure = (unitId: string) => {
    if (!acc.has(unitId)) acc.set(unitId, { employees: new Map() });
    return acc.get(unitId)!;
  };

  for (const c of primaryCandidates ?? []) {
    if (!c.unit_id) continue;
    ensure(c.unit_id).employees.set(c.id, {
      name: c.full_name || "—",
      designation: (c.designation_id && dMap.get(c.designation_id)) || "",
      roleKey: c.role_key || null,
    });
  }
  for (const link of candidateLinks ?? []) {
    const cand = secondaryMap.get(link.candidate_id);
    if (!cand) continue;
    ensure(link.unit_id).employees.set(cand.id, {
      name: cand.full_name || "—",
      designation: (cand.designation_id && dMap.get(cand.designation_id)) || "",
      roleKey: cand.role_key || null,
    });
  }
  for (const [assignment, matchedUnitIds] of scopeUnitsByAssignment) {
    const cand = secondaryMap.get(assignment.candidate_id);
    if (!cand) continue;
    for (const unitId of matchedUnitIds) {
      ensure(unitId).employees.set(cand.id, {
        name: cand.full_name || "—",
        designation: (cand.designation_id && dMap.get(cand.designation_id)) || "",
        roleKey: cand.role_key || null,
      });
    }
  }


  const rows: CharterUnitRow[] = (units ?? [])
    .map((u) => {
      const a = acc.get(u.id);
      const employees = a ? Array.from(a.employees.entries()) : [];
      const sgs: EmployeeRef[] = [];
      for (const [id, info] of employees) {
        if (isNonBillableRoleKey(info.roleKey)) continue;
        sgs.push({ id, name: info.name });
      }

      return {
        id: u.id,
        code: u.code,
        name: u.name,
        location: u.location || "",
        branch_id: u.branch_id || null,
        customer_id: u.customer_id || "",
        customer_name: (u.customer_id && customerMap.get(u.customer_id)?.name) || "—",
        customer_code: (u.customer_id && customerMap.get(u.customer_id)?.code) || "",
        billing_state: u.billing_state || null,
        contract_codes: contractsByUnit.get(u.id)?.codes ?? [],
        contract_end: contractsByUnit.get(u.id)?.end ?? null,
        active_employee_count: sgs.length,
        security_guards: sgs.sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) =>
      a.customer_name !== b.customer_name
        ? a.customer_name.localeCompare(b.customer_name)
        : (a.name || a.code).localeCompare(b.name || b.code),
    );

  const orgs = Array.from(
    new Map(
      rows.map((r) => [
        r.customer_id || r.customer_name,
        { id: r.customer_id || r.customer_name, name: r.customer_name, code: r.customer_code },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const employeesByCustomer: Record<string, ClientEmployee[]> = {};
  for (const r of rows) {
    for (const sg of r.security_guards) {
      const key = r.customer_id || r.customer_name;
      if (!employeesByCustomer[key]) employeesByCustomer[key] = [];
      if (!employeesByCustomer[key].some((e) => e.id === sg.id && e.unit_id === r.id)) {
        employeesByCustomer[key].push({
          id: sg.id,
          name: sg.name,
          designation: "",
          unit_id: r.id,
          unit_name: r.name || r.code,
          unit_code: r.code,
        });
      }
    }
  }
  for (const key of Object.keys(employeesByCustomer)) {
    employeesByCustomer[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    units: rows,
    organizations: orgs,
    employeesByCustomer,
    summary: {
      organizations: orgs.length,
      units: rows.length,
      activeEmployees: rows.reduce((s, r) => s + r.active_employee_count, 0),
    },
  };
}
