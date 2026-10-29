import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("Management Fee 10% of total gross", () => {
  it("charges 10% of full gross, not CTC or net salary", () => {
    const sql = readFileSync("db/prod-migrations/20261029172500_management_fee_10pct_gross.sql", "utf8");
    const expression = sql.match(/'([^']+)'\s*,\s*1,\s*true/)?.[1];
    if (!expression) throw new Error("Missing management fee formula");
    expect(evaluateExpression(expression, {
      gross: 20000, total_ctc: 25000, net: 18000,
      hra: 2000, conveyance_allowance: 1800, washing_allowance: 1000,
    })).toBe(2000);
  });
});