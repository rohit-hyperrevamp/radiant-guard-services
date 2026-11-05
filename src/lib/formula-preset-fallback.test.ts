import { describe, it, expect } from "vitest";
import { parseFormulaConfig } from "./formula-engine";

describe("plain expression saved under preset mode", () => {
  it("EDLI 0.5% of Basic+DA is read as the written expression", () => {
    expect(parseFormulaConfig("preset", "(basic + da) * 0.005")).toEqual({ mode: "advanced", expression: "(basic + da) * 0.005" });
  });
});
