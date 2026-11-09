import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./formula-engine";
import { contractDailyBilling, contractMonthlyBilling } from "./contract-rate-display";
import { periodDateList } from "./mis-billing";

describe("CLI4304 and CLI4349 supplied Bangalore rates", () => {
  const billingDayBase = { method: "fixed_days", fixed_days: 26 };
  it.each([
    ["Guard", 8, 15742.26, 1089.01, 28314.20, 1089.01],
    ["Guard", 12, 15742.26, 600, 37323.52, 1435.52],
    ["Supervisor", 8, 16058.30, 600, 28271.46, 1087.36],
    ["Supervisor", 12, 16058.30, 600, 37927.81, 1458.76],
  ])("%s %ih retains the listed daily value for every month length", (_role, hours, basic, service, monthly, daily) => {
    const context = { basic, da: 3254.40 };
    const amount = (expression: string) => evaluateFormula({ mode: "advanced", expression }, context).amount;
    const components = [basic, context.da, amount("(basic + da) * 0.1182"), amount("round((basic + da) * 0.0833 * 100) / 100"), ...(hours === 12 ? [amount("(basic + da) * 0.5")] : [])].map(amount => ({ amount }));
    const employerContributions = [amount("(basic + da) * 0.13"), amount("(basic + da) * 0.0325"), amount("(basic + da) * 0.0481"), 300, 100, service].map(amount => ({ amount }));
    const result = contractMonthlyBilling({ components, employerContributions });
    expect(result).toBe(monthly);
    for (const end of ["2026-02-28", "2026-09-30", "2026-10-31"]) {
      expect(contractDailyBilling(result, { billingDayBase }, periodDateList(end.slice(0, 8) + "01", end))).toEqual({ billingDays: 26, perDay: daily });
    }
    expect(amount("min(basic + da, 15000) * 0.12")).toBe(1800);
    expect(amount("(basic + da) * 0.0075")).toBe(_role === "Guard" ? 142.47 : 144.85);
  });
});