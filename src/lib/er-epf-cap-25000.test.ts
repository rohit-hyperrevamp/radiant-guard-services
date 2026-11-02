import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("ER EPF 12% of Basic plus DA capped at 25000", () => {
  const expression = "min(basic + da, 25000) * 0.12";

  it("contributes 12% of the combined wage base below the cap", () => {
    expect(evaluateExpression(expression, { basic: 15000, da: 5000 })).toBe(2400);
  });

  it("caps the wage base at 25000, limiting the contribution to 3000", () => {
    expect(evaluateExpression(expression, { basic: 24000, da: 6000 })).toBe(3000);
    expect(evaluateExpression(expression, { basic: 20000, da: 5000 })).toBe(3000);
  });
});