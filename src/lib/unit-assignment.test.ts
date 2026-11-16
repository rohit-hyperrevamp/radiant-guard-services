import { describe, expect, it } from "vitest";
import { assignmentSearchEmployees, matchesMappingUnit, selectMatchingUnits, type MappingEmployee } from "./unit-assignment";

const employees: MappingEmployee[] = [
  { id: "fo", full_name: "Field Officer One", employee_code: "101", mobile: "9876543210", role_key: "field_officer", reports_to: "om" },
  { id: "om", full_name: "Operation Manager One", employee_code: "102", mobile: null, role_key: "operations_manager", reports_to: null },
  { id: "other", full_name: "Other Manager", employee_code: "103", mobile: null, role_key: "operations_manager", reports_to: null },
];
const unit = { id: "site", code: "CLI100", name: "Pune East", customer_id: "client", operations_manager_id: null };

describe("unit mapping selection", () => {
  it("finds a field officer's sites by their operations manager's name", () => {
    const people = assignmentSearchEmployees(["fo"], employees);
    expect(matchesMappingUnit("one operation", unit, "Client One", people)).toBe(true);
    expect(matchesMappingUnit("other manager", unit, "Client One", people)).toBe(false);
  });
  it("searches site and client names in any word order", () => {
    expect(matchesMappingUnit("east client", unit, "Client One", [])).toBe(true);
    expect(matchesMappingUnit("Mumbai", unit, "Client One", [])).toBe(false);
  });
  it("selects all matching sites beyond the 25-row page without selecting other sites", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `site-${i}`);
    const selected = selectMatchingUnits(new Set(), ids, true);
    expect(selected.size).toBe(60);
    expect(selected.has("site-59")).toBe(true);
    expect(selected.has("unmatched")).toBe(false);
  });
  it("allows two individual selections and preserves them when another result is deselected", () => {
    const selected = selectMatchingUnits(new Set(["first"]), ["second"], true);
    expect([...selected]).toEqual(["first", "second"]);
    expect([...selectMatchingUnits(selected, ["second"], false)]).toEqual(["first"]);
  });
  it("terminates safely when a reporting chain is cyclic", () => {
    expect(assignmentSearchEmployees(["fo"], employees.map((e) => e.id === "om" ? { ...e, reports_to: "fo" } : e)).map((e) => e.id)).toEqual(["fo", "om"]);
  });
});