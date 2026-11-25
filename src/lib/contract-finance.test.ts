import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { pickPeriodContract } from "./contract-finance";

describe("registers use the contract governing the viewed period", () => {
  const sep = { start: "2026-09-01", end: "2026-09-30" };
  it("uses the expired September contract for September, not today's active one", () => {
    const c = pickPeriodContract([
      { id: "old", status: "expired", start_date: "2026-04-01", end_date: "2026-09-30", created_at: "1" },
      { id: "new", status: "active", start_date: "2026-10-01", end_date: null, created_at: "2" },
    ], sep);
    expect(c?.id).toBe("old");
  });
  it("prefers the active, newest copy when start dates tie", () => {
    const c = pickPeriodContract([
      { id: "copy", status: "expired", start_date: "2026-04-01", end_date: null, created_at: "3" },
      { id: "live", status: "active", start_date: "2026-04-01", end_date: null, created_at: "1" },
    ], sep);
    expect(c?.id).toBe("live");
  });
});

import { periodContractFilter } from "./contract-finance";

describe("period contract server filter", () => {
  it("keeps every active contract and only period-overlapping expired ones (null dates included)", () => {
    const f = periodContractFilter(new Map([
      ["a", { start: "2026-10-21", end: "2026-11-20" }],
      ["b", { start: "2026-11-01", end: "2026-11-30" }],
    ]));
    expect(f).toBe("status.eq.active,and(status.eq.expired,or(start_date.is.null,start_date.lte.2026-11-30),or(end_date.is.null,end_date.gte.2026-10-21))");
    expect(periodContractFilter()).toBe("status.eq.active");
  });
});
