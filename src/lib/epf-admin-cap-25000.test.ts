import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("EPF Admin 1% of Basic plus DA capped at 25000", () => {
  const expression = "min(basic + da, 25000) * 0.01";

  it("contributes 1% of Basic plus DA below the cap", () => {
    expect(evaluateExpression(expression, { basic: 15000, da: 5000 })).toBe(200);
  });

  it("caps the wage base at 25000, limiting the contribution to 250", () => {
    expect(evaluateExpression(expression, { basic: 24000, da: 6000 })).toBe(250);
    expect(evaluateExpression(expression, { basic: 20000, da: 5000 })).toBe(250);
  });
});