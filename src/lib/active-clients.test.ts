import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: 0,
  fail: false,
  user: "u1" as string | null,
  authCb: null as null | ((e: string, s: { user: { id: string } } | null) => void),
}));
vi.mock("@/lib/supabase-ready", () => ({ supabaseSessionReady: async () => true }));
vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: () => {
      state.calls++;
      return Promise.resolve(
        state.fail
          ? { data: null, error: { message: "down" } }
          : { data: [{ id: "A", status: "active" }, { id: "B", status: "active" }], error: null },
      );
    },
  };
  return {
    supabase: {
      from: () => builder,
      auth: {
        getSession: async () => ({ data: { session: state.user ? { user: { id: state.user } } : null } }),
        onAuthStateChange: (cb: typeof state.authCb) => {
          state.authCb = cb;
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
  };
});

import { clearActiveClientIdsCache, fetchActiveClientIds } from "./active-clients";

describe("fetchActiveClientIds cache", () => {
  beforeEach(() => {
    state.calls = 0;
    state.fail = false;
    state.user = "u1";
    clearActiveClientIdsCache();
  });

  it("shares one read between concurrent and later callers", async () => {
    const [a, b] = await Promise.all([fetchActiveClientIds(), fetchActiveClientIds()]);
    await fetchActiveClientIds();
    expect(state.calls).toBe(1);
    expect([...a]).toEqual(["A", "B"]);
    a.delete("A");
    expect(b.has("A")).toBe(true);
    expect((await fetchActiveClientIds()).has("A")).toBe(true);
  });

  it("reloads for a different user and after the cache is cleared", async () => {
    await fetchActiveClientIds();
    state.user = "u2";
    await fetchActiveClientIds();
    expect(state.calls).toBe(2);
    clearActiveClientIdsCache();
    await fetchActiveClientIds();
    expect(state.calls).toBe(3);
  });

  it("does not cache a failed read", async () => {
    state.fail = true;
    await expect(fetchActiveClientIds()).rejects.toBeTruthy();
    state.fail = false;
    await fetchActiveClientIds();
    expect(state.calls).toBe(2);
  });
});
