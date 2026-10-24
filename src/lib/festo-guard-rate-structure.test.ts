import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./formula-engine";

const wages = { basic: 13266, da: 3614, exgratia: 6633 };

describe("CLI310 confirmed Security Guard sheet", () => {
  it("uses Basic plus DA for HRA and half Basic for Exgratia", () => {
    expect(evaluateExpression("(basic + da) * 0.1", wages)).toBe(1688);
    expect(evaluateExpression("basic * 0.5", wages)).toBe(6633);
  });
  it("keeps the listed whole-rupee PF, Bonus and Guard Board Levy", () => {
    expect(evaluateExpression("round((basic + da + exgratia) * 0.12)", wages)).toBe(2822);
    expect(evaluateExpression("round((basic + da + exgratia) * 0.13)", wages)).toBe(3057);
    expect(evaluateExpression("round((basic + da + exgratia) * 0.03)", wages)).toBe(705);
    expect(evaluateExpression("round(7000 * 0.0833)", wages)).toBe(583);
  });
  it("recomputes totals from every listed amount including levy", () => {
    const gross = 13266 + 3614 + 6633 + 1688 + 597 + 0 + 1800 + 1000 + 583;
    expect(gross).toBe(29181);
    expect(gross - 2822 - 200).toBe(26159);
    const ctc = gross + 3057 + 200 + 12.5 + 705;
    expect(ctc).toBe(33155.5);
    expect(ctc + 5408).toBe(38563.5);
    expect(ctc + 5408 + 3085).toBe(41648.5);
  });
});