import { describe, expect, it } from "vitest";
import { uniqueRowsById } from "./supabase-batch";
import { matchesSearch } from "./search-match";

describe("contract register page identity", () => {
  const matching = { id: "guard-contract", code: "CLI4108" };
  const other = { id: "other-contract", code: "CLI4109" };

  it("removes overlapping page IDs before rendering search results", () => {
    const rows = uniqueRowsById([other, matching, other, matching]);
    expect(rows.map((row) => row.id)).toEqual(["other-contract", "guard-contract"]);
    expect(rows.filter((row) => matchesSearch("CLI4108", [row.code])))
      .toEqual([matching]);
  });

  it("preserves distinct contracts belonging to the same client", () => {
    const historical = { id: "historical-contract", code: "CLI4108" };
    expect(uniqueRowsById([matching, historical, matching]))
      .toEqual([matching, historical]);
  });
});
import { createPool, fetchForIds, mapPool } from "./supabase-batch";

describe("bulk promise pool", () => {
  const tick = () => new Promise((r) => setTimeout(r, 1));

  it("never runs more than the limit at once and runs everything", async () => {
    const pool = createPool(3);
    let running = 0;
    let peak = 0;
    const done = await Promise.all(Array.from({ length: 20 }, (_, i) => pool.run(async () => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return i;
    })));
    expect(peak).toBe(3);
    expect(done).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(pool.active).toBe(0);
    expect(pool.queued).toBe(0);
  });

  it("frees the slot when a task fails or throws synchronously", async () => {
    const pool = createPool(1);
    await expect(pool.run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await expect(pool.run(() => { throw new Error("sync"); })).rejects.toThrow("sync");
    await expect(pool.run(() => 7)).resolves.toBe(7);
  });

  it("mapPool keeps input order with a cap", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapPool([5, 1, 3, 2, 4], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });
});

describe("fetchForIds", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

  it("uses id chunks for a small set", async () => {
    let chunks = 0, scans = 0;
    const rows = await fetchForIds<{ unit_id: string }>(ids(10), {
      chunk: (c) => { chunks++; return Promise.resolve({ data: c.map((unit_id) => ({ unit_id })), error: null }); },
      scan: () => { scans++; return Promise.resolve({ data: [], error: null }); },
      idOf: (r) => r.unit_id,
    });
    expect(rows).toHaveLength(10);
    expect([chunks, scans]).toEqual([1, 0]);
  });

  it("uses one filtered scan for a large set and keeps only the asked ids", async () => {
    let chunks = 0, scans = 0;
    const all = ids(1200).map((unit_id) => ({ unit_id }));
    const rows = await fetchForIds<{ unit_id: string }>(ids(600), {
      chunk: () => { chunks++; return Promise.resolve({ data: [], error: null }); },
      scan: (from, to) => { scans++; return Promise.resolve({ data: all.slice(from, to + 1), error: null }); },
      idOf: (r) => r.unit_id,
    });
    expect(chunks).toBe(0);
    expect(scans).toBe(2);
    expect(rows).toHaveLength(600);
    expect(rows.every((r) => Number(r.unit_id.slice(1)) < 600)).toBe(true);
  });
});
