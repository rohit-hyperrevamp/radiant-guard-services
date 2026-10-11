import { describe, expect, it } from "vitest";
import { mergePayItems, payItemKey, standardPayItemName } from "./pay-item-names";
describe("pay item column names", () => {
  it("WA and Washing Allowance share a column", () => expect(payItemKey("WA")).toBe(payItemKey("Washing Allowance")));
  it("bonus variants share a column", () => expect(standardPayItemName("Bonus / Exgratia 8.33% (Basic+DA) Rounded")).toBe("Bonus"));
  it("leave with wages = leave pay", () => expect(payItemKey("Leave with Wages 5% (Basic+DA)")).toBe(payItemKey("Leave Pay")));
  it("OA = Other Allowance", () => expect(payItemKey("OA")).toBe(payItemKey("Other Allowance")));
  it("HRA 40% (Basic+DA) = HRA", () => expect(standardPayItemName("HRA 40% (Basic+DA)")).toBe("HRA"));
  it("Bonus (Addition) stays separate", () => expect(payItemKey("Bonus (Addition)")).not.toBe(payItemKey("Bonus")));
  it("CLI2 CCA and conveyance share a key", () => expect(payItemKey("CCA")).toBe(payItemKey("Conveyance Allow")));
  it("explicit city compensation remains distinct", () => expect(payItemKey("City Compensatory Allowance")).not.toBe(payItemKey("Conveyance Allowance")));
  it("preserves the CLI2 2200 rate and precise totals", () => {
    const source = [{ name: "CCA", amount: 2200 }, { name: "Conv Allow", amount: 12.345 }];
    expect(mergePayItems(source)).toEqual([{ name: "Conveyance Allowance", amount: 2212.345 }]);
    expect(source[0]).toEqual({ name: "CCA", amount: 2200 });
  });
  it("transport remains separate", () => expect(payItemKey("Transportation Allowance")).not.toBe(payItemKey("CCA")));
  it("normalizes additions without folding into contract wages", () => {
    expect(payItemKey("WA (Addition)")).toBe(payItemKey("WASHING ALLOWANCE (Addition)"));
    expect(payItemKey("WA (Addition)")).not.toBe(payItemKey("WA"));
  });
  it("preserves hour-specific duty allowances", () => expect(payItemKey("Additional Allowance (4 Hrs)")).not.toBe(payItemKey("Additional Allowance (2 Hrs)")));
  it("preserves composite basic and statutory bases", () => {
    expect(standardPayItemName("Basic + DA")).toBe("Basic + DA");
    expect(standardPayItemName("EE EPF 12% (Basic+DA)")).toBe("EE EPF 12% (Basic+DA)");
  });
});
