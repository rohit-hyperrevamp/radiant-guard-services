import { describe, expect, it, vi } from "vitest";
import before from "../backups/cli3619-rate-structure-20261124.json";
import proposed from "../data-fixes/cli3619-formula-proposal.json";
import masters from "../backups/cli3619-used-formula-masters-20261124.json";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { computeBenefitAmount, type BenefitItem, type ResourceComponent } from "../../src/routes/admin.contracts.client-contracts";
import { computeWages, unknownFormulaVariables, type ContractResourceLike } from "../../src/lib/payroll-calc";
import { contractMonthlyBilling } from "../../src/lib/contract-rate-display";
import { hydrateFormulasWith, type FormulaMaster } from "../../src/lib/contract-hydrate";
import { computeInvoiceUnit, invoiceUnitTaxable, type InvoiceGlobals, type InvoiceUnitData } from "../../src/lib/invoice-engine";
import { DEFAULT_SPLIT } from "../../src/lib/invoice-split";

const original = before.contracts.find((c) => c.contract_code === "CON15115");
if (!original) throw new Error("CLI3619 active contract backup is required");

const resource = (r: (typeof proposed)[number]): ContractResourceLike => ({
  designationId: r.designation_id,
  components: r.components as ResourceComponent[],
  benefits: r.benefits as BenefitItem[],
  deductions: r.deductions as unknown as BenefitItem[],
  employerContributions: r.employer_contributions as unknown as BenefitItem[],
  payrollDayBase: { method: "fixed_days", fixedDays: 26, weeklyOffDay: null },
  otMultiplier: r.ot_multiplier,
  otBasis: "components",
});

describe("CLI3619 verified formula conversion preserves the agreed rate structure", () => {
  it("retains both roles, all agreed amounts, quantities, shifts and non-EPF fields", () => {
    expect(proposed).toHaveLength(2);
    for (const next of proposed) {
      const old = original.resources.find((r) => r.id === next.id);
      if (!old) throw new Error("Conversion must only update existing CLI3619 roles");
      expect(next.components).toEqual(old.components);
      expect(next.benefits).toEqual(old.benefits);
      expect(next.deductions.map((l) => l.amount)).toEqual(old.deductions.map((l) => l.amount));
      expect(next.employer_contributions.map((l) => l.amount)).toEqual(old.employer_contributions.map((l) => l.amount));
      expect(next.deductions.slice(1)).toEqual(old.deductions.slice(1));
      expect(next.employer_contributions.slice(1)).toEqual(old.employer_contributions.slice(1));
      expect(next.quantity).toBe(old.quantity);
      expect(next.shift_hours).toBe(8);
      expect(next.gross).toBe(old.gross);
      const { deductions: _a, employer_contributions: _b, ...unchanged } = next;
      const { deductions: _c, employer_contributions: _d, ...oldUnchanged } = old;
      expect(unchanged).toEqual(oldUnchanged);
    }
  });

  for (const role of ["Security Guard", "Security Supervisor"]) {
    it(`${role} retains exact full-month gross, EPF, LWF, net and billing in editor and payroll`, () => {
      const r = proposed.find((x) => x.designation_name === role);
      if (!r) throw new Error("Both original roles are required");
      const data = resource(r);
      const wages = computeWages({ pDays: 26, tDays: 26, otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0 }, data, 30);
      expect(wages.earnedGross).toBe(role === "Security Guard" ? 21398 : 24700);
      expect(wages.totalDeductions).toBe(1810);
      expect(wages.netPay).toBe(role === "Security Guard" ? 19588 : 22890);
      expect(wages.employerContributions.find((l) => l.name.startsWith("ER EPF"))?.amount).toBe(1950);
      expect(contractMonthlyBilling(data)).toBe(role === "Security Guard" ? 24863 : 28165);
      const old = original.resources.find((x) => x.id === r.id);
      if (!old) throw new Error("Original invoice rate is required");
      const globals: InvoiceGlobals = {
        codes: [{ code: "P", counts_as_present: true, is_paid: true, day_value: 1 }],
        pdbs: [{ id: r.payroll_day_base_id, method: "fixed_days", fixed_days: 26 }],
        bdbs: [{ id: r.billing_day_base_id, method: "fixed_days", fixed_days: 26 }],
        designationNames: new Map([[r.designation_id, role]]), masters: new Map(),
        publicHolidays: [], phTypeIds: new Set(), ptSlabs: [], pincodeRanges: [], lwfRows: [],
      };
      const input: InvoiceUnitData = {
        unitId: before.unit_id, unitCode: "CLI3619", customerName: "Cipla", start: "2026-09-01", end: "2026-09-30",
        epfCapEnabled: true, ptState: null, ptPincode: null, unitPh: null, woAsPresent: false, exactDayRate: false,
        primary: [{ id: "test-person", employee_code: "TEST", full_name: "Formula test", designation_id: r.designation_id }],
        links: [], secondary: [], leavers: [],
        entries: Array.from({ length: 26 }, (_, day) => ({ candidate_id: "test-person", designation_id: r.designation_id,
          entry_date: `2026-09-${String(day + 1).padStart(2, "0")}`, code: "P", ot_hours: 0, shift_hours: 8, is_reliever: false })),
        periodContract: { id: original.id, billing_type_id: null, gst_option: "igst" },
        billingMode: "man_days", resources: [r], revisions: null, additions: [], deductions: [],
      };
      const invoiceOptions = { unitId: before.unit_id, unitCode: "CLI3619", customerName: "Cipla", invoiceSplit: DEFAULT_SPLIT, exactDayRate: false };
      const originalInvoice = invoiceUnitTaxable(computeInvoiceUnit({ ...input, resources: [old] }, globals), invoiceOptions, []).taxable;
      const convertedInvoice = invoiceUnitTaxable(computeInvoiceUnit(input, globals), invoiceOptions, []).taxable;
      expect(originalInvoice).toBeGreaterThan(0);
      expect(convertedInvoice).toBe(originalInvoice);
      for (const line of [...data.deductions, ...data.employerContributions]) {
        expect(computeBenefitAmount(line as BenefitItem, data.components as ResourceComponent[])).toBe(line.amount);
        expect(unknownFormulaVariables(line.formulaExpression, data.components.map((c) => c.name))).toEqual([]);
      }
    });
  }

  it("uses the verified 12% Basic+DA and 13% Gross-HRA bases below the ₹15,000 ceiling", () => {
    const r = proposed.find((x) => x.designation_name === "Security Guard");
    if (!r) throw new Error("Guard is required");
    const wages = computeWages({ pDays: 13, tDays: 13, otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0 }, resource(r), 30);
    expect(wages.deductions.find((l) => l.name === "EE EPF")?.amount).toBe(963);
    expect(wages.employerContributions.find((l) => l.name.startsWith("ER EPF"))?.amount).toBe(1181.31);
  });

  it("links to exact existing master formulas without changing their shared definitions", () => {
    const byId = new Map<string, FormulaMaster>(masters.map((m) => [m.id, {
      mode: m.formula_mode, expr: m.formula_expression, version: m.formula_version,
    }]));
    for (const r of proposed) {
      const d = r.deductions[0];
      const er = r.employer_contributions[0];
      if (!d || !er) throw new Error("Both EPF lines are required");
      expect(d.costComponentId).toBe("cc142930-0001-4001-8001-000000000001");
      expect(d.formulaExpression).toBe("min(basic + da, 15000) * 0.12");
      expect(er.costComponentId).toBe("ead64358-9d85-441a-ad99-b8ce35430ed5");
      expect(er.baseComponents).toEqual([{ label: "Gross", operator: "+" }, { label: "HRA", operator: "-" }]);
      expect(er.percentage).toBe(13);
      expect(er.capAmount).toBe(15000);
      expect(er.capFlatAmount).toBe(1950);
      const input = { components: r.components, benefits: r.benefits, deductions: r.deductions, employerContributions: r.employer_contributions };
      expect(hydrateFormulasWith([input], byId)[0]).toEqual(input);
    }
  });
});