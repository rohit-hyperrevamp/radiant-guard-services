import { useCurrentPermissions } from "@/lib/rbac";
import { ROLE_KEYS } from "@/lib/role-keys";

/**
 * Operations focus.
 *
 * Roles whose work is field operations (VP Operations, Operations Manager and
 * any future subset role) hold Radar access but no payroll or invoicing. That
 * permission shape — never a hardcoded role name — decides whether the
 * operations dashboard renders instead of the finance-oriented one.
 */
export function useOperationsFocus(): boolean {
  const { can, isSuperAdmin } = useCurrentPermissions();
  if (isSuperAdmin) return false;
  return can("field_sense") && !can("payroll") && !can("invoice");
}

/**
 * People an operations leader follows: field officers and the managers they
 * report to. Used for birthdays, anniversaries and attendance lookups.
 */
export const OPS_PEOPLE_ROLE_KEYS: readonly string[] = [
  ROLE_KEYS.FIELD_OFFICER,
  ROLE_KEYS.OPERATIONS,
  ROLE_KEYS.OPERATIONS_MANAGER,
  ROLE_KEYS.VP_OPERATIONS,
];
