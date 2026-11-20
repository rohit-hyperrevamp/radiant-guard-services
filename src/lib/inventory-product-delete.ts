type ProductDeleteError = { code?: string; message?: string };

export function productDeleteFailure(error: unknown): { linked: boolean; message: string } {
  const detail: ProductDeleteError = error && typeof error === "object" ? error : {};
  if (detail.code === "23503") {
    return { linked: true, message: "This product is used in stock, purchase, issuance or other inventory records. It cannot be permanently deleted without losing that history. You can disable it instead." };
  }
  return { linked: false, message: detail.message || "Could not delete the product. Please try again." };
}

export async function deleteInventoryProduct(
  id: string,
  remove: (id: string) => PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await remove(id);
  if (error) throw error;
  if (!data || data.id !== id) throw new Error("Product was not deleted. It may have already been removed, or you may not have delete access.");
}