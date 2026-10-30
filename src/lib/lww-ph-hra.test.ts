import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

const sql = readFileSync("db/prod-migrations/20261031012500_lww_ph_of_hra.sql", "utf8");
const exprFor = (code: string) => {
  const m = sql.match(new RegExp(`'${code}'[^']*'([^']+)'`));
  if (!m) throw new Error(`Missing ${code}`);
  return m[1];
};

describe("HRA-based LWW and PH formulas", () => {
  it("LWW is 6% of HRA", () => {
    expect(evaluateExpression(exprFor("LWW_HRA_6"), { hra: 2000, basic: 15000, da: 3000 })).toBeCloseTo(120, 6);
  });
  it("PH is 1% of HRA", () => {
    expect(evaluateExpression(exprFor("PH_HRA_1"), { hra: 2000, basic: 15000, da: 3000 })).toBeCloseTo(20, 6);
  });
});
