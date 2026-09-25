// Canonical role-key constants. Import these instead of typing string literals.
// Whenever a new role is added, add it here and update RBAC seed data.

export const ROLE_KEYS = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  HR: "hr",
  HR_EXECUTIVE: "hr_executive",
  LEADERSHIP: "leadership",
  BRANCH_MANAGER: "branch_manager",
  BRANCH_ADMIN: "branch_admin",
  INVENTORY_MANAGER: "inventory_manager",
  INVENTORY: "inventory",
  TRANSPORT: "transport",
  ACCOUNTS: "accounts",
  FINANCE: "finance",
  SALES: "sales",
  MARKETING: "marketing",
  OPERATIONS: "operations",
  OPERATIONS_MANAGER: "operations_manager",
  VP_OPERATIONS: "vp_operations",
  CONTROL_CENTER_HEAD: "control_center_head",
  CONTROL_CENTER: "control_center",
  FIELD_OFFICER: "field_officer",
  GUARD: "guard",
  SECURITY_GUARD: "security_guard",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

/** Roles that reach the full admin console (as opposed to FO or guard shells). */
export const ADMIN_CONSOLE_ROLES: ReadonlySet<string> = new Set([
  ROLE_KEYS.SUPER_ADMIN,
  ROLE_KEYS.ADMIN,
  ROLE_KEYS.HR,
  ROLE_KEYS.HR_EXECUTIVE,
  ROLE_KEYS.LEADERSHIP,
  ROLE_KEYS.BRANCH_MANAGER,
  ROLE_KEYS.BRANCH_ADMIN,
  ROLE_KEYS.INVENTORY_MANAGER,
  ROLE_KEYS.INVENTORY,
  ROLE_KEYS.TRANSPORT,
  ROLE_KEYS.ACCOUNTS,
  ROLE_KEYS.FINANCE,
  ROLE_KEYS.SALES,
  ROLE_KEYS.MARKETING,
  ROLE_KEYS.OPERATIONS,
  ROLE_KEYS.OPERATIONS_MANAGER,
  ROLE_KEYS.VP_OPERATIONS,
  ROLE_KEYS.CONTROL_CENTER_HEAD,
  ROLE_KEYS.CONTROL_CENTER,
]);

/** Operations leadership team — the shared ops dashboard/RBAC subset. */
export const OPERATIONS_ROLES: ReadonlySet<string> = new Set([
  ROLE_KEYS.OPERATIONS,
  ROLE_KEYS.OPERATIONS_MANAGER,
  ROLE_KEYS.VP_OPERATIONS,
  ROLE_KEYS.CONTROL_CENTER_HEAD,
  ROLE_KEYS.CONTROL_CENTER,
]);

/** Control Center team — Radar-first dashboard. */
export const CONTROL_CENTER_ROLES: ReadonlySet<string> = new Set([
  ROLE_KEYS.CONTROL_CENTER_HEAD,
  ROLE_KEYS.CONTROL_CENTER,
]);

/** Frontline / mobile-first roles. */
export const FIELD_ROLES: ReadonlySet<string> = new Set([
  ROLE_KEYS.FIELD_OFFICER,
]);
export const GUARD_ROLES: ReadonlySet<string> = new Set([
  ROLE_KEYS.GUARD,
  ROLE_KEYS.SECURITY_GUARD,
]);

export function isAdminConsoleRole(role: string | null | undefined) {
  return !!role && ADMIN_CONSOLE_ROLES.has(role);
}
export function isFieldOfficerRole(role: string | null | undefined) {
  return !!role && FIELD_ROLES.has(role);
}
export function isGuardRole(role: string | null | undefined) {
  return !!role && GUARD_ROLES.has(role);
}
