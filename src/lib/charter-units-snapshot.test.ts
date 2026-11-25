import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return {
    store,
    rpc: vi.fn(),
    active: vi.fn(),
  };
});

vi.mock("./active-clients", () => ({ fetchActiveClientIds: mocks.active }));
vi.mock("@/lib/supabase-ready", () => ({ supabaseSessionReady: async () => true }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "user-a" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

import {
  fetchCharterUnits,
  fetchCharterUnitsLite,
  filterCharterUnitsBySearch,
  isMissingRpcSignature,
  pickActiveEmployees,
  unitIdsKey,
} from "./charter-units";

const row = {
  id: "U1",
  customer_id: "C1",
  active_employee_count: 2,
  guard_count: 3,
  security_guards: [{ id: "g1", name: "Guard Name" }],
};

describe("charter roster fetch", () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.rpc.mockReset();
    mocks.active.mockReset();
    mocks.active.mockResolvedValue(new Set(["U1"]));
    mocks.rpc.mockResolvedValue({ error: null, data: { units: [row], active_employees: 2 } });
  });

  it("writes nothing to browser storage and removes legacy snapshots", async () => {
    mocks.store.set("radiant:charter-units:v3-active", "[]");
    mocks.store.set("radiant:charter-units:v4:user-b", "[]");
    mocks.store.set("unrelated", "keep");
    await fetchCharterUnits();
    expect(Array.from(mocks.store.keys())).toEqual(["unrelated"]);
  });

  it("starts the roster RPC without waiting for the active-client read", async () => {
    let release!: (ids: Set<string>) => void;
    mocks.active.mockReturnValue(new Promise<Set<string>>((r) => (release = r)));
    const pending = fetchCharterUnits();
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    release(new Set(["U1"]));
    await pending;
  });

  it("asks for lite rows and keeps the distinct server total", async () => {
    const result = await fetchCharterUnitsLite();
    expect(mocks.rpc).toHaveBeenCalledWith("get_attendance_charter_units", { p_lite: true });
    expect(result.lite).toBe(true);
    expect(result.activeEmployeesDistinct).toBe(2);
    expect(result.summary.activeEmployees).toBe(2);
    expect(result.units[0].guard_count).toBe(3);
  });

  it("does not trust the server total once inactive rows are dropped", async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: { units: [row, { ...row, id: "U2", active_employee_count: 5 }], active_employees: 6 },
    });
    const result = await fetchCharterUnits();
    expect(result.units.map((u) => u.id)).toEqual(["U1"]);
    expect(result.activeEmployeesDistinct).toBeNull();
  });

  it("falls back to the zero-argument call on an older database", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ error: { code: "PGRST202", message: "Could not find the function" }, data: null })
      .mockResolvedValueOnce({ error: null, data: { units: [row] } });
    const result = await fetchCharterUnitsLite();
    expect(mocks.rpc).toHaveBeenLastCalledWith("get_attendance_charter_units");
    expect(result.lite).toBe(false);
    expect(result.activeEmployeesDistinct).toBeNull();
  });

  it("surfaces other RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("down"), data: null });
    await expect(fetchCharterUnits()).rejects.toThrow("down");
  });
});

describe("active employee tile value", () => {
  const units = [
    { id: "a", active_employee_count: 4 },
    { id: "b", active_employee_count: 3 },
  ];
  it("uses the payload's distinct total when every unit is shown", () => {
    expect(pickActiveEmployees(units, { units, activeEmployeesDistinct: 5 }, undefined)).toBe(5);
  });
  it("uses the subset total when only some units are shown", () => {
    const all = [...units, { id: "c", active_employee_count: 9 }];
    expect(pickActiveEmployees(units, { units: all, activeEmployeesDistinct: 12 }, 6)).toBe(6);
  });
  it("falls back to the per-unit sum without a distinct figure", () => {
    expect(pickActiveEmployees(units, { units, activeEmployeesDistinct: null }, null)).toBe(7);
  });
});

describe("register search", () => {
  const units = [
    { id: "1", name: "Tower A", code: "CLI1", customer_name: "Acme Corp", contract_codes: ["RGS-9"], security_guards: [{ name: "Tarun Kumar Singh" }] },
    { id: "2", name: "Plant B", code: "CLI2", customer_name: "Beta Ltd", contract_codes: [], security_guards: [] },
  ];
  it("matches words in any order, including guard names and contract codes", () => {
    expect(filterCharterUnitsBySearch(units, "singh tarun").map((u) => u.id)).toEqual(["1"]);
    expect(filterCharterUnitsBySearch(units, "rgs-9").map((u) => u.id)).toEqual(["1"]);
    expect(filterCharterUnitsBySearch(units, "BETA plant").map((u) => u.id)).toEqual(["2"]);
    expect(filterCharterUnitsBySearch(units, "  ").length).toBe(2);
  });
});

describe("helpers", () => {
  it("keys id lists independent of order and duplicates", () => {
    expect(unitIdsKey(["b", "a", "a"])).toBe(unitIdsKey(["a", "b"]));
    expect(unitIdsKey(["a", "b"])).not.toBe(unitIdsKey(["a", "c"]));
  });
  it("recognises a missing RPC signature", () => {
    expect(isMissingRpcSignature({ code: "PGRST202" })).toBe(true);
    expect(isMissingRpcSignature({ code: "42501", message: "Not allowed" })).toBe(false);
  });
});
