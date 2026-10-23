import { describe, expect, it } from "vitest";
import { evaluateFormula, parseFormulaConfig } from "./formula-engine";

const amount = (expression: string, basic: number, da: number) =>
  evaluateFormula(parseFormulaConfig("advanced", expression), { basic, da }).amount;

describe("Japan Tubular supplied rates", () => {
  it("HRA is exactly 5% of Basic plus DA for both supplied posts", () => {
    expect(amount("(basic + da) * 0.05", 11632, 3614)).toBe(762.3);
    expect(amount("(basic + da) * 0.05", 10021, 3614)).toBe(681.75);
  });
  it("Supervisor sheet totals exclude ESI and include WC policy", () => {
    const gross = Math.round(11632 + 3614 + 5717.25 + 762.3 + 609.84 + 583.1);
    expect(gross).toBe(22918);
    expect(gross - 1800 - 200).toBe(20918);
    expect(Math.round(gross + 1950 + 200 + 733 + 12.5) + 1854).toBe(27668);
  });
  it("Guard billing is the confirmed 29234 including reliever and management fee", () => {
    const gross = Math.round(10021 + 3614 + 5113.13 + 681.75 + 545.4 + 583.1);
    expect(gross).toBe(20558);
    expect(gross - 1800 - 200 - 154).toBe(18404);
    const ctc = Math.round(gross + 1950 + 668 + 656 + 12.5);
    expect(ctc).toBe(23845);
    expect(ctc + Math.round(ctc / 26 * 4) + 1721).toBe(29234);
  });
});