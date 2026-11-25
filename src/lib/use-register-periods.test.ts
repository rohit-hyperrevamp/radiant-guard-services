import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAllPages: vi.fn(),
  fetchForIds: vi.fn(),
}));

vi.mock("@/lib/supabase-batch", () => ({
  fetchAllPages: mocks.fetchAllPages,
  fetchForIds: mocks.fetchForIds,
  runBulk: <T,>(task: () => T) => Promise.resolve(task()),
}));
vi.mock("@/lib/supabase-ready", () => ({
  supabaseSessionReady: async () => true,
  useHasSupabaseSession: () => true,
}));
vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  for (const k of ["from", "select", "gte", "lte", "in", "order", "range"]) builder[k] = () => builder;
  return { supabase: builder };
});

import {
  fetchSavedPeriods,
  PENDING_WINDOWS,
  prefetchSavedPeriods,
  SAVED_PERIODS_SCAN_THRESHOLD,
  unitsOutsideContract,
  windowsPending,
} from "./use-register-periods";

const manyIds = Array.from({ length: SAVED_PERIODS_SCAN_THRESHOLD + 1 }, (_, i) => `u${i}`);

describe("saved period prefetch", () => {
  beforeEach(() => {
    mocks.fetchAllPages.mockReset();
    mocks.fetchForIds.mockReset();
    mocks.fetchForIds.mockResolvedValue([]);
  });

  it("reuses the month scan started before unit ids were known, once", async () => {
    mocks.fetchAllPages.mockResolvedValue([
      { unit_id: "u1", period_start: "2026-10-26", period_end: "2026-11-25" },
      { unit_id: "other", period_start: "2026-11-01", period_end: "2026-11-30" },
    ]);
    prefetchSavedPeriods(2026, 10);
    const rows = await fetchSavedPeriods(manyIds, 2026, 10);
    expect(rows.map((r) => r.unit_id)).toEqual(["u1"]);
    expect(mocks.fetchForIds).not.toHaveBeenCalled();
    // A later refetch reads fresh.
    await fetchSavedPeriods(manyIds, 2026, 10);
    expect(mocks.fetchForIds).toHaveBeenCalledTimes(1);
  });

  it("ignores the prefetch for a small id list (chunked reads)", async () => {
    mocks.fetchAllPages.mockResolvedValue([]);
    prefetchSavedPeriods(2026, 9);
    await fetchSavedPeriods(["u1"], 2026, 9);
    expect(mocks.fetchForIds).toHaveBeenCalledTimes(1);
  });
});

describe("pending payroll windows marker", () => {
  it("is recognised only by identity and behaves as an empty map", () => {
    expect(windowsPending(PENDING_WINDOWS)).toBe(true);
    expect(windowsPending(new Map())).toBe(false);
    expect(PENDING_WINDOWS.size).toBe(0);
  });
});

describe("unitsOutsideContract", () => {
  const aug = { start: "2026-08-21", end: "2026-09-20" };

  it("drops a site whose only contract starts after the viewed window (CLI4792 BALDA, CON16350 from 25 Sep)", () => {
    const out = unitsOutsideContract(new Map([["balda", aug]]), [{ unit_id: "balda", start_date: "2026-09-25", end_date: "2027-03-20" }]);
    expect([...out]).toEqual(["balda"]);
  });

  it("keeps a site when any active or expired contract overlaps its window", () => {
    const out = unitsOutsideContract(new Map([["s", aug]]), [
      { unit_id: "s", start_date: "2026-09-25", end_date: null },
      { unit_id: "s", start_date: "2026-04-01", end_date: "2026-09-24" },
    ]);
    expect(out.size).toBe(0);
  });

  it("keeps a contract that starts on the window's last day", () => {
    expect(unitsOutsideContract(new Map([["s", aug]]), [{ unit_id: "s", start_date: "2026-09-20", end_date: null }]).size).toBe(0);
  });

  it("never hides a site whose contracts could not be read", () => {
    expect(unitsOutsideContract(new Map([["s", aug]]), []).size).toBe(0);
  });
});
