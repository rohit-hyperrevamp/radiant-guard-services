import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { ptForSite } from "./pt-cross-site";

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
