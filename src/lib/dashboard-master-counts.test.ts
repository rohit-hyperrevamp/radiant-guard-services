import { describe, expect, it } from "vitest";
import { computeDashboardMasterCounts, parseMasterCountsPayload, type MasterPersonRow, type MasterSourceRows } from "./dashboard-master-counts";

/**
 * Parity fixtures for public.dashboard_master_counts
 * (db/prod-migrations/20261126002000_dashboard_master_counts.sql).
 * Each case names the SQL clause that reproduces the browser rule, so a change
 * to either side has to be made in both.
 */
const person = (over: Partial<MasterPersonRow> & { id: string }): MasterPersonRow => ({
  unit_id: "u1", mobile: null, employee_code: null, status: "active", is_enabled: true,
  approved_at: null, created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00", ...over,
});
const base = (over: Partial<MasterSourceRows> = {}): MasterSourceRows => ({
  units: [{ id: "u1", customer_id: "c1" }, { id: "u2", customer_id: "c2" }, { id: "u3", customer_id: "c1" }],
  customers: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
  contracts: [],
  people: [],
  rehires: [],
  ...over,
});
const TODAY = "2026-11-25";

describe("dashboard master counts (JS rule == SQL dashboard_master_counts)", () => {
  it("units/orgs: active rows; scope keeps visible units and their customers (vu CTE + EXISTS on customers)", () => {
    expect(computeDashboardMasterCounts(base(), undefined, TODAY)).toMatchObject({ units: 3, orgs: 3 });
    expect(computeDashboardMasterCounts(base(), new Set(["u1", "u3"]), TODAY)).toMatchObject({ units: 2, orgs: 1 });
    // Empty scope array => nothing visible (p_scope = '{}' makes every = ANY false).
    expect(computeDashboardMasterCounts(base(), new Set(), TODAY)).toMatchObject({ units: 0, orgs: 0, employees: 0 });
  });

  it("groups by trimmed mobile, falling back to id (coalesce(nullif(trim(mobile),''), id))", () => {
    const people = [
      person({ id: "a", mobile: " 9876500000 ", employee_code: "RS10" }),
      person({ id: "b", mobile: "9876500000", employee_code: "RS11" }),
      person({ id: "c", mobile: "   " }),
      person({ id: "d", mobile: null }),
    ];
    expect(computeDashboardMasterCounts(base({ people }), undefined, TODAY).employees).toBe(3);
  });

  it("best row: enabled first, then trailing employee-code digits, then approved/created/updated, then id (DISTINCT ON order)", () => {
    // Disabled newer code loses to enabled older code => group counts (enabled).
    let people = [person({ id: "a", mobile: "1", employee_code: "RS99", is_enabled: false }), person({ id: "b", mobile: "1", employee_code: "RS1" })];
    expect(computeDashboardMasterCounts(base({ people }), undefined, TODAY).employees).toBe(1);
    // Higher trailing number wins even when its unit is out of scope => group not counted in scope.
    people = [person({ id: "a", mobile: "1", employee_code: "RS2", unit_id: "u1" }), person({ id: "b", mobile: "1", employee_code: "X10", unit_id: "u2" })];
    expect(computeDashboardMasterCounts(base({ people }), new Set(["u1"]), TODAY).employees).toBe(0);
    // Equal codes: later approved_at wins (coalesce(approved_at, created_at, updated_at) DESC).
    people = [
      person({ id: "a", mobile: "1", employee_code: "7", approved_at: "2026-03-01T00:00:00+00:00", unit_id: "u1" }),
      person({ id: "b", mobile: "1", employee_code: "007", approved_at: null, created_at: "2026-02-01T00:00:00+00:00", unit_id: "u2" }),
    ];
    expect(computeDashboardMasterCounts(base({ people }), new Set(["u1"]), TODAY).employees).toBe(1);
    // Full tie: larger id wins (id::text COLLATE "C" DESC).
    people = [person({ id: "aaa", mobile: "1", unit_id: "u1" }), person({ id: "bbb", mobile: "1", unit_id: "u2" })];
    expect(computeDashboardMasterCounts(base({ people }), new Set(["u2"]), TODAY).employees).toBe(1);
    expect(computeDashboardMasterCounts(base({ people }), new Set(["u1"]), TODAY).employees).toBe(0);
  });

  it("only active/approved rows compete; group with none is dropped (WHERE status IN ('active','approved'))", () => {
    const people = [person({ id: "a", mobile: "1", status: "pending" }), person({ id: "b", mobile: "2", status: "approved" })];
    expect(computeDashboardMasterCounts(base({ people }), undefined, TODAY).employees).toBe(1);
  });

  it("excludes disabled best rows, pending rehires and unscoped/null units (emp CTE)", () => {
    const people = [
      person({ id: "a", is_enabled: false }),
      person({ id: "b" }),
      person({ id: "c" }),
      person({ id: "d", unit_id: null }),
    ];
    const rehires = [{ previous_candidate_id: "b", new_candidate_id: null }, { previous_candidate_id: null, new_candidate_id: "x" }];
    expect(computeDashboardMasterCounts(base({ people, rehires }), undefined, TODAY).employees).toBe(2);
    expect(computeDashboardMasterCounts(base({ people, rehires }), new Set(["u1"]), TODAY).employees).toBe(1);
  });

  it("contracts: unit null or active, in scope, end_date null or >= today; expiring within 60 days ordered by end_date (ac CTE)", () => {
    const contracts = [
      { id: "k1", contract_code: "C1", unit_id: "u1", status: "active", end_date: null },
      { id: "k2", contract_code: "C2", unit_id: "u1", status: "active", end_date: "2026-11-24" }, // expired yesterday
      { id: "k3", contract_code: "C3", unit_id: "u2", status: "active", end_date: "2027-01-24" }, // today + 60
      { id: "k4", contract_code: "C4", unit_id: "u1", status: "active", end_date: "2026-11-25" }, // today
      { id: "k5", contract_code: "C5", unit_id: "gone", status: "active", end_date: "2026-12-01" }, // inactive unit
      { id: "k6", contract_code: "C6", unit_id: null, status: "active", end_date: "2026-12-10" },
      { id: "k7", contract_code: "C7", unit_id: "u3", status: "active", end_date: "2027-01-25" }, // beyond horizon
    ];
    const all = computeDashboardMasterCounts(base({ contracts }), undefined, TODAY);
    expect(all.contractsActive).toBe(5);
    expect(all.contractsExpiring.map(c => c.id)).toEqual(["k4", "k6", "k3"]);
    expect(all.contractsExpiring[1].unit_id).toBe("");
    const scoped = computeDashboardMasterCounts(base({ contracts }), new Set(["u1"]), TODAY);
    expect(scoped.contractsActive).toBe(2);
    expect(scoped.contractsExpiring.map(c => c.id)).toEqual(["k4"]);
  });

  it("parses the RPC payload into the same client shape", () => {
    expect(parseMasterCountsPayload(null)).toBeNull();
    expect(parseMasterCountsPayload({ foo: 1 })).toBeNull();
    expect(parseMasterCountsPayload({ orgs: 2, units: "3", employees: 10, contractsActive: 1, contractsExpiring: [{ id: "k", contract_code: "C", unit_id: "", status: "active", end_date: "2026-12-01" }] }))
      .toEqual({ orgs: 2, units: 3, employees: 10, contractsActive: 1, contractsExpiring: [{ id: "k", contract_code: "C", unit_id: "", status: "active", end_date: "2026-12-01" }] });
  });
});
