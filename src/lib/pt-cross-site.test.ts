import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { otherSitePtChanged, ptForSite, ptSpread } from "./pt-cross-site";

// Maharashtra statutory slabs.
const slabs = [
  { state: "Maharashtra", region_label: "All Pincodes", gender: "male", salary_min: 0, salary_max: 7500, tax_per_month: 0 },
  { state: "Maharashtra", region_label: "All Pincodes", gender: "male", salary_min: 7501, salary_max: 10000, tax_per_month: 175 },
  { state: "Maharashtra", region_label: "All Pincodes", gender: "male", salary_min: 10001, salary_max: null, tax_per_month: 200 },
  { state: "Maharashtra", region_label: "All Pincodes", gender: "female", salary_min: 0, salary_max: 25000, tax_per_month: 0 },
  { state: "Maharashtra", region_label: "All Pincodes", gender: "female", salary_min: 25001, salary_max: null, tax_per_month: 200 },
];
const pt = (siteGross: number, other?: { gross: number; pt: number }, gender = "male") =>
  ptForSite({ state: "Maharashtra", pincode: null, gender, siteGross, other, slabs, ranges: [] }).amount;

describe("professional tax across sites", () => {
  it("one site: ₹9,841 pays ₹175", () => expect(pt(9841)).toBe(175));
  it("second site tops up to the combined slab: ₹3,280 after ₹9,841 (₹175 paid) pays ₹25", () =>
    expect(pt(3280, { gross: 9841, pt: 175 })).toBe(25));
  it("second site pays nothing once ₹200 was charged elsewhere", () => expect(pt(7380, { gross: 10661, pt: 200 })).toBe(0));
  it("small first site plus later site crosses ₹10,000: ₹6,560 after ₹4,028 (₹0 paid) pays ₹200", () =>
    expect(pt(6560, { gross: 4028, pt: 0 })).toBe(200));
  it("women in Maharashtra pay ₹200 only above ₹25,000", () => {
    expect(pt(25500, undefined, "female")).toBe(200);
    expect(pt(24587, undefined, "female")).toBe(0);
  });
});

describe("guard working at two IDBI FC Road sites (49344, Sep 2026)", () => {
  it("9 duties at the first site (₹9,525.60) pays ₹175", () => expect(pt(9525.6)).toBe(175));
  it("12 duties at the second site after it pays ₹25 (total ₹200)", () =>
    expect(pt(12700.8, { gross: 9525.6, pt: 175 })).toBe(25));
  it("processed the other way round: ₹200 then ₹0", () => {
    expect(pt(12700.8)).toBe(200);
    expect(pt(9525.6, { gross: 12700.8, pt: 200 })).toBe(0);
  });
  it("processing is blocked when another site's PT changed since the page was computed", () => {
    expect(otherSitePtChanged(new Map([["a", { gross: 0, pt: 0 }]]), new Map([["a", { gross: 9525.6, pt: 175 }]]))).toBe(true);
    expect(otherSitePtChanged(new Map([["a", { gross: 9525.6, pt: 175 }]]), new Map([["a", { gross: 9525.6, pt: 175 }]]))).toBe(false);
  });
});

describe("PT charged once at the busiest site before anything is processed", () => {
  const duties = new Map([["CLI379", 11.5], ["CLI3301", 12], ["CLI4026", 6]]);
  const run = (unit: string, siteGross: number) =>
    ptForSite({ state: "Maharashtra", pincode: null, gender: "male", siteGross, spread: ptSpread(duties, unit), slabs, ranges: [] }).amount;
  it("busiest site carries the full month slab", () => expect(run("CLI3301", 9317)).toBe(200));
  it("other sites charge nothing", () => {
    expect(run("CLI379", 6243)).toBe(0);
    expect(run("CLI4026", 4768)).toBe(0);
  });
  it("after the carrier is processed, others subtract it as before", () =>
    expect(ptForSite({ state: "Maharashtra", pincode: null, gender: "male", siteGross: 6243, other: { gross: 9317, pt: 200 }, spread: ptSpread(duties, "CLI379"), slabs, ranges: [] }).amount).toBe(0));
  it("single-site guards are unchanged", () => expect(run("X", 0) + ptForSite({ state: "Maharashtra", pincode: null, gender: "male", siteGross: 9841, spread: ptSpread(new Map([["A", 26]]), "A"), slabs, ranges: [] }).amount).toBe(175));
});
