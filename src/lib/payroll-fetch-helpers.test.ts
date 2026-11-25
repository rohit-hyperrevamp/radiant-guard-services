import { describe, expect, it } from "vitest";
import { fetchAllPages, fetchAllPagesParallel } from "./supabase-batch";
import { splitEmbeddedRevisions, takePayrollPrefetch, type PrefetchSlot } from "./payroll-engine";

const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

/** Fake ordered query over `rows`; records each requested range. */
function fakeQuery(rows: { id: number }[], opts: { count?: boolean } = {}) {
  const calls: [number, number, boolean][] = [];
  const build = (from: number, to: number, first = false) => {
    calls.push([from, to, first]);
    return Promise.resolve({
      data: rows.slice(from, to + 1),
      error: null,
      count: first && opts.count !== false ? rows.length : null,
    });
  };
  return { build, calls };
}

describe("fetchAllPagesParallel", () => {
  for (const n of [0, 1, 999, 1000, 1001, 2500, 5000, 6123]) {
    it(`returns exactly the serial result for ${n} rows`, async () => {
      const rows = table(n);
      const serial = await fetchAllPages<{ id: number }>((a, b) => fakeQuery(rows).build(a, b));
      const q = fakeQuery(rows);
      const parallel = await fetchAllPagesParallel<{ id: number }>(q.build, { pageSize: 1000 });
      expect(parallel).toEqual(serial);
      expect(parallel.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    });
  }

  it("asks for the count on the first page only and fetches the rest at once", async () => {
    const q = fakeQuery(table(3500));
    let inFlight = 0;
    let peak = 0;
    const out = await fetchAllPagesParallel<{ id: number }>(
      (a, b, first) => q.build(a, b, first),
      { run: async (task) => { inFlight++; peak = Math.max(peak, inFlight); try { return await task(); } finally { inFlight--; } } },
    );
    expect(out).toHaveLength(3500);
    expect(q.calls.filter((c) => c[2])).toEqual([[0, 999, true]]);
    expect(q.calls.slice(1).map((c) => c[0])).toEqual([1000, 2000, 3000]);
    expect(peak).toBe(3);
  });

  it("falls back to serial paging when no count comes back", async () => {
    const q = fakeQuery(table(2100), { count: false });
    const out = await fetchAllPagesParallel<{ id: number }>(q.build);
    expect(out).toHaveLength(2100);
    expect(q.calls.map((c) => c[0])).toEqual([0, 1000, 2000]);
  });

  it("keeps reading when rows were added after the count", async () => {
    const rows = table(2000);
    const build = (from: number, to: number, first: boolean) =>
      Promise.resolve({ data: rows.slice(from, to + 1), error: null, count: first ? 1500 : null });
    rows.push(...table(700).map((r) => ({ id: r.id + 2000 })));
    const out = await fetchAllPagesParallel<{ id: number }>(build);
    expect(out).toHaveLength(2700);
  });

  it("throws when any page fails", async () => {
    const build = (from: number) =>
      Promise.resolve(from === 1000
        ? { data: null, error: { message: "boom" }, count: null }
        : { data: table(1000), error: null, count: 3000 });
    await expect(fetchAllPagesParallel(build)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("splitEmbeddedRevisions", () => {
  it("returns resources in their order without the embed and revisions per resource in id order", () => {
    const rows = [
      { id: "r2", sort_order: 1, contract_rate_revisions: [{ id: "b", resource_id: "r2" }, { id: "a", resource_id: "r2" }] },
      { id: "r1", sort_order: 2, contract_rate_revisions: [] },
      { id: "r3", sort_order: 3 },
    ];
    const out = splitEmbeddedRevisions(rows);
    expect(out.resources).toEqual([{ id: "r2", sort_order: 1 }, { id: "r1", sort_order: 2 }, { id: "r3", sort_order: 3 }]);
    expect(out.revisions.map((r) => r.id)).toEqual(["a", "b"]);
    // Input untouched.
    expect(rows[0].contract_rate_revisions?.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("takePayrollPrefetch", () => {
  const slot = (at: number): { current: PrefetchSlot<string> | null } => ({ current: { key: "u|s|e", at, pre: "reads" } });
  it("hands a fresh matching prefetch to one calculation only", () => {
    const ref = slot(1000);
    expect(takePayrollPrefetch(ref, "u", "s", "e", 2000)).toBe("reads");
    expect(ref.current).toBeNull();
    expect(takePayrollPrefetch(ref, "u", "s", "e", 2000)).toBeUndefined();
  });
  it("ignores a different unit/period or a stale prefetch, and clears it", () => {
    const other = slot(1000);
    expect(takePayrollPrefetch(other, "u2", "s", "e", 2000)).toBeUndefined();
    expect(other.current).toBeNull();
    const stale = slot(0);
    expect(takePayrollPrefetch(stale, "u", "s", "e", 120_000)).toBeUndefined();
  });
});
