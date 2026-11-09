import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";

describe("CLI4304 supplied eight-hour roles", () => {
  it.each([
    ["Security Guard", 15742.26, 2245.41, 1582.42, 2469.57, 617.39, 913.74, 1089.01, 22824.49, 28314.20],
    ["Security Supervisor", 16058.30, 2282.76, 1608.75, 2510.65, 627.66, 928.94, 600, 23204.21, 28271.46],
  ])("keeps %s on the eight-hour sheet without additional four-hour wages", (_role, basic, leave, bonus, epf, esi, gratuity, service, gross, billing) => {
    const context = { basic, da: 3254.40 };
    const amount = (expression: string) => evaluateFormula({ mode: "advanced", expression }, context).amount;
    expect(amount("(basic + da) * 0.1182")).toBe(leave);
    expect(amount("(basic + da) * 0.0833")).toBe(bonus);
    expect(amount("(basic + da) * 0.13")).toBe(epf);
    expect(amount("(basic + da) * 0.0325")).toBe(esi);
    expect(amount("(basic + da) * 0.0481")).toBe(gratuity);
    expect(basic + context.da + leave + bonus).toBeCloseTo(gross, 2);
    expect(gross + epf + esi + gratuity + 300 + 100 + service).toBeCloseTo(billing, 2);
  });
});