import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/lib/use-current-user-role";

type ScopeAssignment = {
  candidate_id: string;
  scope_type: "state" | "customer" | "branch" | "unit";
  scope_id: string;
};

type ScopedUnit = {
  id: string;
  branch_id: string | null;
  customer_id: string | null;
  is_billable: boolean | null;
};

export type FieldOfficerUnitScope = {
  isLoading: boolean;
  /** Current user is an active field officer (and not super admin). */
  isFieldOfficer: boolean;
  /** UUIDs of every unit the FO is allowed to see. Empty set = no access. */
  unitIds: Set<string>;
  /** UUIDs of every organization (customer) the FO is allowed to see. */
  customerIds: Set<string>;
  /** Convenience: FO has zero units mapped (used to hide/blank UI). */
  hasUnits: boolean;
  /** FO candidate id for the current user, if any. */
  candidateId: string | null;
};

/**
 * Resolves the set of units a field officer is scoped to. Combines:
 *   • employee_scope_assignments (scope_type='unit')
 *   • employee_scope_assignments (scope_type='branch' / 'customer') expanded via units
 *   • legacy candidate_units rows
 *
 * Non-field-officers get { isFieldOfficer: false, unitIds: empty }.
 * Callers should gate their scoping on `isFieldOfficer`.
 */
export function useFieldOfficerUnitScope(): FieldOfficerUnitScope {
  const { isFieldOfficer, candidateId, isLoading: roleLoading } = useCurrentUserRole();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isFieldOfficer || !candidateId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["fo-scope-assignments", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["fo-candidate-units", candidateId] });
      void queryClient.invalidateQueries({ queryKey: ["fo-units-lookup", candidateId] });
    };
    const channel = supabase
      .channel(`field-officer-scope-${candidateId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_scope_assignments", filter: `candidate_id=eq.${candidateId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidate_units", filter: `candidate_id=eq.${candidateId}` },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [candidateId, isFieldOfficer, queryClient]);

  // Fetch only this officer's assignments. Reusing the admin-wide assignment
  // query could return a capped/cached list that omitted the current officer.
  const scopeQ = useQuery({
    queryKey: ["fo-scope-assignments", candidateId],
    enabled: !!candidateId && isFieldOfficer,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ScopeAssignment[]> => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("employee_scope_assignments" as never)
        .select("candidate_id,scope_type,scope_id")
        .eq("candidate_id", candidateId);
      if (error) throw error;
      return ((data as unknown) as ScopeAssignment[]) ?? [];
    },
  });

  const cuQ = useQuery({
    queryKey: ["fo-candidate-units", candidateId],
    enabled: !!candidateId && isFieldOfficer,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("candidate_units" as never)
        .select("unit_id")
        .eq("candidate_id", candidateId);
      if (error) throw error;
      return ((data as unknown) as Array<{ unit_id: string }>) ?? [];
    },
  });

  const unitsQ = useQuery({
    queryKey: ["fo-units-lookup", candidateId, scopeQ.data, cuQ.data],
    enabled: !!candidateId && isFieldOfficer && !scopeQ.isLoading && !cuQ.isLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<ScopedUnit[]> => {
      const assignments = scopeQ.data ?? [];
      const directUnitIds = new Set([
        ...assignments.filter((s) => s.scope_type === "unit").map((s) => s.scope_id),
        ...(cuQ.data ?? []).map((row) => row.unit_id),
      ]);
      const customerIds = assignments
        .filter((s) => s.scope_type === "customer")
        .map((s) => s.scope_id);
      const byId = new Map<string, ScopedUnit>();

      if (directUnitIds.size) {
        const { data, error } = await supabase
          .from("units" as never)
          .select("id,branch_id,customer_id,is_billable")
          .in("id", [...directUnitIds]);
        if (error) throw error;
        for (const unit of ((data as unknown) as ScopedUnit[]) ?? []) byId.set(unit.id, unit);
      }

      // An organization assignment includes all its billable client units.
      // Page this query so large organizations cannot silently lose units.
      if (customerIds.length) {
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from("units" as never)
            .select("id,branch_id,customer_id,is_billable")
            .in("customer_id", customerIds)
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const rows = ((data as unknown) as ScopedUnit[]) ?? [];
          for (const unit of rows) byId.set(unit.id, unit);
          if (rows.length < pageSize) break;
        }
      }

      return [...byId.values()];
    },
  });

  const unitIds = useMemo(() => {
    const set = new Set<string>();
    if (!isFieldOfficer || !candidateId) return set;
    const mine = (scopeQ.data ?? []).filter((s) => s.candidate_id === candidateId);
    // NOTE: `scope_type='branch'` on a field officer is their **Home Branch**
    // (payroll/employment marker — always Radiant's own branch). It is NOT an
    // operational scope, so we must NOT expand it into every unit under that
    // branch. Operational reach comes exclusively from explicit unit scopes,
    // customer scopes, and candidate_units rows.
    const customerIds = new Set(mine.filter((s) => s.scope_type === "customer").map((s) => s.scope_id));
    for (const s of mine) {
      if (s.scope_type === "unit") set.add(s.scope_id);
    }
    for (const cu of cuQ.data ?? []) {
      if (cu.unit_id) set.add(cu.unit_id);
    }
    if (customerIds.size) {
      for (const u of unitsQ.data ?? []) {
        if (u.customer_id && customerIds.has(u.customer_id)) set.add(u.id);
      }
    }
    // Drop Radiant's own non-billable offices: those are payroll/home units,
    // never operational work sites.
    for (const u of unitsQ.data ?? []) {
      if (u.is_billable === false) set.delete(u.id);
    }
    return set;
  }, [isFieldOfficer, candidateId, scopeQ.data, cuQ.data, unitsQ.data]);

  // Organizations the FO may see: explicit customer scopes plus the parent
  // organization of every unit they are actually mapped to.
  const customerIds = useMemo(() => {
    const set = new Set<string>();
    if (!isFieldOfficer || !candidateId) return set;
    for (const s of scopeQ.data ?? []) {
      if (s.candidate_id === candidateId && s.scope_type === "customer") set.add(s.scope_id);
    }
    for (const u of unitsQ.data ?? []) {
      if (unitIds.has(u.id) && u.customer_id) set.add(u.customer_id);
    }
    return set;
  }, [isFieldOfficer, candidateId, scopeQ.data, unitsQ.data, unitIds]);

  const isLoading = !!isFieldOfficer && (roleLoading || scopeQ.isLoading || cuQ.isLoading || unitsQ.isLoading);
  return {
    isLoading,
    isFieldOfficer: !!isFieldOfficer,
    candidateId,
    unitIds,
    customerIds,
    hasUnits: unitIds.size > 0,
  };
}
