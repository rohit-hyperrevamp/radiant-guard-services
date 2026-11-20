import { expect, it } from "vitest";
import { stockCorrectionDelta } from "./stock-correction";
it("corrects quantity by the difference, not a second full stock entry", () => {
  expect(stockCorrectionDelta(10, 7)).toBe(-3);
  expect(stockCorrectionDelta(10, 12)).toBe(2);
});
it("removes stock by setting the balance to zero while preserving its ledger", () => {
  expect(stockCorrectionDelta(10, 0)).toBe(-10);
});
it("rejects invalid quantities and unchanged entries", () => {
  for (const value of [-1, NaN, Infinity, 10]) expect(() => stockCorrectionDelta(10, value)).toThrow();
});