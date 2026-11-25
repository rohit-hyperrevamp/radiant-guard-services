import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return {
    store,
    owner: "user-a" as string | null,
    rpc: vi.fn(),
    listeners: [] as Array<(event: string, session: { user: { id: string } } | null) => void>,
  };
});

vi.mock("./active-clients", () => ({ fetchActiveClientIds: async () => new Set(["U1"]) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: async () => ({
        data: { session: mocks.owner ? { user: { id: mocks.owner } } : null },
      }),
      onAuthStateChange: (fn: (typeof mocks.listeners)[number]) => {
        mocks.listeners.push(fn);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

import { charterSnapshotKey, fetchCharterUnits } from "./charter-units";

const row = {
  id: "U1",
  customer_id: "C1",
  active_employee_count: 2,
  security_guards: [{ id: "g1", name: "Guard Name" }],
};

describe("charter snapshot is per user and holds no names", () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.owner = "user-a";
    mocks.rpc.mockResolvedValue({ error: null, data: { units: [row] } });
  });

  it("keys the snapshot by user, strips guard names and removes legacy/other copies", async () => {
    mocks.store.set("radiant:charter-units:v3-active", "[]");
    mocks.store.set(charterSnapshotKey("user-b"), "[]");
    await fetchCharterUnits();
    expect(Array.from(mocks.store.keys())).toEqual([charterSnapshotKey("user-a")]);
    expect(mocks.store.get(charterSnapshotKey("user-a"))).not.toContain("Guard Name");
  });

  it("never serves another user's snapshot as the offline fallback", async () => {
    await fetchCharterUnits();
    mocks.owner = "user-b";
    mocks.rpc.mockResolvedValue({ error: new Error("down"), data: null });
    await expect(fetchCharterUnits()).rejects.toThrow("down");
  });

  it("clears every snapshot on sign-out", async () => {
    await fetchCharterUnits();
    for (const fn of mocks.listeners) fn("SIGNED_OUT", null);
    expect(mocks.store.size).toBe(0);
  });
});
