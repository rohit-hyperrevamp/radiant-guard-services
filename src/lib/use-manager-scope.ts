import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { ROLE_KEYS } from "@/lib/role-keys";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { useFieldOfficerUnitScope } from "@/lib/use-fo-unit-scope";

/** Reporting chains are shallow; this cap only guards against cyclic data. */

export type ManagerFieldOfficerScope = {
  isLoading: boolean;
  /** True when the signed-in user has field officers reporting to them or is an HR executive for specific units. */
  isScoped: boolean;
  candidateId: string | null;
  /** Field officers anywhere below the signed-in user in the reporting chain. */
  fieldOfficerIds: Set<string>;
  /** Billable client units those field officers cover or that the user manages as HR executive. */
  unitIds: Set<string>;
  /** Organizations owning those units. */
  customerIds: Set<string>;
};

/**
 * Cumulative scope for a manager: every field officer below them in the
 * reporting chain plus the client units those officers cover. Also includes
 * units assigned to the user as an HR Executive. Super admins and
 * field officers themselves are never scoped here (field officers use
 * `useFieldOfficerUnitScope`), and a manager with no field officer reportees
 * and no HR assignments keeps their existing row-level-security reach.
 */
export function useManagerFieldOfficerScope(): ManagerFieldOfficerScope {
  const { candidateId, isSuperAdmin, isFieldOfficer, roleKey, isLoading: roleLoading } = useCurrentUserRole();
  const enabled = !!candidateId && !isSuperAdmin && !isFieldOfficer;
  const isAccounts = roleKey === ROLE_KEYS.ACCOUNTS;
  // HR Executives and Accounts see only the units assigned to them.
  const mustScope = roleKey === ROLE_KEYS.HR_EXECUTIVE || isAccounts;

  const q = useQuery({
    queryKey: ["manager-fo-scope", candidateId, roleKey],
    enabled,
    staleTime: 5 * 60_000,
    retry: 2,
    // One database call returns the whole scope (sites, organizations, field
    // officers). The old browser-side walk needed dozens of chained requests.
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)("current_user_ops_scope");
      if (error) throw new Error(error.message);
      const s = (data ?? {}) as {
        unit_ids?: string[];
        customer_ids?: string[];
        field_officer_ids?: string[];
        has_team?: boolean;
      };
      return {
        fieldOfficerIds: s.field_officer_ids ?? [],
        unitIds: s.unit_ids ?? [],
        customerIds: s.customer_ids ?? [],
        hasTeam: !!s.has_team,
      };
    },
  });

  const fieldOfficerIds = useMemo(() => new Set(q.data?.fieldOfficerIds ?? []), [q.data]);
  const unitIds = useMemo(() => new Set(q.data?.unitIds ?? []), [q.data]);
  const customerIds = useMemo(() => new Set(q.data?.customerIds ?? []), [q.data]);

  return {
    isLoading: roleLoading || (enabled && q.isLoading),
    // An HR Executive with no assignments must see zero units, never the
    // company-wide fallback used by ordinary managers with no reportees.
    isScoped: enabled && (mustScope || !!q.data?.hasTeam || fieldOfficerIds.size > 0),
    candidateId,
    fieldOfficerIds,
    unitIds,
    customerIds,
  };
}

/**
 * Unit scope for list screens: a field officer's own units, or — for a manager
 * with field officers reporting to them or an HR Executive — the units they cover.
 * `isScoped` false means the screen keeps its company-wide reach.
 */
export function useOperationalUnitScope(): {
  isLoading: boolean;
  isScoped: boolean;
  unitIds: Set<string>;
  customerIds: Set<string>;
} {
  const foScope = useFieldOfficerUnitScope();
  const managerScope = useManagerFieldOfficerScope();
  const mine = useMineFilter();
  if (foScope.isFieldOfficer) {
    return {
      isLoading: foScope.isLoading,
      isScoped: true,
      unitIds: foScope.unitIds,
      customerIds: foScope.customerIds,
    };
  }
  // Office users with module access see every record on list pages; team
  // scope only shapes the dashboard's team sections.
  return {
    isLoading: managerScope.isLoading,
    // `?mine=1` (dashboard tile links) narrows the page to the user's own clients.
    isScoped: mine && managerScope.isScoped,
    unitIds: managerScope.unitIds,
    customerIds: managerScope.customerIds,
  };
}

/** True when the URL carries `mine=1`, set by dashboard tiles to open a page filtered to the user's own clients. */
export function useMineFilter(): boolean {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr ?? "" });
  return /[?&]mine=(1|true|%221%22)(&|$)/.test(searchStr);
}
