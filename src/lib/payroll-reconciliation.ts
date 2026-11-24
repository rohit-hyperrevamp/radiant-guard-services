/** Identifies synthetic balancing entries, not genuine arrears or statutory refunds. */
export function isPayrollReconciliationItem(item: {
  source_kind?: string | null;
  addition_name?: string | null;
  deduction_name?: string | null;
  name?: string | null;
}): boolean {
  if (/(?:^|_)recon(?:ciliation)?(?:_|$)/i.test(item.source_kind ?? "")) return true;
  return [item.addition_name, item.deduction_name, item.name].some((name) =>
    /\bpayroll[\s_-]+adjustments?\b/i.test(name ?? ""),
  );
}