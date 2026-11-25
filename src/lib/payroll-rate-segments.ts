import { computeWages, isOptionalAllowanceVar, unknownFormulaVariables, type AttendanceTotals, type ContractResourceLike, type WageComponent, type WageComputation } from "./payroll-calc";
import { isMonthlyFlatPayrollLine, payrollComponentKey, payrollLiabilityKey, prepareContractPayrollResource, savedPayrollPfCap, type PayrollContractIssue } from "./payroll-contract-rules";

export type PreparedPayrollRateSegment = { from: string; to: string; resource: ContractResourceLike };
export type PayrollRateBreakdown = { from: string; to: string; totals: AttendanceTotals; wages: WageComputation | null; issues: PayrollContractIssue[] };
const cents = (n: number) => Math.round(n * 100) / 100;

/** Retains the whole-period divisor but evaluates each formula on that window's actual duties. */
export function computeContractRateSegments(input: {
  segments: PreparedPayrollRateSegment[];
  periodDates: string[];
  totalsForWindow: (from: string, to: string) => AttendanceTotals;
  options: NonNullable<Parameters<typeof computeWages>[3]>;
}) {
  const breakdown: PayrollRateBreakdown[] = [];
  const issues: PayrollContractIssue[] = [];
  const amounts = { components: new Map<string, WageComponent>(), benefits: new Map<string, WageComponent>(), deductions: new Map<string, WageComponent>(), employerContributions: new Map<string, WageComponent>() };
  const pfCaps = new Map<string, number>();
  const monthlyAmounts = new Map<string, number>();
  let activeWeight = 0;
  let first: WageComputation | null = null;
  let totalOt = 0, totalOtDuties = 0;
  for (const segment of input.segments) {
    const weight = input.periodDates.filter((d) => d >= segment.from && d <= segment.to).length / input.periodDates.length;
    const prepared = prepareContractPayrollResource(segment.resource);
    // The saved monthly cap is date-weighted only if the rate itself changes inside this period.
    for (const side of ["deductions", "employerContributions"] as const) {
      for (const line of prepared.resource[side]) {
        const cap = savedPayrollPfCap(line);
        if (cap > 0) {
          const key = `${side}|${payrollLiabilityKey(line.name)}`;
          pfCaps.set(key, (pfCaps.get(key) ?? 0) + cap * weight);
        }
      }
    }
    const totals = input.totalsForWindow(segment.from, segment.to);
    if (totals.pDays + totals.otDays + totals.phDays + totals.otherPaidDays <= 0) continue;
    if (totals.pDays + totals.phDays + totals.otherPaidDays > 0) activeWeight += weight;
    for (const side of ["components", "benefits", "deductions", "employerContributions"] as const) {
      for (const line of prepared.resource[side]) {
        const unknown = unknownFormulaVariables(line.formulaExpression, prepared.resource.components.map((c) => c.name));
        // An allowance this role doesn't have evaluates to 0 by design → warn only.
        const optional = unknown.filter(isOptionalAllowanceVar);
        const hard = unknown.filter((v) => !isOptionalAllowanceVar(v));
        if (hard.length) prepared.issues.push({ kind: "invalid_formula", side, component: line.name, detail: `Unknown saved formula variables: ${hard.join(", ")}`, blocking: true });
        if (optional.length) prepared.issues.push({ kind: "invalid_formula", side, component: line.name, detail: `No such pay line on this role, counted as 0: ${optional.join(", ")}`, blocking: false });
      }
    }
    const scoped = prepared.issues.map((i) => ({ ...i, detail: `${segment.from} to ${segment.to}: ${i.detail}` }));
    let wages: WageComputation | null = null;
    if (!scoped.some((i) => i.blocking)) {
      try {
        wages = computeWages(totals, prepared.resource, input.periodDates.length, { ...input.options, savedContractOnly: true });
      } catch (error) {
        scoped.push({ kind: "invalid_formula", side: "contract", component: "Saved rate", detail: `${segment.from} to ${segment.to}: ${error instanceof Error ? error.message : "Invalid saved formula"}`, blocking: true });
      }
    }
    issues.push(...scoped);
    breakdown.push({ from: segment.from, to: segment.to, totals, wages, issues: scoped });
    if (!wages) continue;
    first ??= wages;
    totalOt += wages.totalOtAmount;
    totalOtDuties += totals.otDays;
    for (const side of ["components", "benefits", "deductions", "employerContributions"] as const) {
      for (const line of wages[side]) {
        const key = side === "components" || side === "benefits" ? payrollComponentKey(line.name) : payrollLiabilityKey(line.name);
        const previous = amounts[side].get(key);
        const monthly = side !== "components" && isMonthlyFlatPayrollLine(line);
        amounts[side].set(key, { ...line, amount: cents((previous?.amount ?? 0) + line.amount * (monthly ? weight : 1)) });
        if (monthly) monthlyAmounts.set(`${side}|${key}`, (monthlyAmounts.get(`${side}|${key}`) ?? 0) + line.amount * weight);
      }
    }
  }
  if (!first || issues.some((i) => i.blocking)) return { wages: null, issues, breakdown };
  // Fixed monthly items still apply once when the employee only worked in one rate window.
  // Do not accidentally turn a fixed tax/recovery into an attendance-prorated deduction.
  if (activeWeight > 0 && activeWeight < 1) {
    for (const side of ["benefits", "deductions", "employerContributions"] as const) {
      for (const [key, line] of amounts[side]) {
        const monthly = monthlyAmounts.get(`${side}|${key}`) ?? 0;
        amounts[side].set(key, { ...line, amount: cents(line.amount - monthly + monthly / activeWeight) });
      }
    }
  }
  const components = [...amounts.components.values()];
  const benefits = [...amounts.benefits.values()];
  const capped = (side: "deductions" | "employerContributions") => [...amounts[side].values()].map((line) => {
    const cap = pfCaps.get(`${side}|${payrollLiabilityKey(line.name)}`);
    return cap && cap > 0 ? { ...line, payrollMonthlyCap: cents(cap) } : line;
  });
  const deductions = capped("deductions"), employerContributions = capped("employerContributions");
  const earnedGross = cents(components.reduce((s, l) => s + l.amount, 0));
  const totalDeductions = cents(deductions.reduce((s, l) => s + l.amount, 0));
  const totalEmployerContributions = cents(employerContributions.reduce((s, l) => s + l.amount, 0));
  const wages: WageComputation = { ...first, components, benefits, deductions, employerContributions, earnedGross, totalDeductions, totalEmployerContributions, netPay: Math.max(0, cents(earnedGross - totalDeductions)), employerCost: cents(earnedGross + totalEmployerContributions), totalOtAmount: cents(totalOt), otDuties: totalOtDuties };
  return { wages, issues, breakdown };
}