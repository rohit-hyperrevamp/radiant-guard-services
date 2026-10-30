import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("Employer Special Allowance", () => {
  it("calculates 8% of total CTC rather than gross salary", () => {
    const sql = readFileSync("db/prod-migrations/20261030103400_special_allowance_8pct_ctc.sql", "utf8");
    const expression = sql.match(/'([^']+)'\s*,\s*1,\s*true/)?.[1];
    if (!expression) throw new Error("Missing Special Allowance formula");
    expect(evaluateExpression(expression, { gross: 20000, total_ctc: 25000 })).toBe(2000);
    expect(evaluateExpression(expression, { gross: 20000, total_ctc: 30000 })).toBe(2400);
  });
});