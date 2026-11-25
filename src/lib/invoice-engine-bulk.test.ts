import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { loadInvoiceUnitsBulk } from "./invoice-engine-bulk";

/** Chainable Supabase query stub that resolves to `result` when awaited. */
function chain(result: unknown): unknown {
  const proxy: unknown = new Proxy(function () {}, {
    get(_t, key) {
      if (key === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

describe("bulk invoice contract flags (review I5)", () => {
  it("reads WO-as-Present / exact day rate from the period contract, not today's active one", async () => {
    const payload = {
      site: [{ id: "u1", code: "CLI1", name: "Site", billing_state: "Maharashtra" }],
      contracts: [
        { id: "old", unit_id: "u1", status: "expired", start_date: "2026-04-01", end_date: "2026-09-30", created_at: "2026-04-01", wo_as_present: true, exact_day_rate: true },
        { id: "new", unit_id: "u1", status: "active", start_date: "2026-10-01", end_date: null, created_at: "2026-10-01", wo_as_present: false, exact_day_rate: false },
      ],
      primary: [], scopes: [], extras: [], links: [], people: [], units: [],
    };
    const db = {
      from: () => chain({ data: [], error: null }),
      rpc: (fn: string) => Promise.resolve(fn === "invoice_period_entries" ? { data: payload, error: null } : { data: [], error: null }),
    };
    const sept = await loadInvoiceUnitsBulk(new Map([["u1", { start: "2026-09-01", end: "2026-09-30" }]]), db as never);
    expect(sept.units.get("u1")?.data.periodContract?.id).toBe("old");
    expect(sept.units.get("u1")?.data.woAsPresent).toBe(true);
    expect(sept.units.get("u1")?.data.exactDayRate).toBe(true);
    const oct = await loadInvoiceUnitsBulk(new Map([["u1", { start: "2026-10-01", end: "2026-10-31" }]]), db as never);
    expect(oct.units.get("u1")?.data.woAsPresent).toBe(false);
  });
});
