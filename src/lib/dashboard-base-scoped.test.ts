import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => {
  if (typeof window === "undefined") (globalThis as { window?: unknown }).window = globalThis;
  return {
    tables: {} as Record<string, Row[]>,
    reads: [] as string[],
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    db.reads.push(table);
    const filters: Array<(r: Row) => boolean> = [];
    let range: [number, number] = [0, 999];
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.order = () => b;
    b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
    b.neq = (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b);
    b.in = (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b);
    b.range = (f: number, t: number) => {
      range = [f, t];
      const rows = (db.tables[table] ?? []).filter((r) => filters.every((fn) => fn(r)));
      return Promise.resolve({ data: rows.slice(range[0], range[1] + 1), error: null });
    };
    return b;
  };
  return {
    supabase: {
      from,
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: "u1" } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
});

import { invalidateDashboardBase, loadDashboardBase, loadDashboardBaseForUnits, scopedBaseKey } from "./dashboard-base";
import { computeWorkforceCoverage } from "@/components/WorkforceCoverage";

function seed() {
  db.tables = {
    units: [
      { id: "u-a", name: "Alpha", customer_id: "c1", status: "active" },
      { id: "u-b", name: "Beta", customer_id: "c2", status: "active" },
      { id: "u-c", name: "Closed", customer_id: "c2", status: "inactive" },
    ],
    customers: [
      { id: "c1", name: "Cust 1" },
      { id: "c2", name: "Cust 2" },
    ],
    client_contracts: [
      { id: "k1", contract_code: "K1", unit_id: "u-a", status: "active", record_type: "client" },
      { id: "k2", contract_code: "K2", unit_id: "u-b", status: "active", record_type: "client" },
      { id: "k3", contract_code: "K3", unit_id: "u-c", status: "active", record_type: "client" },
    ],
    contract_resources: [
      { contract_id: "k1", designation_id: "d1", role_key: null, quantity: 3 },
      { contract_id: "k2", designation_id: "d1", role_key: null, quantity: 5 },
    ],
    designations: [{ id: "d1", name: "Guard" }],
    candidates: [
      { id: "p1", designation_id: "d1", role_key: "guard", status: "active", non_billable: false, unit_id: "u-a" },
      // Primary unit is Beta, but also mapped to Alpha through candidate_units.
      { id: "p2", designation_id: "d1", role_key: "guard", status: "active", non_billable: false, unit_id: "u-b" },
      { id: "p3", designation_id: "d1", role_key: "field_officer", status: "active", non_billable: false, unit_id: "u-a" },
      { id: "p4", designation_id: "d1", role_key: "guard", status: "inactive", non_billable: false, unit_id: "u-a" },
    ],
    candidate_units: [
      { candidate_id: "p2", unit_id: "u-a" },
      { candidate_id: "p4", unit_id: "u-a" },
    ],
    attendance_codes: [],
  };
}

describe("scoped dashboard base", () => {
  beforeEach(() => {
    invalidateDashboardBase();
    db.reads = [];
    seed();
  });

  it("gives the same coverage for the requested units as the full load", async () => {
    const full = computeWorkforceCoverage(await loadDashboardBase());
    const scoped = computeWorkforceCoverage(await loadDashboardBaseForUnits(["u-a"]));
    expect(scoped).toEqual(full.filter((row) => row.unitId === "u-a"));
    expect(scoped[0]).toMatchObject({ committed: 3, actual: 2, orgName: "Cust 1" });
  });

  it("returns nothing for inactive or empty unit lists without reading lookups", async () => {
    expect(computeWorkforceCoverage(await loadDashboardBaseForUnits(["u-c"]))).toEqual([]);
    db.reads = [];
    const empty = await loadDashboardBaseForUnits([]);
    expect(empty.contracts).toEqual([]);
    expect(db.reads).toEqual([]);
  });

  it("caches per user and unit set, ignoring order", async () => {
    await loadDashboardBaseForUnits(["u-a", "u-b"]);
    const reads = db.reads.length;
    await loadDashboardBaseForUnits(["u-b", "u-a", "u-a"]);
    expect(db.reads.length).toBe(reads);
    expect(scopedBaseKey("x", ["b", "a"])).toBe(scopedBaseKey("x", ["a", "b", "a"]));
    expect(scopedBaseKey("x", ["a"])).not.toBe(scopedBaseKey("y", ["a"]));
  });
});
