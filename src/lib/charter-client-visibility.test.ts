import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ active: vi.fn(), rpc: vi.fn() }));
vi.mock("./active-clients", () => ({ fetchActiveClientIds: mocks.active }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
import { fetchCharterUnits, readCharterUnitsSnapshot } from "./charter-units";

describe("shared invoice, attendance and payroll client roster", () => {
  beforeEach(() => {
    mocks.active.mockResolvedValue(new Set(["CLI4249"]));
    mocks.rpc.mockResolvedValue({ error: null, data: { units: [
      { id: "CLI4660", customer_id: "inactive-org", active_employee_count: 3 },
      { id: "CLI4683", customer_id: "inactive-org", active_employee_count: 2 },
      { id: "CLI4249", customer_id: "active-org", active_employee_count: 1 },
    ] } });
  });
  it("excludes both inactive clients even when the roster service returns them", async () => {
    const result = await fetchCharterUnits();
    expect(result.units.map((unit) => unit.id)).toEqual(["CLI4249"]);
    expect(result.summary).toEqual({ units: 1, organizations: 1, activeEmployees: 1 });
  });
  it("does not revive unverified old snapshots on entry", () => {
    expect(readCharterUnitsSnapshot()).toBeNull();
  });
  it("does not show clients when current status cannot be checked", async () => {
    mocks.active.mockRejectedValueOnce(new Error("Status unavailable"));
    await expect(fetchCharterUnits()).rejects.toThrow("Status unavailable");
  });
});