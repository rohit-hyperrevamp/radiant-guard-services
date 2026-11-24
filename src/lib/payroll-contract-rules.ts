import { payItemKey } from "./pay-item-names";
import { statutoryHead } from "./statutory-heads";
import { parseFormulaConfig } from "./formula-engine";
import type { ContractResourceLike, WageComputation } from "./payroll-calc";

export type PayrollContractIssue = {
  kind: "exact_duplicate" | "possible_duplicate" | "missing_setting" | "invalid_formula" | "monthly_cap";
  side: string;
  component: string;
  detail: string;
  blocking: boolean;
  amount?: number;
};

/** The payment's name, not the components mentioned inside its calculation base. */
export function payrollComponentKey(name: string): string {
  const heading = name.split("(")[0]?.trim() ?? name;
  if (/^(nfh|national\s*(?:festival\s*)?holidays?)\b/i.test(heading)) return "nfh";
  return payItemKey(heading);
}

/** PF administration, EPS and ED insurance are different liabilities from PF. */
export function payrollLiabilityKey(name: string): string {
  const heading = name.split("(")[0]?.trim() ?? name;
  const head = statutoryHead(heading);
  if (head === "epf" && !/admin|adm\b|edli|\beps\b|pension/i.test(heading)) return "epf";
  if (head === "esic" && !/extra\s*duty|\bed\b/i.test(heading)) return "esic";
  if (head === "pt" || head === "lwf") return head;
  return payrollComponentKey(name);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Compare calculation settings, not labels or catalog IDs. */
export function payrollLineSignature(line: { name: string; amount: unknown }): string {
  const ignored = new Set(["name", "allowanceId", "costComponentId", "formulaVersion"]);
  const fields = Object.fromEntries(Object.entries(line).filter(([k, v]) => !ignored.has(k) && v != null));
  if (typeof fields["formulaExpression"] === "string") fields["formulaExpression"] = fields["formulaExpression"].replace(/\s+/g, "").toLowerCase();
  fields["amount"] = Number(line.amount) || 0;
  return stable(fields);
}

function activeCalculation(line: { amount: unknown; formulaExpression?: string | null; percentage?: unknown }): boolean {
  return Number(line.amount) !== 0 || Number(line.percentage) > 0 || Boolean(line.formulaExpression?.trim() && !/^\(?\s*0(?:\.0+)?\s*\)?$/.test(line.formulaExpression.trim()));
}

/** A constant formula is a monthly charge, not a fresh charge for each rate segment. */
export function isMonthlyFlatPayrollLine(line: { formulaMode?: string | null; formulaExpression?: string | null; calcType?: string | null; deductionCalcType?: string | null; fixedCalcMethod?: string | null }): boolean {
  if (line.fixedCalcMethod === "per_duty") return false;
  if (line.formulaExpression?.trim()) {
    const cfg = parseFormulaConfig(line.formulaMode, line.formulaExpression);
    if (cfg?.mode === "advanced") {
      const identifiers = cfg.expression.match(/[a-z_][a-z0-9_]*/gi) ?? [];
      return identifiers.every((id) => /^(min|max|abs|floor|ceil|round)$/i.test(id));
    }
    return cfg?.mode === "preset" && cfg.preset.base.kind === "fixed_amount" && !cfg.preset.multipliers?.length && (!cfg.preset.divisor || cfg.preset.divisor === "none");
  }
  return line.deductionCalcType === "fixed_amount" || (line.calcType === "fixed" && line.fixedCalcMethod === "flat");
}

export function savedPayrollPfCap(line: { name: string; capFlatAmount?: unknown; capAmount?: unknown; percentage?: unknown; payrollMonthlyCap?: unknown }): number {
  if (payrollLiabilityKey(line.name) !== "epf") return 0;
  if (Number(line.payrollMonthlyCap) > 0) return Number(line.payrollMonthlyCap);
  return Number(line.capFlatAmount) > 0 ? Number(line.capFlatAmount) : Number(line.capAmount) > 0 && Number(line.percentage) > 0 ? Number(line.capAmount) * Number(line.percentage) / 100 : 0;
}

export function prepareContractPayrollResource(resource: ContractResourceLike) {
  const issues: PayrollContractIssue[] = [];
  const clean = <T extends { name: string; amount: unknown }>(items: T[], side: string): T[] => {
    const seen = new Map<string, T[]>();
    const out: T[] = [];
    for (const item of items) {
      const key = side === "components" || side === "benefits" ? payrollComponentKey(item.name) : payrollLiabilityKey(item.name);
      const previous = seen.get(key) ?? [];
      const exact = previous.some((p) => payrollLineSignature(p) === payrollLineSignature(item));
      if (exact) {
        issues.push({ kind: "exact_duplicate", side, component: item.name, detail: "Identical saved calculation repeated on the same side; applied once. Source contract retained.", blocking: false, amount: Number(item.amount) || 0 });
        continue;
      }
      if (previous.some(activeCalculation) && activeCalculation(item)) {
        issues.push({ kind: "possible_duplicate", side, component: item.name, detail: "Repeated component has different saved settings. Resolve the contract before processing; no rate was selected by assumption.", blocking: true, amount: Number(item.amount) || 0 });
      }
      seen.set(key, [...previous, item]);
      out.push(item);
    }
    return out;
  };
  const cleaned: ContractResourceLike = {
    ...resource,
    components: clean(resource.components, "components"),
    benefits: clean(resource.benefits, "benefits"),
    deductions: clean(resource.deductions, "deductions"),
    employerContributions: clean(resource.employerContributions, "employerContributions"),
  };
  const base = cleaned.payrollDayBase;
  if (!base || ((base.method === "fixed_days" || base.method === "fixed_annual_average") && !(Number(base.fixedDays) > 0)) || (base.method === "actual_minus_weekly_off" && base.weeklyOffDay == null) || (base.method === "custom_weekdays" && !base.includedWeekdays?.length)) {
    issues.push({ kind: "missing_setting", side: "contract", component: "Payroll day base", detail: "A valid saved payroll divisor is required; no default day count was invented.", blocking: true });
  }
  for (const side of ["deductions", "employerContributions"] as const) {
    for (const line of cleaned[side]) {
      if (!line.formulaExpression?.trim() && line.calcType === "percentage" && (!(Number(line.percentage) >= 0) || line.percentage == null || !line.baseComponents?.length)) {
        issues.push({ kind: "missing_setting", side, component: line.name, detail: "Percentage and calculation base must be saved on the contract; statutory defaults were not substituted.", blocking: true });
      }
    }
  }
  return { resource: cleaned, issues };
}

/** One explicit saved PF money cap across an employee's duty lines, not one cap per role. */
export function applySavedPayrollMonthlyCaps<T extends { id: string; wages: WageComputation | null; calculationIssues: PayrollContractIssue[] }>(rows: T[]): void {
  const used = new Map<string, number>();
  const caps = new Map<string, number>();
  const monthly = new Map<string, { signature: string; amount: number }>();
  for (const row of rows) {
    const wages = row.wages;
    if (!wages) continue;
    for (const side of ["deductions", "employerContributions"] as const) {
      wages[side] = wages[side].map((line) => {
        const liability = payrollLiabilityKey(line.name);
        if (isMonthlyFlatPayrollLine(line) && line.amount > 0) {
          const key = `${row.id}|${side}|${liability}`;
          const previous = monthly.get(key);
          const signature = payrollLineSignature(line);
          if (previous && previous.signature === signature) {
            row.calculationIssues.push({ kind: "exact_duplicate", side, component: line.name, detail: "Same saved monthly charge on another duty line; applied once for this employee. Source rates retained.", blocking: false, amount: line.amount });
            return { ...line, amount: 0 };
          }
          if (previous) row.calculationIssues.push({ kind: "possible_duplicate", side, component: line.name, detail: "Different saved monthly charges for this employee's duty lines; review before processing.", blocking: true, amount: line.amount });
          monthly.set(key, { signature, amount: line.amount });
        }
        if (liability !== "epf") return line;
        const cap = savedPayrollPfCap(line);
        if (!(cap > 0) || !(line.amount > 0)) return line;
        const key = `${row.id}|${side}|epf`;
        const previousCap = caps.get(key);
        if (previousCap != null && Math.abs(previousCap - cap) > 0.01) {
          row.calculationIssues.push({ kind: "missing_setting", side, component: line.name, detail: "Different saved monthly PF limits across this employee's roles; no second independent monthly limit was assumed.", blocking: true });
          return line;
        }
        caps.set(key, cap);
        const already = used.get(key) ?? 0;
        const amount = Math.round(Math.min(line.amount, Math.max(0, cap - already)) * 100) / 100;
        used.set(key, already + amount);
        if (amount !== line.amount) row.calculationIssues.push({ kind: "monthly_cap", side, component: line.name, detail: "Applied the contract's explicit monthly PF cap across this employee's duty lines.", blocking: false, amount: Math.round((line.amount - amount) * 100) / 100 });
        return { ...line, amount };
      });
    }
    wages.totalDeductions = Math.round(wages.deductions.reduce((n, x) => n + x.amount, 0) * 100) / 100;
    wages.totalEmployerContributions = Math.round(wages.employerContributions.reduce((n, x) => n + x.amount, 0) * 100) / 100;
    wages.netPay = Math.max(0, Math.round((wages.earnedGross - wages.totalDeductions) * 100) / 100);
    wages.employerCost = Math.round((wages.earnedGross + wages.totalEmployerContributions) * 100) / 100;
  }
}