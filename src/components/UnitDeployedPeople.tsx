import { useQuery } from "@tanstack/react-query";
import { Building2, Shield, UserCog, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  resolveFieldOfficersForUnit,
  resolveGuardsForUnit,
  useCandidateUnits,
  useEmployeesLite,
  useScopeAssignments,
} from "@/lib/deployment";

type StaffRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  candidate_code: string | null;
  unit_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  reports_to: string | null;
};

/** All approved/active people + department & designation names, for hierarchy views. */
function useStaffDirectory() {
  return useQuery({
    queryKey: ["admin", "staff-directory"],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: people, error }, { data: depts }, { data: desigs }] = await Promise.all([
        supabase
          .from("candidates" as never)
          .select("id,full_name,employee_code,candidate_code,unit_id,department_id,designation_id,reports_to")
          .in("status", ["approved", "active"])
          .limit(3000),
        supabase.from("departments" as never).select("id,name").limit(500),
        supabase.from("designations" as never).select("id,name").limit(1000),
      ]);
      if (error) throw error;
      return {
        people: ((people as unknown) as StaffRow[]) ?? [],
        deptName: new Map(
          (((depts as unknown) as Array<{ id: string; name: string }>) ?? []).map((d) => [d.id, d.name]),
        ),
        desigName: new Map(
          (((desigs as unknown) as Array<{ id: string; name: string }>) ?? []).map((d) => [d.id, d.name]),
        ),
      };
    },
  });
}

/**
 * Full department → designation → person hierarchy for a non-billable unit,
 * including each person's reporting manager.
 */
function NonBillableHierarchy({ unitId, className = "" }: { unitId: string; className?: string }) {
  const dir = useStaffDirectory();
  const cu = useCandidateUnits();

  if (dir.isLoading || cu.isLoading) {
    return <div className={`text-[11px] text-muted-foreground ${className}`}>Loading hierarchy…</div>;
  }

  const people = dir.data?.people ?? [];
  const mapped = new Set((cu.data ?? []).filter((c) => c.unit_id === unitId).map((c) => c.candidate_id));
  const staff = people.filter((p) => p.unit_id === unitId || mapped.has(p.id));

  if (staff.length === 0) {
    return (
      <div className={`text-[11px] italic text-muted-foreground ${className}`}>
        No one onboarded under this client yet.
      </div>
    );
  }

  const nameById = new Map(people.map((p) => [p.id, p.full_name]));
  const deptName = dir.data?.deptName ?? new Map<string, string>();
  const desigName = dir.data?.desigName ?? new Map<string, string>();

  const groups = new Map<string, StaffRow[]>();
  for (const p of staff) {
    const key = p.department_id ? deptName.get(p.department_id) ?? "Unassigned department" : "Unassigned department";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-3 w-3" /> {staff.length} onboarded · {sorted.length} department
        {sorted.length === 1 ? "" : "s"}
      </div>
      {sorted.map(([dept, rows]) => (
        <div key={dept}>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <Building2 className="h-3 w-3" /> {dept} ({rows.length})
          </div>
          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-dashed border-border pl-3">
            {rows
              .slice()
              .sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map((p) => {
                const title = p.designation_id ? desigName.get(p.designation_id) ?? "" : "";
                const mgr = p.reports_to ? nameById.get(p.reports_to) : "";
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                    <span className="font-semibold text-foreground">{p.full_name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.employee_code || p.candidate_code || ""}
                    </span>
                    {title && (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {title}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {mgr ? `→ reports to ${mgr}` : "→ no reporting manager"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact, read-only listing of people deployed to a unit.
 *  • Billable units: Field Officers + Security Guards
 *  • Non-billable units: full department → designation → person hierarchy
 */
export function UnitDeployedPeople({
  unitId,
  branchId,
  customerId,
  stateName,
  isBillable = true,
  className = "",
}: {
  unitId: string;
  branchId: string | null;
  customerId: string | null;
  stateName: string;
  isBillable?: boolean;
  className?: string;
}) {
  const sa = useScopeAssignments();
  const emp = useEmployeesLite();
  const cu = useCandidateUnits();

  const loading = sa.isLoading || emp.isLoading || cu.isLoading;
  const assignments = sa.data ?? [];
  const employees = emp.data ?? [];
  const candidateUnits = cu.data ?? [];

  if (!isBillable) {
    return <NonBillableHierarchy unitId={unitId} className={className} />;
  }

  const ctx = { id: unitId, branch_id: branchId, customer_id: customerId, state_name: stateName };
  const fms = resolveFieldOfficersForUnit(ctx, assignments, employees, candidateUnits);
  const guards = resolveGuardsForUnit(ctx, employees, assignments, candidateUnits);

  if (loading) {
    return <div className={`text-[11px] text-muted-foreground ${className}`}>Loading deployment…</div>;
  }

  if (fms.length === 0 && guards.length === 0) {
    return (
      <div className={`text-[11px] italic text-muted-foreground ${className}`}>
        No one deployed yet.
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
          <UserCog className="h-3 w-3" /> Field officers ({fms.length})
        </div>
        {fms.length === 0 ? (
          <div className="ml-4 text-[11px] italic text-muted-foreground">None mapped.</div>
        ) : (
          <ul className="ml-4 space-y-0.5">
            {fms.map(({ fm }) => (
              <li key={fm.id} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-foreground">{fm.full_name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{fm.employee_code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <Shield className="h-3 w-3" /> Security guards ({guards.length})
        </div>
        {guards.length === 0 ? (
          <div className="ml-4 text-[11px] italic text-muted-foreground">None deployed.</div>
        ) : (
          <ul className="ml-4 space-y-0.5">
            {guards.map((g) => {
              const mgr = employees.find((e) => e.id === g.reports_to);
              return (
                <li key={g.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-foreground">{g.full_name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{g.employee_code}</span>
                  {mgr && (
                    <span className="text-[10px] text-muted-foreground">→ {mgr.full_name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
