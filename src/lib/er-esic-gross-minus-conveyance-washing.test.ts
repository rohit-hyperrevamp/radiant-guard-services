import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("Employer ESIC excluding Conveyance and Washing", () => {
  it("registers an employer choice at 3.25% of gross minus both allowances", () => {
    const sql = readFileSync("db/prod-migrations/20261029055300_er_esic_325_gross_minus_conveyance_washing.sql", "utf8");
    expect(sql).toContain("'employer', 'earned_salary'");
    const expression = sql.match(/'([^']+)'\s*,\s*1,\s*true/)?.[1];
    if (!expression) throw new Error("Missing employer formula");
    expect(evaluateExpression(expression, { gross: 20000, conveyance_allowance: 1800, washing_allowance: 1000, hra: 2000 })).toBe(559);
  });
});