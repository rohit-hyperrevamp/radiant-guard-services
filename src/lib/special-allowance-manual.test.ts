import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { liveAddOnAmount } from "./contract-billing-addons";

describe("Manual employer Special Allowance", () => {
  it("preserves the amount entered by the user instead of taking 8% of CTC", () => {
    const sql = readFileSync("db/prod-migrations/20261030103700_special_allowance_manual.sql", "utf8");
    expect(sql).toContain("'SPECIAL_ALLOWANCE_MANUAL', 'fixed', 0, NULL");
    expect(sql).toContain("'employer', 'preset', NULL, 'flat'");
    const resource = { components: [{ name: "Basic", amount: 25000 }] };
    expect(liveAddOnAmount({ name: "Special Allowance", amount: 1750, calcType: "fixed", formulaExpression: null }, resource)).toBe(1750);
    expect(liveAddOnAmount({ name: "Special Allowance", amount: 3200, calcType: "fixed", formulaExpression: null }, resource)).toBe(3200);
  });
});