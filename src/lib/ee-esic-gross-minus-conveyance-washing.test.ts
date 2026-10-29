import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("Employee ESIC 3.25% excluding Conveyance and Washing", () => {
  it("subtracts both allowances before applying 3.25% and retains HRA", () => {
    const sql = readFileSync("db/prod-migrations/20261029054800_ee_esic_325_gross_minus_conveyance_washing.sql", "utf8");
    const expression = sql.match(/'([^']+)'\s*,\s*1,\s*true/)?.[1];
    if (!expression) throw new Error("Missing saved ESIC master formula");
    expect(evaluateExpression(expression, { gross: 20000, conveyance_allowance: 1800, washing_allowance: 1000, hra: 2000 })).toBe(559);
    expect(evaluateExpression(expression, { gross: 30000, conveyance_allowance: 0, washing_allowance: 0 })).toBe(975);
  });
});