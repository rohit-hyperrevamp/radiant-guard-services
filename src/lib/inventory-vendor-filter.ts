export type VendorProductLink = { item_id: string; vendor_id: string };

export function vendorProductIds(vendorId: string, links: VendorProductLink[]): Set<string> | null {
  if (vendorId === "all") return null;
  return new Set(links.filter((link) => link.vendor_id === vendorId).map((link) => link.item_id));
}

export function matchesProductVendor(
  item: { id: string; last_purchase_vendor_id: string | null },
  vendorId: string,
  linkedIds: Set<string> | null,
): boolean {
  return vendorId === "all" || item.last_purchase_vendor_id === vendorId || Boolean(linkedIds?.has(item.id));
}