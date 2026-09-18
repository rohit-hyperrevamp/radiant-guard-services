import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { OPERATIONS_ROLES } from "@/lib/role-keys";

/**
 * Compliance is a governance surface — operations leadership never sees it.
 * Redirects operations roles to their dashboard; everyone else passes through.
 */
export function ComplianceAccessGate({ children }: { children: ReactNode }) {
  const { isLoading, roleKey, isSuperAdmin } = useCurrentUserRole();
  if (isLoading) return null;
  if (!isSuperAdmin && roleKey && OPERATIONS_ROLES.has(roleKey)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
