import { describe, expect, it } from "vitest";
import { evaluateFormula, parseFormulaConfig, serializeFormulaConfig } from "./formula-engine";
import { selectFormulaTemplate } from "./formula-templates";

describe("HRA formula selection", () => {
  it("selects 5% of Basic plus DA and retains it after save/load", () => {
    const selected = selectFormulaTemplate("hra-basic-da-5");
    expect(selected).not.toBeNull();
    if (!selected) throw new Error("Missing HRA formula");
    const saved = serializeFormulaConfig(selected);
    const restored = parseFormulaConfig(saved.mode, saved.expression);
    expect(evaluateFormula(restored, { basic: 10021, da: 3614, hra: 9999, gross: 50000 }).amount).toBe(681.75);
    expect(evaluateFormula(restored, { basic: 11632, da: 4134 }).amount).toBe(788.3);
  });
  it("returns independent formula choices without retaining previous edits", () => {
    const edited = selectFormulaTemplate("hra-basic-da-5");
    if (!edited || edited.mode !== "preset") throw new Error("Missing HRA preset");
    edited.preset.percent = 50;
    expect(evaluateFormula(selectFormulaTemplate("hra-basic-da-5"), { basic: 10000, da: 2000 }).amount).toBe(600);
  });
});