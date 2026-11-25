import { describe, expect, it, vi } from "vitest";

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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => chain({ data: null, error: { message: "network down" } }) },
}));
import { fetchRevisions } from "./rate-revisions";

describe("rate revision load errors (review I11)", () => {
  it("throws instead of silently pricing every line at its base rate", async () => {
    await expect(fetchRevisions(["r1"])).rejects.toBeTruthy();
  });
});
