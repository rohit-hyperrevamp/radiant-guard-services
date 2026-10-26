import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { resolveGuardsForUnit, type EmployeeLite } from "./deployment";
import { fetchAllPages } from "./supabase-batch";

describe("complete client deployment directory", () => {
  it("keeps employee 28199 mapped to CLI4316 even beyond the first 1000 employees", async () => {
    const people: EmployeeLite[] = Array.from({ length: 1001 }, (_, i) => ({
      id: `person-${i}`, full_name: `Person ${i}`, employee_code: String(i),
      photo_url: "", role_key: "guard", unit_id: null, reports_to: null,
      is_enabled: true, status: "active",
    }));
    people[1000] = { ...people[1000], employee_code: "28199", full_name: "Satheesh Kumar" };
    const ranges: number[][] = [];
    const loaded = await fetchAllPages<EmployeeLite>(async (from, to) => {
      ranges.push([from, to]);
      return { data: people.slice(from, to + 1), error: null };
    });
    const guards = resolveGuardsForUnit(
      { id: "CLI4316", branch_id: null, customer_id: null, state_name: "Karnataka" },
      loaded, [], [{ candidate_id: "person-1000", unit_id: "CLI4316", is_primary: true }],
    );
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(guards.map((g) => g.employee_code)).toEqual(["28199"]);
  });
});