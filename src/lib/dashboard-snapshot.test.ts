import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window ??= globalThis;
(globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { hashIds, readSnapshot, SNAPSHOT_MAX_AGE_MS, writeSnapshot } from "./dashboard-snapshot";

describe("dashboard snapshots", () => {
  beforeEach(() => store.clear());

  it("round-trips a value", () => {
    writeSnapshot("k", { orgs: 3 }, 1_000);
    expect(readSnapshot("k", 2_000)).toEqual({ orgs: 3 });
  });

  it("ignores snapshots older than the max age", () => {
    writeSnapshot("k", 1, 0);
    expect(readSnapshot("k", SNAPSHOT_MAX_AGE_MS + 1)).toBeUndefined();
  });

  it("ignores corrupt entries", () => {
    store.set("radiant.dash-snap.v1:k", "{not json");
    expect(readSnapshot("k")).toBeUndefined();
  });

  it("hashes id lists independent of order", () => {
    expect(hashIds(["b", "a"])).toBe(hashIds(["a", "b"]));
    expect(hashIds(["a"])).not.toBe(hashIds(["a", "b"]));
    expect(hashIds(null)).toBe("all");
  });
});
