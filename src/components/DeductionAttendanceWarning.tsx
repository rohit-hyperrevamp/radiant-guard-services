import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { attendanceCountByCandidate, namesLookAlike, shiftDate } from "@/lib/deduction-attendance-check";

type Emp = { id: string; full_name: string; employee_code: string };

/**
 * Warns on the deduction form when a chosen employee has no attendance around
 * the deduction date (payroll only lists people with attendance), and offers
 * same-name records that do have attendance — the usual duplicate-record trap.
 */
export function DeductionAttendanceWarning({
  candidateIds,
  date,
  unitId,
  unitName,
  employees,
  onReplace,
}: {
  candidateIds: string[];
  date: string;
  unitId: string;
  unitName?: string;
  employees: Emp[];
  onReplace: (fromId: string, toId: string) => void;
}) {
  const ids = candidateIds.slice(0, 50);
  const from = date ? shiftDate(date, -31) : "";
  const to = date ? shiftDate(date, 31) : "";

  const q = useQuery({
    queryKey: ["deduction-attendance-check", ids.join(","), from, to, unitId],
    enabled: ids.length > 0 && !!date,
    staleTime: 30_000,
    queryFn: async () => {
      const counts = await attendanceCountByCandidate({ candidateIds: ids, from, to, unitId: unitId || null });
      const missing = ids.filter((id) => (counts.get(id) ?? 0) === 0);
      if (missing.length === 0) return [];
      const byId = new Map(employees.map((e) => [e.id, e]));
      const lookAlikes = new Map<string, Emp[]>();
      const allAlikeIds: string[] = [];
      for (const id of missing) {
        const me = byId.get(id);
        const list = me
          ? employees.filter((e) => e.id !== id && namesLookAlike(e.full_name, me.full_name)).slice(0, 15)
          : [];
        lookAlikes.set(id, list);
        allAlikeIds.push(...list.map((e) => e.id));
      }
      const alikeCounts = allAlikeIds.length
        ? await attendanceCountByCandidate({ candidateIds: allAlikeIds, from, to, unitId: unitId || null })
        : new Map<string, number>();
      return missing.map((id) => ({
        emp: byId.get(id),
        id,
        suggestions: (lookAlikes.get(id) ?? [])
          .map((e) => ({ ...e, days: alikeCounts.get(e.id) ?? 0 }))
          .filter((e) => e.days > 0),
      }));
    },
  });

  const items = q.data ?? [];
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="font-semibold">
            No attendance {unitId ? `at ${unitName || "this unit"} ` : ""}around this date — this deduction won't show on payroll
          </div>
          {items.map((it) => (
            <div key={it.id} className="rounded-lg bg-background/70 px-2.5 py-2 text-foreground">
              <div>
                <span className="font-semibold">{it.emp?.employee_code} · {it.emp?.full_name}</span> has no attendance between {from} and {to}.
              </div>
              {it.suggestions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Did you mean:</span>
                  {it.suggestions.map((s) => (
                    <Button key={s.id} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReplace(it.id, s.id)}>
                      {s.employee_code} · {s.full_name} ({s.days} days)
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
