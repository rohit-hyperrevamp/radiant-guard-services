import { beforeEach, describe, expect, it, vi } from "vitest";

let calls = 0;
let fail = false;
vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: () => builder,
    range: () => {
      calls++;
      return Promise.resolve(
        fail ? { data: null, error: { message: "down" } } : { data: [{ code: "P" }, { code: "A" }], error: null },
      );
    },
  };
  return { supabase: { from: () => builder, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } };
});

import { clearReferenceCache, getReference } from "./reference-data";

describe("reference data cache", () => {
  beforeEach(() => {
    calls = 0;
    fail = false;
    clearReferenceCache();
  });

  it("fetches a table once and shares it between concurrent callers", async () => {
    const [a, b, c] = await Promise.all([
      getReference("attendanceCodes"),
      getReference("attendanceCodes"),
      getReference("attendanceCodes"),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(c).toHaveLength(2);
    await getReference("attendanceCodes");
    expect(calls).toBe(1);
  });

  it("does not cache a failed load", async () => {
    fail = true;
    await expect(getReference("pincodeRanges")).rejects.toBeTruthy();
    fail = false;
    await expect(getReference("pincodeRanges")).resolves.toHaveLength(2);
    expect(calls).toBe(2);
  });
});
