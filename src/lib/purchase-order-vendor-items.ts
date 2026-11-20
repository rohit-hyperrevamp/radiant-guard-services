export type PurchaseOrderVendorItem = {
  id: string;
  name: string;
  item_code: string;
};

export type PurchaseOrderVendorRate = {
  vendor_id: string;
  item_id: string;
  size_value: string | null;
};

/** Only products explicitly enabled on the selected vendor can be picked. */
export function purchaseOrderVendorItems<T extends PurchaseOrderVendorItem>(
  vendorId: string,
  items: T[],
  rateCards: PurchaseOrderVendorRate[],
): T[] {
  if (!vendorId) return [];
  const itemIds = new Set(
    rateCards
      .filter((rate) => rate.vendor_id === vendorId)
      .map((rate) => rate.item_id),
  );
  return items.filter((item) => itemIds.has(item.id));
}

/**
 * Size-specific vendor rates restrict the list to those sizes. A vendor's
 * blank-size rate applies to the whole product, so its normal size chart is
 * retained as the fallback.
 */
export function purchaseOrderVendorSizes(
  vendorId: string,
  itemId: string,
  rateCards: PurchaseOrderVendorRate[],
  productSizes: string[] = [],
): string[] {
  if (!vendorId || !itemId) return [];
  const mappedSizes: string[] = [];
  for (const rate of rateCards) {
    if (rate.vendor_id !== vendorId || rate.item_id !== itemId) continue;
    const size = String(rate.size_value ?? "").trim();
    if (size && !mappedSizes.includes(size)) mappedSizes.push(size);
  }
  if (mappedSizes.length) return mappedSizes;
  return Array.from(new Set(productSizes.map((size) => size.trim()).filter(Boolean)));
}
