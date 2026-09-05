// Recompute formula-driven billing add-ons (reliever charges, management fee)
// against the LIVE Total CTC of a contract resource line.
//
// Why: `contract_resources` stores a rupee snapshot of every line. When a
// formula master changes (e.g. reliever moves from "1/6 of wages" to
// "1/6 of Total CTC"), the stored amount stays frozen until somebody opens the
// contract line and hits Save. The contract editor already evaluates live, so
// the contract card looked right while invoices (which consume the stored
// amounts) silently billed the old value.
//
// Consumers should call `refreshBillingAddOns` right after
// `hydrateFormulasFromMaster`, so the money that gets billed always follows the
// current master formula without re-saving contracts.

import {
  evaluateFormula,
  parseFormulaConfig,
  slugifyVar,
  type FormulaContext,
} from "@/lib/formula-engine";

export type AddOnLine = {
  name: string;
  amount: number | string | null;
  calcType?: string | null;
  costComponentId?: string | null;
  allowanceId?: string | null;
  formulaMode?: string | null;
  formulaExpression?: string | null;
  [k: string]: unknown;
};

export type AddOnResource = {
  components?: AddOnLine[];
  benefits?: AddOnLine[];
  deductions?: AddOnLine[];
  employerContributions?: AddOnLine[];
  [k: string]: unknown;
};

export const isRelieverLine = (x: { name?: unknown }) =>
  /reliever/i.test(String(x?.name ?? ""));
export const isMgmtFeeLine = (x: { name?: unknown }) =>
  /management\s*fee|\bmgmt\s*fee\b/i.test(String(x?.name ?? ""));
export const isBillingAddOn = (x: { name?: unknown }) =>
  isRelieverLine(x) || isMgmtFeeLine(x);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const hasFormula = (l: AddOnLine) =>
  !!String(l.formulaExpression ?? "").trim();

function addAliases(ctx: FormulaContext, amount: number, labels: (string | null | undefined)[]) {
  for (const label of labels) {
    const key = slugifyVar(String(label ?? ""));
    if (key) (ctx as Record<string, number>)[key] = amount;
  }
}

/**
 * Live value for one add-on line. A custom / plain-fixed line (no formula)
 * keeps its entered amount; anything formula-driven is evaluated now.
 */
export function liveAddOnAmount(
  line: AddOnLine,
  resource: AddOnResource,
  extraEmployer: AddOnLine[] = [],
): number {
  if (!hasFormula(line)) return num(line.amount);
  const cfg = parseFormulaConfig(line.formulaMode ?? null, line.formulaExpression ?? null);
  if (!cfg || (cfg.mode === "advanced" && !cfg.expression?.trim())) return num(line.amount);

  const components = resource.components ?? [];
  const benefits = (resource.benefits ?? []).filter((b) => !isBillingAddOn(b));
  const employer = [
    ...(resource.employerContributions ?? []).filter((b) => !isBillingAddOn(b)),
    ...extraEmployer,
  ];

  const componentsTotal = components.reduce((s, c) => s + num(c.amount), 0);
  const benefitsTotal = benefits.reduce((s, b) => s + num(b.amount), 0);
  const employerTotal = employer.reduce((s, b) => s + num(b.amount), 0);
  const totalCtc = componentsTotal + benefitsTotal + employerTotal;

  const ctx: FormulaContext = {
    basic: 0,
    da: 0,
    gross: componentsTotal + benefitsTotal,
    earned_gross: componentsTotal,
    earnedgross: componentsTotal,
    earned_wages: componentsTotal,
    earnedwages: componentsTotal,
    ctc: totalCtc,
    total_ctc: totalCtc,
    billing_rate: totalCtc,
    billingrate: totalCtc,
    fixed_amount: num(line.amount),
    days_in_month: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
    working_days: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
  } as FormulaContext;

  for (const c of components) addAliases(ctx, num(c.amount), [c.name]);
  for (const b of benefits) addAliases(ctx, num(b.amount), [b.name]);
  for (const b of employer) addAliases(ctx, num(b.amount), [b.name]);

  const r = evaluateFormula(cfg, ctx);
  if (r.error) return num(line.amount);
  return Math.round(r.amount * 100) / 100;
}

/**
 * Return the resource with its reliever / management-fee amounts recomputed
 * against the live Total CTC. Management fee sees the refreshed reliever, which
 * mirrors the contract rate card ordering (CTC -> reliever -> fee).
 */
export function refreshBillingAddOns<T extends AddOnResource>(resource: T): T {
  const refreshList = (list: AddOnLine[] | undefined, extraEmployer: AddOnLine[]) =>
    (list ?? []).map((line) =>
      isBillingAddOn(line)
        ? { ...line, amount: liveAddOnAmount(line, resource, extraEmployer) }
        : line,
    );

  // Pass 1: relievers (CTC-based).
  const withReliever: T = {
    ...resource,
    benefits: (resource.benefits ?? []).map((l) =>
      isRelieverLine(l) ? { ...l, amount: liveAddOnAmount(l, resource) } : l,
    ),
    employerContributions: (resource.employerContributions ?? []).map((l) =>
      isRelieverLine(l) ? { ...l, amount: liveAddOnAmount(l, resource) } : l,
    ),
  };

  const relievers = [
    ...(withReliever.benefits ?? []),
    ...(withReliever.employerContributions ?? []),
  ].filter(isRelieverLine);

  // Pass 2: management fee, which may sit on top of the reliever.
  return {
    ...withReliever,
    benefits: refreshList(withReliever.benefits, relievers).map((l, i) =>
      isRelieverLine(l) ? (withReliever.benefits ?? [])[i] : l,
    ),
    employerContributions: refreshList(withReliever.employerContributions, relievers).map((l, i) =>
      isRelieverLine(l) ? (withReliever.employerContributions ?? [])[i] : l,
    ),
  } as T;
}

export function refreshBillingAddOnsAll<T extends AddOnResource>(resources: T[]): T[] {
  return resources.map(refreshBillingAddOns);
}
