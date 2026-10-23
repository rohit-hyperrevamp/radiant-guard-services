import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("EE EPF 12% of Gross minus HRA master", () => {
  it("deducts HRA before applying 12%, without adding an unrequested cap", () => {
    const sql = readFileSync("db/prod-migrations/20261023203900_ee_epf_12pct_gross_minus_hra.sql", "utf8");
    const expression = sql.match(/'([^']+)'\s*,\s*1,\s*true/)?.[1];
    if (!expression) throw new Error("Missing saved master formula");
    expect(evaluateExpression(expression, { gross: 20000, hra: 2000 })).toBe(2160);
    expect(evaluateExpression(expression, { gross: 10000, hra: 1500 })).toBe(1020);
  });
});