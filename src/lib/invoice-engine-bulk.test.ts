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

import { enableSharedReadsForTest, fetchPeriodInputs, sharedRead } from "./invoice-engine-bulk";

describe("invoice and payroll engines share identical bulk reads", () => {
  it("one request for concurrent identical reads, each caller gets its own copy", async () => {
    enableSharedReadsForTest(true);
    try {
      let calls = 0;
      const payload = {
        site: [{ id: "u1", code: "C1" }], contracts: [], primary: [["c1", "u1", "E1", "A", null, null, false, null]],
        scopes: [], extras: [], links: [], people: [], c: [], d: [], units: [],
      };
      const db = { rpc: () => { calls++; return new Promise((r) => setTimeout(() => r({ data: payload, error: null }), 5)); } };
      const periods = new Map([["u1", { start: "2026-10-01", end: "2026-10-31" }]]);
      const [a, b] = await Promise.all([fetchPeriodInputs(periods, db as never), fetchPeriodInputs(periods, db as never)]);
      expect(calls).toBe(1);
      expect(a.sites).toEqual(b.sites);
      a.sites[0].code = "changed";
      expect(b.sites[0].code).toBe("C1");
      // Different periods are a different read.
      await fetchPeriodInputs(new Map([["u1", { start: "2026-09-01", end: "2026-09-30" }]]), db as never);
      expect(calls).toBe(2);
    } finally {
      enableSharedReadsForTest(false);
    }
  });

  it("a failed read is not reused", async () => {
    enableSharedReadsForTest(true);
    try {
      const db = {};
      let n = 0;
      await expect(sharedRead(db, "k", () => { n++; return Promise.reject(new Error("down")); })).rejects.toThrow("down");
      await expect(sharedRead(db, "k", () => { n++; return Promise.resolve(1); })).resolves.toBe(1);
      expect(n).toBe(2);
    } finally {
      enableSharedReadsForTest(false);
    }
  });
});
