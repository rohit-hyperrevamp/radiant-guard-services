import { describe, expect, it } from "vitest";
import { payItemKey, standardPayItemName } from "./pay-item-names";
describe("pay item column names", () => {
  it("WA and Washing Allowance share a column", () => expect(payItemKey("WA")).toBe(payItemKey("Washing Allowance")));
  it("bonus variants share a column", () => expect(standardPayItemName("Bonus / Exgratia 8.33% (Basic+DA) Rounded")).toBe("Bonus"));
  it("leave with wages = leave pay", () => expect(payItemKey("Leave with Wages 5% (Basic+DA)")).toBe(payItemKey("Leave Pay")));
  it("OA = Other Allowance", () => expect(payItemKey("OA")).toBe(payItemKey("Other Allowance")));
  it("HRA 40% (Basic+DA) = HRA", () => expect(standardPayItemName("HRA 40% (Basic+DA)")).toBe("HRA"));
  it("Bonus (Addition) stays separate", () => expect(payItemKey("Bonus (Addition)")).not.toBe(payItemKey("Bonus")));
});
