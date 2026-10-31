import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SiteRow = {
  unit_id: string;
  unit_code: string | null;
  unit_name: string | null;
  period_start: string;
  period_end: string;
  present_days: number;
  ed_days: number;
  working_days: number;
  is_regular: boolean;
  is_pinned: boolean;
};

const fmtDays = (n: number) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
};
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

/**
 * Click an employee's name on the attendance sheet to see every site where
 * attendance is entered for him this month, and which site is his regular one.
 * Counts come from `attendance_employee_site_summary` (counts only, access-checked).
 */
export function EmployeeSitesPopover({
  candidateId,
  unitId,
  month,
  fullName,
  children,
}: {
  candidateId: string;
  unitId: string;
  /** First day of the attendance month (YYYY-MM-01, month of the period end). */
  month: string;
  fullName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance-employee-sites", candidateId, unitId, month],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("attendance_employee_site_summary" as never, {
        _cand: candidateId,
        _unit: unitId,
        _month: month,
      } as never);
      if (error) throw error;
      return (data ?? []) as SiteRow[];
    },
  });

  const rows = data ?? [];
  const regular = rows.find((r) => r.is_regular);
  const monthLabel = new Date(`${month}T00:00:00`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="See where this person's attendance is entered this month"
          className="inline-flex items-center gap-1 rounded text-left underline decoration-dotted underline-offset-2 hover:text-primary print:no-underline"
        >
          {children}
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground print:hidden" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 print:hidden">
        <div className="mb-2">
          <div className="text-sm font-semibold text-foreground">{fullName}</div>
          <div className="text-xs text-muted-foreground">Attendance sites · {monthLabel}</div>
        </div>
        {isLoading ? (
          <div className="py-3 text-xs text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="py-3 text-xs text-destructive">
            {error instanceof Error && /not allowed/i.test(error.message)
              ? "You don't have access to see this."
              : "Could not load the sites. Try again."}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-3 text-xs text-muted-foreground">No attendance entered for this month yet.</div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {rows.map((r) => {
                const here = r.unit_id === unitId;
                return (
                  <li
                    key={r.unit_id}
                    className={cn(
                      "rounded-md border px-2 py-1.5",
                      r.is_regular ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {r.unit_code ?? "—"}
                        {here && <span className="ml-1 font-normal text-muted-foreground">(this sheet)</span>}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold",
                          r.is_regular ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.is_regular ? (r.is_pinned ? "Regular · set by admin" : "Regular") : "Reliever (R)"}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground" title={r.unit_name ?? ""}>
                      {r.unit_name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-foreground">
                      <span>
                        <b>{r.working_days}</b> days worked
                      </span>
                      <span>P {fmtDays(r.present_days)}</span>
                      <span>ED {fmtDays(r.ed_days)}</span>
                      <span className="text-muted-foreground">
                        {fmtDate(r.period_start)}–{fmtDate(r.period_end)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {regular
                ? regular.is_pinned
                  ? `${regular.unit_code} was chosen as the regular site by a Super Admin. Other sites count as reliever (Extra Duty only).`
                  : `The site with the most days worked (${regular.unit_code}) is the regular site. Other sites count as reliever (Extra Duty only).`
                : "No regular site yet — all entries this month are reliever / Extra Duty."}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
