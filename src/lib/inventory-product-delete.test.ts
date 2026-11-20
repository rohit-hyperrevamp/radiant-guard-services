import { describe, expect, it } from "vitest";
import { deleteInventoryProduct, productDeleteFailure } from "./inventory-product-delete";

describe("product deletion", () => {
  it("confirms an unused product was actually removed", async () => {
    await expect(deleteInventoryProduct("unused", async (id) => ({ data: { id }, error: null }))).resolves.toBeUndefined();
  });
  it("preserves linked products and offers disabling rather than cascading deletion", async () => {
    const error = { code: "23503", message: "foreign key violation" };
    await expect(deleteInventoryProduct("used", async () => ({ data: null, error }))).rejects.toEqual(error);
    expect(productDeleteFailure(error).linked).toBe(true);
  });
  it("does not claim success when permissions hide the deleted row", async () => {
    await expect(deleteInventoryProduct("hidden", async () => ({ data: null, error: null }))).rejects.toThrow("Product was not deleted");
  });
  it("preserves permission errors rather than offering a history workaround", () => {
    const result = productDeleteFailure({ code: "42501", message: "You do not have delete access here" });
    expect(result.linked).toBe(false);
    expect(result.message).toBe("You do not have delete access here");
  });
});