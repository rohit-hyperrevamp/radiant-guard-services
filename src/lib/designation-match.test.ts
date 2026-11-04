import { describe, expect, it } from "vitest";
import { resolveContractDesignation } from "./designation-match";

const names: Record<string, string> = { lg: "Lady Guard", lsg: "Lady Security Guard", sg: "Security Guard", sup: "Security Supervisor" };
const nameOf = (id: string) => names[id];

describe("resolveContractDesignation", () => {
  it("bills Lady Guard attendance against the contract's Lady Security Guard", () => {
    expect(resolveContractDesignation("lg", ["sg", "lsg"], nameOf)).toBe("lsg");
  });
  it("keeps an exact contract role", () => {
    expect(resolveContractDesignation("sg", ["sg", "lsg"], nameOf)).toBe("sg");
  });
  it("does not map unrelated roles", () => {
    expect(resolveContractDesignation("sup", ["sg", "lsg"], nameOf)).toBe("sup");
  });
});
