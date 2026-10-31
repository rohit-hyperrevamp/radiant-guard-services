import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

const sql = readFileSync("db/prod-migrations/20261031123000_remote_area_allowance.sql", "utf8");
const expr = sql.match(/'(\(basic \+ da\)[^']+)'/)![1];

describe("Remote Area Allowance", () => {
  it("is 37.9% of Basic + DA", () => {
    expect(evaluateExpression(expr, { basic: 15000, da: 5000, hra: 2000 })).toBeCloseTo(7580, 6);
  });
});
