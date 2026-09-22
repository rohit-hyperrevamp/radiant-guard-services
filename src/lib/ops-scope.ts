import { useCurrentPermissions } from "@/lib/rbac";
import { OPERATIONS_ROLES, ROLE_KEYS } from "@/lib/role-keys";

/**
 * Operations focus.
 *
 * Roles whose work is field operations (VP Operations, Operations Manager and
 * any future operations role) use the operations dashboard. Dashboard identity
 * comes from the verified role, not a temporarily stale permission shape.
 */
export function useOperationsFocus(): boolean {
  const { roleKey, isSuperAdmin } = useCurrentPermissions();
  if (isSuperAdmin) return false;
  return !!roleKey && OPERATIONS_ROLES.has(roleKey);
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
