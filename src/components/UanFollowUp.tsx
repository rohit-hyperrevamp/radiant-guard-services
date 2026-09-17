import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type MissingUan = { id: string; full_name: string; employee_code: string | null; candidate_code: string | null; unit_id: string | null; preferred_joining_date: string | null; created_at: string; compliance: Record<string, unknown> | null };

function dayAge(row: MissingUan) {
  const c = row.compliance ?? {};
  const source = String(c.uan_missing_since ?? row.preferred_joining_date ?? row.created_at).slice(0, 10);
  const start = new Date(`${source}T00:00:00`).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.floor((today.getTime() - start) / 86400000));
  const due = new Date(start + 7 * 86400000).toISOString().slice(0, 10);
  return { source, due, days };
}

export function UanFollowUp({ fieldOfficerUserId, fieldOfficerCandidateId, compact = false }: { fieldOfficerUserId?: string | null; fieldOfficerCandidateId?: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const scoped = Boolean(fieldOfficerUserId || fieldOfficerCandidateId);
  const q = useQuery({
    queryKey: ["uan-follow-up", fieldOfficerUserId ?? "hr", fieldOfficerCandidateId ?? "all"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      let query = supabase.from("candidates").select("id,full_name,employee_code,candidate_code,unit_id,preferred_joining_date,created_at,compliance").eq("is_enabled", true).in("status", ["active", "approved"]);
      if (scoped) {
        const filters = [fieldOfficerUserId ? `created_by.eq.${fieldOfficerUserId}` : "", fieldOfficerCandidateId ? `reports_to.eq.${fieldOfficerCandidateId}` : ""].filter(Boolean);
        if (filters.length) query = query.or(filters.join(","));
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as MissingUan[];
      const missing = rows.filter((r) => !/^1\d{11}$/.test(String(r.compliance?.uan ?? "").trim()));
      const unitIds = Array.from(new Set(missing.map((r) => r.unit_id).filter(Boolean))) as string[];
      const names = new Map<string, string>();
      if (unitIds.length) {
        const { data: units } = await supabase.from("units").select("id,name,code").in("id", unitIds);
        for (const unit of units ?? []) names.set(unit.id, `${unit.name} · ${unit.code}`);
      }
      return missing.map((row) => ({ ...row, unitName: row.unit_id ? names.get(row.unit_id) ?? "Assigned unit" : "Not posted", ...dayAge(row) }));
    },
  });
  const rows = q.data ?? [];
  const overdue = useMemo(() => rows.filter((r) => r.days >= 7).length, [rows]);
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className={cn("group flex h-auto w-full min-w-0 items-center justify-between gap-3 whitespace-normal border border-border/50 bg-[rgb(var(--tint-amber))] text-left shadow-sm transition hover:border-primary/35 hover:bg-[rgb(var(--tint-amber))] hover:shadow-md", compact ? "min-h-[104px] rounded-2xl p-3.5" : "min-h-[124px] rounded-2xl p-3 sm:min-h-[172px] sm:rounded-[26px] sm:p-5")}>
        <div className="min-w-0"><div className="text-sm font-semibold text-foreground">UAN follow-up</div><div className="mt-1 text-xs text-muted-foreground">{overdue ? `${overdue} overdue` : "Seven-day compliance"}</div><div className={cn("font-bold tabular-nums text-foreground", compact ? "mt-2 text-[25px] leading-none" : "mt-4 text-3xl")}>{q.isLoading ? "—" : rows.length}</div></div>
        <span className={cn("grid shrink-0 place-items-center bg-card/80 text-amber-700 dark:text-amber-300", compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl")}><CalendarClock className={compact ? "h-4 w-4" : "h-5 w-5"} /></span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>UAN follow-up</DialogTitle><DialogDescription>Employees without a valid UAN, tracked from onboarding.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {rows.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">All UANs are complete.</div> : rows.map((row) => {
              const tone = row.days >= 7 ? "border-destructive/30 bg-destructive/5 text-destructive" : row.days >= 4 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
              return <div key={row.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="font-semibold text-foreground">{row.full_name}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.employee_code || row.candidate_code || "Code pending"} · {row.unitName}</div><div className="mt-1 text-[11px] text-muted-foreground">Missing since {row.source} · Due {row.due}</div></div><div className="flex items-center justify-between gap-2 sm:justify-end"><span className={cn("rounded-full border px-2 py-1 text-[11px] font-semibold", tone)}>{row.days >= 7 ? `${row.days - 7}d overdue` : `${7 - row.days}d left`}</span></div></div>;
            })}
          </div>
          {q.isError && <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Could not load UAN follow-ups.</div>}
        </DialogContent>
      </Dialog>
    </>
  );
}