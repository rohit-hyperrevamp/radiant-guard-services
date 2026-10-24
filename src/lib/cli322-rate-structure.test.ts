import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

describe("CLI322 individual source amounts", () => {
  const context = { basic: 10021, da: 3614 };
  it("calculates HRA, Paid Holiday, Bonus and LWW from Basic plus DA", () => {
    expect(evaluateExpression("(basic + da) * 0.05", context)).toBe(681.75);
    expect(evaluateExpression("(basic + da) * 0.01", context)).toBe(136.35);
    expect(evaluateExpression("round((basic + da) * 0.0833 * 100) / 100", context)).toBe(1135.8);
    expect(evaluateExpression("(basic + da) * 0.04", context)).toBe(545.4);
  });
  it("uses every listed amount without rounding or a balancing charge", () => {
    const gross = 10021 + 3614 + 681.75 + 136.35 + 300 + 1135.8 + 545.4 + 100 + 3000;
    expect(gross).toBeCloseTo(19534.3, 2);
    expect(gross - 1800 - 200 - 146).toBeCloseTo(17388.3, 2);
    const ctc = gross + 1950 + 631.6 + 545 + 12.5;
    expect(ctc).toBeCloseTo(22673.4, 2);
    expect(ctc + 2267).toBeCloseTo(24940.4, 2);
  });
});