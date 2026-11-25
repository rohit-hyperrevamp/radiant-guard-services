// Hydrate contract_resources JSONB lines with the latest formula_mode /
// formula_expression / formula_version from the Control Center masters
// (allowance_types, cost_components) by allowanceId / costComponentId.
//
// Why: contract_resources are a snapshot of monetary amounts and base
// configuration, but the FORMULA itself should always evaluate against the
// latest master so that "change the formula in Allowance Manager → payroll
// recalculates" works without re-saving every contract.
//
// Used by Payroll detail and Invoice/Paysheet routes right after the raw
// resources are loaded and before computeWages runs.

import { supabase } from "@/integrations/supabase/client";
import { getReference } from "@/lib/reference-data";

type LineWithIds = {
  name: string;
  amount: number | string | null;
  calcType?: string | null;
  allowanceId?: string | null;
  costComponentId?: string | null;
  formulaMode?: string | null;
  formulaExpression?: string | null;
  formulaVersion?: number | null;
  [k: string]: unknown;
};

type ResourceShape = {
  components: LineWithIds[];
  benefits?: LineWithIds[];
  deductions?: LineWithIds[];
  employerContributions?: LineWithIds[];
  [k: string]: unknown;
};


export type FormulaMaster = {
  mode: string | null;
  expr: string | null;
  version: number | null;
  fixedCalcMethod?: string | null;
  fixedDutyComponents?: string[] | null;
  fixedDutyDivisor?: string | null;
};

/** Master formula ids referenced by these contract lines. */
export function formulaMasterIds<T extends ResourceShape>(resources: T[]) {
  const allowanceIds = new Set<string>();
  const costIds = new Set<string>();
  for (const r of resources) {
    for (const c of r.components ?? []) {
      if (c.allowanceId) allowanceIds.add(String(c.allowanceId));
    }
    for (const list of [r.benefits ?? [], r.deductions ?? [], r.employerContributions ?? []]) {
      for (const it of list) {
        if (it.allowanceId) allowanceIds.add(String(it.allowanceId));
        if (it.costComponentId && !String(it.costComponentId).startsWith("__")) {
          costIds.add(String(it.costComponentId));
        }
      }
    }
  }
  return { allowanceIds, costIds };
}

const toMaster = (m: Record<string, unknown>): FormulaMaster => ({
  mode: (m.formula_mode as string | null) ?? null,
  expr: (m.formula_expression as string | null) ?? null,
  version: m.formula_version == null ? null : Number(m.formula_version),
  fixedCalcMethod: (m.fixed_calc_method as string | null) ?? null,
  fixedDutyComponents: Array.isArray(m.fixed_duty_components) ? (m.fixed_duty_components as string[]) : null,
  fixedDutyDivisor: (m.fixed_duty_divisor as string | null) ?? null,
});
const MASTER_COLS = "id, formula_mode, formula_expression, formula_version, fixed_calc_method, fixed_duty_components, fixed_duty_divisor";

/** Every allowance and cost-component master (bulk callers hydrate thousands of lines at once). */
export async function loadAllFormulaMasters(db = supabase): Promise<Map<string, FormulaMaster>> {
  const out = new Map<string, FormulaMaster>();
  // App client: the shared session-cached masters (the allowance / cost component
  // managers invalidate them on save). Same rows, allowance rows applied first.
  if (db === supabase) {
    const [allowances, costs] = await Promise.all([
      getReference<Record<string, unknown>>("allowanceTypes"),
      getReference<Record<string, unknown>>("costComponents"),
    ]);
    for (const m of [...allowances, ...costs]) out.set(String(m.id), toMaster(m));
    return out;
  }
  for (const table of ["allowance_types", "cost_components"] as const) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select(MASTER_COLS).order("id").range(from, from + 999);
      if (error) throw error;
      for (const m of (data ?? []) as Array<Record<string, unknown>>) out.set(String(m.id), toMaster(m));
      if ((data ?? []).length < 1000) break;
    }
  }
  return out;
}

export async function hydrateFormulasFromMaster<T extends ResourceShape>(
  resources: T[],
): Promise<T[]> {
  if (!resources.length) return resources;
  const { allowanceIds, costIds } = formulaMasterIds(resources);
  const masterById = new Map<string, FormulaMaster>();
  // Both master tables in parallel; allowance rows are applied first, exactly
  // as the sequential reads did.
  const read = async (table: "allowance_types" | "cost_components", ids: Set<string>) => {
    if (ids.size === 0) return [] as Array<Record<string, unknown>>;
    const { data } = await supabase.from(table).select(MASTER_COLS).in("id", Array.from(ids));
    return (data ?? []) as Array<Record<string, unknown>>;
  };
  const [allowances, costs] = await Promise.all([read("allowance_types", allowanceIds), read("cost_components", costIds)]);
  for (const m of [...allowances, ...costs]) masterById.set(String(m.id), toMaster(m));
  return hydrateFormulasWith(resources, masterById);
}

/** Overlay already-loaded master formulas (same rules as hydrateFormulasFromMaster). */
export function hydrateFormulasWith<T extends ResourceShape>(
  resources: T[],
  masterById: Map<string, FormulaMaster>,
): T[] {
  const overlay = (line: LineWithIds): LineWithIds => {
    // A line edited on the contract itself (amount, % or formula) belongs to
    // the contract — the master must never overwrite it.
    if (line.contractOverride === true) return line;
    // Source-card contracts deliberately keep exact fixed amounts. A linked
    // master ID is retained for traceability, but must not turn that fixed
    // snapshot back into a live formula during payroll or invoicing.
    if (line.calcType === "fixed" && !String(line.formulaExpression ?? "").trim()) return line;
    const id = line.allowanceId ?? line.costComponentId;
    if (!id) return line;
    const m = masterById.get(String(id));
    if (!m) return line;
    const next: LineWithIds = { ...line };
    // Always overlay master formula state (including cleared/disabled formulas),
    // so that "update master → click Sync on contract" reflects exactly what the
    // master currently says.
    next.formulaMode = m.mode;
    next.formulaExpression = m.expr;
    next.formulaVersion = m.version;
    if (m.fixedCalcMethod !== undefined) next.fixedCalcMethod = m.fixedCalcMethod;
    if (m.fixedDutyComponents !== undefined) next.fixedDutyComponents = m.fixedDutyComponents;
    if (m.fixedDutyDivisor !== undefined) next.fixedDutyDivisor = m.fixedDutyDivisor;
    return next;
  };

  return resources.map((r) => ({
    ...r,
    components: (r.components ?? []).map(overlay),
    benefits: (r.benefits ?? []).map(overlay),
    deductions: (r.deductions ?? []).map(overlay),
    employerContributions: (r.employerContributions ?? []).map(overlay),
  })) as T[];
}
