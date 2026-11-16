import { matchesSearch } from "@/lib/search-match";

export type MappingEmployee = {
  id: string; full_name: string | null; employee_code: string | null;
  mobile: string | null; role_key: string | null; reports_to: string | null;
};
export type MappingUnit = {
  id: string; code: string | null; name: string | null; customer_id: string | null;
  operations_manager_id: string | null;
};
export type AssignmentKind = "field_officer" | "operations_manager";
export type AssignmentMode = "add" | "replace";

/** Include reporting ancestors for search without changing anyone's assignments. */
export function assignmentSearchEmployees(ids: string[], employees: MappingEmployee[]): MappingEmployee[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const seen = new Set<string>();
  for (const id of ids) {
    let current: string | null = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      current = byId.get(current)?.reports_to ?? null;
    }
  }
  return employees.filter((e) => seen.has(e.id));
}

export function matchesMappingUnit(query: string, unit: MappingUnit, customer: string, employees: MappingEmployee[]): boolean {
  return matchesSearch(query, [unit.code, unit.name, customer, ...employees.flatMap((e) => [e.full_name, e.employee_code, e.mobile])]);
}

export function selectMatchingUnits(previous: Set<string>, ids: string[], checked: boolean): Set<string> {
  const next = new Set(previous);
  for (const id of ids) checked ? next.add(id) : next.delete(id);
  return next;
}