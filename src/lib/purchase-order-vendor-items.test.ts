import { describe, expect, it } from "vitest";
import { purchaseOrderVendorItems, purchaseOrderVendorSizes } from "./purchase-order-vendor-items";

const items = [
  { id: "shirt", name: "Black Full Shirt", item_code: "SIH-BLACK-FULL-SHIRT" },
  { id: "belt", name: "Belt", item_code: "SIH-BELT" },
];

describe("purchase-order vendor item picker", () => {
  it("shows only products mapped to the selected vendor", () => {
    const rates = [
      { vendor_id: "ludhiana", item_id: "shirt", size_value: "38" },
      { vendor_id: "demo", item_id: "belt", size_value: "" },
    ];
    expect(purchaseOrderVendorItems("ludhiana", items, rates).map((item) => item.id)).toEqual(["shirt"]);
  });

  it("does not duplicate a product with several mapped sizes", () => {
    const rates = [
      { vendor_id: "ludhiana", item_id: "shirt", size_value: "38" },
      { vendor_id: "ludhiana", item_id: "shirt", size_value: "40" },
    ];
    expect(purchaseOrderVendorItems("ludhiana", items, rates)).toHaveLength(1);
  });

  it("shows only sizes mapped by the selected vendor", () => {
    const rates = [
      { vendor_id: "ludhiana", item_id: "shirt", size_value: "38" },
      { vendor_id: "ludhiana", item_id: "shirt", size_value: "40" },
      { vendor_id: "demo", item_id: "shirt", size_value: "42" },
    ];
    expect(purchaseOrderVendorSizes("ludhiana", "shirt", rates, ["36", "38", "40", "42"])).toEqual(["38", "40"]);
  });

  it("uses the product size chart only for a vendor's all-size mapping", () => {
    const rates = [{ vendor_id: "ludhiana", item_id: "shirt", size_value: "" }];
    expect(purchaseOrderVendorSizes("ludhiana", "shirt", rates, ["38", "40"])).toEqual(["38", "40"]);
  });

  it("returns no products or sizes before a vendor is selected", () => {
    expect(purchaseOrderVendorItems("", items, [])).toEqual([]);
    expect(purchaseOrderVendorSizes("", "shirt", [], ["38"])).toEqual([]);
  });
});
