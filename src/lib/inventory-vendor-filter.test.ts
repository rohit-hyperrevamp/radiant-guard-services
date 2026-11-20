import { describe, expect, it } from "vitest";
import { matchesProductVendor, vendorProductIds } from "./inventory-vendor-filter";

describe("vendor-wise products", () => {
  const links = [{ item_id: "shirt", vendor_id: "a" }, { item_id: "shirt", vendor_id: "a" }, { item_id: "shoe", vendor_id: "b" }];
  it("All vendors retains products without a vendor", () => {
    expect(matchesProductVendor({ id: "unlinked", last_purchase_vendor_id: null }, "all", vendorProductIds("all", links))).toBe(true);
  });
  it("selected vendor includes linked products without duplicates", () => {
    const ids = vendorProductIds("a", links);
    expect(ids?.size).toBe(1);
    expect(matchesProductVendor({ id: "shirt", last_purchase_vendor_id: "b" }, "a", ids)).toBe(true);
    expect(matchesProductVendor({ id: "shoe", last_purchase_vendor_id: "b" }, "a", ids)).toBe(false);
  });
  it("last purchase vendor remains searchable without a rate card", () => {
    expect(matchesProductVendor({ id: "belt", last_purchase_vendor_id: "a" }, "a", new Set())).toBe(true);
  });
  it("vendors with no linked products return no unrelated products", () => {
    expect(matchesProductVendor({ id: "shirt", last_purchase_vendor_id: null }, "unused", vendorProductIds("unused", links))).toBe(false);
  });
});