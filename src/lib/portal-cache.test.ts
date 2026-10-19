import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CACHE_MAX_AGE, createPortalCache, isSavedList, validEntry } from "./portal-cache";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    key: (index) => [...values.keys()][index] ?? null,
  };
}
afterEach(() => vi.useRealTimers());
describe("portal reference cache", () => {
  it("excludes private employee, financial and permission data", () => {
    expect(isSavedList(["admin", "designations"])).toBe(true);
    for (const key of [["admin", "candidates"], ["rbac", "current-perms"], ["payroll"], ["admin", "units"]]) {
      expect(isSavedList(key)).toBe(false);
    }
  });
  it("bounds saved freshness and refuses future timestamps", () => {
    const now = 1_000_000;
    expect(validEntry({ key: ["admin", "departments"], data: [], at: now - CACHE_MAX_AGE + 1 }, now)).toBe(true);
    expect(validEntry({ key: ["admin", "departments"], data: [], at: now - CACHE_MAX_AGE }, now)).toBe(false);
    expect(validEntry({ key: ["admin", "departments"], data: [], at: now + 1 }, now)).toBe(false);
  });
  it("restores unchanged data without requesting it again", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const first = new QueryClient();
    const cache = createPortalCache(first, storage);
    cache.setOwner("person-a");
    first.setQueryData(["admin", "departments"], [{ id: "accounts" }]);
    vi.advanceTimersByTime(500);
    cache.dispose();
    const next = new QueryClient();
    const restored = createPortalCache(next, storage);
    restored.setOwner("person-a");
    const fetch = vi.fn(async () => []);
    const rows = await next.fetchQuery({ queryKey: ["admin", "departments"], queryFn: fetch, staleTime: CACHE_MAX_AGE });
    expect(rows).toEqual([{ id: "accounts" }]);
    expect(fetch).not.toHaveBeenCalled();
    restored.dispose();
  });
  it("removes invalidated saved data before a refresh can finish", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const client = new QueryClient();
    const cache = createPortalCache(client, storage);
    cache.setOwner("person-a");
    client.setQueryData(["admin", "departments"], ["old"]);
    vi.advanceTimersByTime(500);
    void client.invalidateQueries({ queryKey: ["admin", "departments"] });
    cache.dispose();
    const next = new QueryClient();
    const restored = createPortalCache(next, storage);
    restored.setOwner("person-a");
    expect(next.getQueryData(["admin", "departments"])).toBeUndefined();
    restored.dispose();
  });
  it("clears old identity data on account changes and logout", () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const client = new QueryClient();
    const cache = createPortalCache(client, storage);
    cache.setOwner("person-a");
    client.setQueryData(["admin", "departments"], ["a-only"]);
    vi.advanceTimersByTime(500);
    cache.setOwner("person-b");
    expect(client.getQueryData(["admin", "departments"])).toBeUndefined();
    expect(storage.length).toBe(0);
    client.setQueryData(["admin", "departments"], ["b-only"]);
    vi.advanceTimersByTime(500);
    cache.setOwner(null);
    expect(storage.length).toBe(0);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    cache.dispose();
  });
  it("does not fail login when saved data is corrupt or storage unavailable", () => {
    const storage = memoryStorage();
    storage.setItem("radiant.portal-cache.v1.person-a", "broken");
    const cache = createPortalCache(new QueryClient(), storage);
    expect(() => cache.setOwner("person-a")).not.toThrow();
    cache.dispose();
    storage.getItem = () => { throw new Error("Disabled storage"); };
    storage.removeItem = () => { throw new Error("Disabled storage"); };
    const blocked = createPortalCache(new QueryClient(), storage);
    expect(() => blocked.setOwner("person-a")).not.toThrow();
    expect(() => blocked.setOwner(null)).not.toThrow();
    blocked.dispose();
  });
});