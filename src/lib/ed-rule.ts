/**
 * The contract resource owns the Extra Duty rule (basis, multiplier, formula
 * and which components are ticked). An employee-specific salary setup may
 * change amounts, but must never silently replace the contract's ED choice.
 */
type EdComponent = { name: string; allowanceId?: string | null; includeInOt?: boolean | null };
type EdResource = {
  components: EdComponent[];
  otBasis?: string | null;
  otMultiplier?: number | null;
  otFormula?: string | null;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export function withContractEdRule<T extends EdResource>(
  employee: T | undefined | null,
  contract: EdResource | undefined | null,
): T | undefined {
  if (!employee) return undefined;
  if (!contract) return employee;
  const byId = new Map<string, boolean>();
  const byName = new Map<string, boolean>();
  for (const c of contract.components) {
    const on = c.includeInOt !== false;
    if (c.allowanceId) byId.set(String(c.allowanceId), on);
    byName.set(norm(c.name), on);
  }
  return {
    ...employee,
    otBasis: contract.otBasis ?? "components",
    otMultiplier: contract.otMultiplier ?? 1,
    otFormula: contract.otFormula ?? null,
    components: employee.components.map((c) => {
      const on = (c.allowanceId && byId.get(String(c.allowanceId))) ?? byName.get(norm(c.name));
      // Components the contract doesn't have are left out of ED.
      return { ...c, includeInOt: on ?? false };
    }),
  };
}
