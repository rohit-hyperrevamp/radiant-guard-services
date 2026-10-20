// Contract-owned pay lines.
//
// Any deduction / employer / wage line on a contract role can be edited on the
// contract itself (fixed amount, % of components, or formula). Once edited the
// line carries `contractOverride: true` and the Control Center master no
// longer overwrites it — in the editor, payroll or invoices. "Reset" clears it.

type AmountLine = {
  amount: number;
  roundOff?: boolean;
  unroundedAmount?: number | null;
};

type RuleLine = AmountLine & {
  calcType: "percentage" | "fixed";
  percentage: number;
  baseComponents: { label: string; operator: "+" | "-" }[];
  capAmount: number | null;
  formulaMode?: string | null;
  formulaExpression?: string | null;
  contractOverride?: boolean;
};

function withManual<T extends AmountLine>(item: T, amount: number): T {
  return item.roundOff ? { ...item, unroundedAmount: amount, amount: Math.round(amount) } : { ...item, amount };
}

/** Typing a number into a %/formula line turns it into this contract's own fixed amount. */
export function asContractManualAmount<T extends AmountLine>(item: T, amount: number): T {
  return withManual(
    { ...item, calcType: "fixed", formulaMode: null, formulaExpression: null, contractOverride: true } as T,
    amount,
  );
}

export type LineRuleMode = "fixed" | "percentage" | "formula";

export type LineRule =
  | { mode: "fixed"; amount: number }
  | { mode: "percentage"; percentage: number; bases: string[]; cap: number | null }
  | { mode: "formula"; expression: string };

/** Apply a fixed / percentage / formula rule chosen on the contract line itself. */
export function applyLineRule<T extends RuleLine>(item: T, rule: LineRule): T {
  if (rule.mode === "fixed") return asContractManualAmount(item, rule.amount);
  if (rule.mode === "percentage") {
    return {
      ...item,
      calcType: "percentage",
      percentage: rule.percentage,
      baseComponents: rule.bases.map((label) => ({ label, operator: "+" as const })),
      capAmount: rule.cap && rule.cap > 0 ? rule.cap : null,
      formulaMode: null,
      formulaExpression: null,
      contractOverride: true,
    };
  }
  return {
    ...item,
    formulaMode: "advanced",
    formulaExpression: rule.expression.trim(),
    contractOverride: true,
  };
}
