import { describe, expect, it, vi } from "vitest";

const masterFormula = { id: "m-epf", formula_mode: "advanced", formula_expression: "(basic + da) * 0.12", formula_version: 7 };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ in: async () => ({ data: [masterFormula] }) }) }),
  },
}));

import { applyLineRule, asContractManualAmount } from "./contract-line-override";
import { hydrateFormulasFromMaster } from "./contract-hydrate";
import { applyEsiToWageComputation, computeWages } from "./payroll-calc";

const pfLine: Parameters<typeof applyLineRule>[0] & { costComponentId: string; name: string; contractOverride?: boolean; formulaVersion?: number | null } = {
  costComponentId: "m-epf",
  name: "EE EPF 12%",
  calcType: "percentage" as const,
  percentage: 12,
  baseComponents: [{ label: "Basic", operator: "+" as const }],
  capAmount: null,
  amount: 1200,
  formulaMode: "advanced",
  formulaExpression: "(basic + da) * 0.12",
};

describe("Contract lines can be edited on the contract", () => {
  it("typing an amount into a formula line makes it the contract's own fixed amount", () => {
    const next = asContractManualAmount(pfLine, 1500);
    expect(next.amount).toBe(1500);
    expect(next.calcType).toBe("fixed");
    expect(next.formulaExpression).toBeNull();
    expect(next.contractOverride).toBe(true);
  });

  it("a formula written on the contract is kept", () => {
    const next = applyLineRule(pfLine, { mode: "formula", expression: " basic * 0.1 " });
    expect(next.formulaExpression).toBe("basic * 0.1");
    expect(next.contractOverride).toBe(true);
  });

  it("a percentage set on the contract replaces the master percentage", () => {
    const next = applyLineRule(pfLine, { mode: "percentage", percentage: 10, bases: ["Basic", "DA"], cap: 15000 });
    expect(next.percentage).toBe(10);
    expect(next.baseComponents.map((b) => b.label)).toEqual(["Basic", "DA"]);
    expect(next.capAmount).toBe(15000);
  });

  it("payroll does not overwrite an edited line with the master formula", async () => {
    const edited = applyLineRule(pfLine, { mode: "formula", expression: "basic * 0.1" });
    const [r] = await hydrateFormulasFromMaster([{ components: [], deductions: [edited, pfLine] }]);
    expect(r.deductions?.[0].formulaExpression).toBe("basic * 0.1");
    // An unedited line still follows the master.
    expect(r.deductions?.[1].formulaVersion).toBe(7);
  });

  it("an ESI amount typed on the contract is paid instead of the statutory amount", () => {
    const resource = {
      designationId: "d",
      components: [{ name: "Basic", amount: 15000 }],
      benefits: [],
      deductions: [asContractManualAmount({ name: "EE ESI", amount: 0, calcType: "percentage", percentage: 0.75 }, 100)],
      employerContributions: [],
      payrollDayBase: { method: "fixed_days", fixedDays: 26 },
    };
    const totals = { candidateId: "x", pDays: 26, otDays: 0, phDays: 0, otherPaidDays: 0, totalPaidDays: 26, absentDays: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wages = applyEsiToWageComputation(computeWages(totals as any, resource as any, 30, {} as any));
    expect(wages.deductions.find((d) => /esi/i.test(d.name))?.amount).toBe(100);
  });
});
