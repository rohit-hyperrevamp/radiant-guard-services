import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activity-log";
import { chunkIds, namesLookAlike } from "@/lib/deduction-attendance-check";

type PayrollPerson = { id: string; employeeCode: string; name: string };

type Unapplied = {
  id: string;
  candidateId: string;
  employeeCode: string;
  fullName: string;
  name: string;
  amount: number;
  date: string;
  suggestions: PayrollPerson[];
};

/**
 * Lists deductions dated in this payroll period that cannot appear on the
 * register because the employee has no attendance here — usually because the
 * deduction was added to a duplicate record of the same person. Offers a
 * one-click move to the look-alike employee who IS on this payroll.
 */
export function UnappliedDeductionsBanner({
  unitId,
  start,
  end,
  payrollPeople,
  ready,
}: {
  unitId: string;
  start: string;
  end: string;
  payrollPeople: PayrollPerson[];
  ready: boolean;
}) {
  const qc = useQueryClient();
  const [moving, setMoving] = useState<string | null>(null);
  const onPayroll = new Set(payrollPeople.map((p) => p.id));
  const peopleKey = payrollPeople.map((p) => p.id).sort().join(",");

  const q = useQuery({
    queryKey: ["payroll-unapplied-deductions", unitId, start, end, peopleKey],
    enabled: ready && !!unitId,
    queryFn: async (): Promise<Unapplied[]> => {
      const cols = "id, candidate_id, deduction_name, amount, installments, deduction_date, source_kind";
      // 1. Deductions pinned to this unit.
      const pinned = await supabase
        .from("deductions" as never)
        .select(cols)
        .eq("unit_id", unitId)
        .eq("status", "active")
        .gte("deduction_date", start)
        .lte("deduction_date", end);
      // 2. "Any unit" deductions of people who belong to this unit.
      const [{ data: home }, { data: links }] = await Promise.all([
        supabase.from("candidates").select("id").eq("unit_id", unitId).eq("is_enabled", true).eq("status", "active"),
        supabase.from("candidate_units").select("candidate_id").eq("unit_id", unitId),
      ]);
      const memberIds = Array.from(
        new Set([...(home ?? []).map((c) => c.id as string), ...(links ?? []).map((l) => l.candidate_id as string)]),
      ).filter((id) => !onPayroll.has(id));
      const anyUnit: Record<string, unknown>[] = [];
      for (const part of chunkIds(memberIds)) {
        const { data } = await supabase
          .from("deductions" as never)
          .select(cols)
          .in("candidate_id", part)
          .is("unit_id", null)
          .eq("status", "active")
          .gte("deduction_date", start)
          .lte("deduction_date", end);
        anyUnit.push(...((data ?? []) as Record<string, unknown>[]));
      }
      const all = [...((pinned.data ?? []) as Record<string, unknown>[]), ...anyUnit].filter(
        (d) => !onPayroll.has(String(d.candidate_id)) && d.source_kind !== "payroll_run",
      );
      if (all.length === 0) return [];

      const cids = Array.from(new Set(all.map((d) => String(d.candidate_id))));
      const { data: people } = await supabase
        .from("candidates")
        .select("id, employee_code, full_name")
        .in("id", cids);
      const byId = new Map((people ?? []).map((p) => [p.id as string, p]));

      return all.map((d) => {
        const p = byId.get(String(d.candidate_id));
        const fullName = (p?.full_name as string) || "—";
        const inst = Math.max(1, Number(d.installments) || 1);
        return {
          id: String(d.id),
          candidateId: String(d.candidate_id),
          employeeCode: (p?.employee_code as string) || "",
          fullName,
          name: String(d.deduction_name ?? ""),
          amount: Math.round(((Number(d.amount) || 0) / inst) * 100) / 100,
          date: String(d.deduction_date),
          suggestions: payrollPeople.filter((pp) => namesLookAlike(pp.name, fullName)),
        };
      });
    },
  });

  const moveTo = async (d: Unapplied, target: PayrollPerson) => {
    setMoving(d.id);
    try {
      const newName =
        d.employeeCode && d.name.startsWith(d.employeeCode)
          ? `${target.employeeCode}${d.name.slice(d.employeeCode.length)}`
          : d.name;
      const { error } = await supabase
        .from("deductions" as never)
        .update({ candidate_id: target.id, deduction_name: newName } as never)
        .eq("id", d.id);
      if (error) throw error;
      void logActivity({
        module: "Deductions",
        action: "update",
        entityType: "deductions",
        entityId: d.id,
        entityLabel: `${newName} (moved from ${d.employeeCode} to ${target.employeeCode})`,
      });
      toast.success(`Moved to ${target.employeeCode} · ${target.name}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["payroll-register-compute", unitId] }),
        qc.invalidateQueries({ queryKey: ["payroll-unapplied-deductions", unitId] }),
        qc.invalidateQueries({ queryKey: ["admin", "deductions"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move the deduction");
    } finally {
      setMoving(null);
    }
  };

  const items = q.data ?? [];
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {items.length} deduction{items.length > 1 ? "s" : ""} not on this payroll
          </div>
          <p className="mt-0.5 text-xs opacity-80">
            These employees have no attendance in this period, so they don't appear below. If it was added to the
            wrong record, move it to the right person.
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((d) => (
              <li key={d.id} className="rounded-xl bg-background/70 px-3 py-2 text-xs text-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">{d.employeeCode} · {d.fullName}</span>
                    <span className="text-muted-foreground"> — {d.name} · ₹{d.amount.toLocaleString("en-IN")} · {d.date}</span>
                  </span>
                </div>
                {d.suggestions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.suggestions.map((s) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={moving === d.id}
                        onClick={() => moveTo(d, s)}
                      >
                        {moving === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        Move to {s.employeeCode} · {s.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    No one with a similar name is on this payroll — mark their attendance, or edit the deduction.
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
