import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const chain = (): unknown =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: "network down" } });
          }
          return () => chain();
        },
      },
    );
  return { supabase: { from: () => chain() } };
});

import { fetchOtherSitePtTotals, fetchPtAllocations, ptForSite } from "./pt-cross-site";
import type { PtSlabLike } from "./payroll-calc";

describe("cross-site PT reads surface errors (P12)", () => {
  it("fetchOtherSitePtTotals rejects instead of returning 'nothing charged elsewhere'", async () => {
    await expect(fetchOtherSitePtTotals(["x"], "site", "2026-09-30")).rejects.toMatchObject({ message: "network down" });
  });
  it("fetchPtAllocations rejects instead of dropping the recorded split", async () => {
    await expect(fetchPtAllocations(["x"], "site", "2026-09-30")).rejects.toMatchObject({ message: "network down" });
  });
});

describe("PT slab is read on the rounded gross (P6)", () => {
  const slab = (min: number, max: number | null, tax: number): PtSlabLike => ({ state: "Karnataka", region_label: "All Pincodes", salary_min: min, salary_max: max, tax_per_month: tax, gender: "all" });
  const slabs = [slab(0, 10000, 0), slab(10001, 14999, 150), slab(15000, null, 200)];
  const pt = (siteGross: number) => ptForSite({ state: "Karnataka", pincode: null, gender: "", siteGross, slabs, ranges: [] }).amount;
  it("₹10,000.60 is paid as ₹10,001 and gets that slab, not ₹0", () => {
    expect(pt(10000.6)).toBe(150);
  });
  it("₹14,999.40 rounds down into its slab instead of falling in the gap", () => {
    expect(pt(14999.4)).toBe(150);
  });
});
