import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { matchesSearch } from "@/lib/search-match";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ACCENT_CHIP, ACCENT_TILE_BG } from "@/components/tile-theme";

/** Duties above this in one attendance period are flagged. */
export const COMPLIANCE_DUTY_LIMIT = 31;

type PersonRow = {
  candidate_id: string;
  employee_code: string | null;
  full_name: string | null;
  duties: number;
  present_days: number;
  ed_days: number;
  site_count: number;
  designation_count: number;
  reliever_duties: number;
};

type BreakdownRow = {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  customer_name: string | null;
  period_start: string;
  period_end: string;
  designation: string;
  is_reliever: boolean;
  present_days: number;
  ed_days: number;
  duties: number;
  first_date: string | null;
  last_date: string | null;
};

const fmt = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};
const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "—";

/**
 * Compliance box for the attendance page: people whose Present + Extra Duty in the
 * selected window/month exceed 31 duties, across all sites they worked. Counts come
 * from `attendance_compliance_people` / `attendance_compliance_person` (invoker RLS,
 * so scoped users see only their own sites).
 */
export function AttendanceComplianceBox({
  year,
  monthIdx,
  windowKey,
  windowLabel,
  variant = "row",
}: {
  year: number;
  monthIdx: number;
  /** Page window key ("21-20") or "all". */
  windowKey: string;
  windowLabel: string;
  /** "tile" renders a square charter tile (sits beside Organizations / Clients / Attendance). */
  variant?: "row" | "tile";
}) {
  const session = useHasSupabaseSession();
  const month = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [expanded, setExpanded] = useState<string | null>(null);

  const peopleQ = useQuery({
    queryKey: ["attendance-compliance-people", month, windowKey, COMPLIANCE_DUTY_LIMIT],
    enabled: session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "attendance_compliance_people" as never,
        {
          _month: month,
          _window: windowKey || "all",
          _min: COMPLIANCE_DUTY_LIMIT,
        } as never,
      );
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  const people = useMemo(() => peopleQ.data ?? [], [peopleQ.data]);
  const filtered = useMemo(
    () => people.filter((p) => matchesSearch(deferredQ, [p.full_name, p.employee_code])),
    [people, deferredQ],
  );
  const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const count = people.length;

  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={peopleQ.isLoading}
          data-panel="true"
          className={`dashboard-summary-tile group relative flex h-[124px] min-w-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/40 p-3 text-left transition-colors sm:h-[172px] sm:rounded-[26px] sm:p-5 ${ACCENT_TILE_BG[count > 0 ? "rose" : "emerald"]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="dashboard-tile-title font-display text-[12px] font-medium leading-tight text-foreground sm:text-[15px]">
                Compliance
              </div>
              <div className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
                more than {COMPLIANCE_DUTY_LIMIT} duties in the period
              </div>
            </div>
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ring-inset sm:h-9 sm:w-9 ${ACCENT_CHIP[count > 0 ? "rose" : "emerald"]}`}
            >
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2">
            <span className="font-display text-[26px] font-medium leading-none tabular-nums text-foreground sm:text-[40px]">
              {peopleQ.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : peopleQ.isError ? (
                "—"
              ) : (
                count
              )}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
              people <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={peopleQ.isLoading}
          className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 sm:rounded-2xl"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              count > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Compliance
            </span>
            <span className="block text-sm text-foreground">
              People with more than {COMPLIANCE_DUTY_LIMIT} duties · {monthLabel} · {windowLabel}
            </span>
          </span>
          <span className="font-display text-2xl font-bold tabular-nums text-foreground">
            {peopleQ.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : peopleQ.isError ? (
              "—"
            ) : (
              count
            )}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>Compliance · more than {COMPLIANCE_DUTY_LIMIT} duties</DialogTitle>
            <DialogDescription>
              {monthLabel} · {windowLabel}. Duties = Present + Extra Duty across every site, each
              site on its own attendance period. Click a person to see where and as what they
              worked.
            </DialogDescription>
          </DialogHeader>
          <div
            className="space-y-3 overflow-y-auto px-5 py-4"
            style={{ maxHeight: "calc(90vh - 7rem)" }}
          >
            {peopleQ.isError ? (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {peopleQ.error instanceof Error
                  ? peopleQ.error.message
                  : "Could not load compliance right now."}
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${count} people by name or employee ID`}
                    className="pl-9"
                  />
                </div>
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {count === 0
                      ? `No one has more than ${COMPLIANCE_DUTY_LIMIT} duties in this period.`
                      : "No match."}
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                    <div className="hidden grid-cols-[1fr_5rem_5rem_5rem_4rem] gap-2 bg-secondary/40 px-3 py-2 text-xs font-semibold text-muted-foreground sm:grid">
                      <span>Employee</span>
                      <span className="text-right">Duties</span>
                      <span className="text-right">Present</span>
                      <span className="text-right">Extra Duty</span>
                      <span className="text-right">Sites</span>
                    </div>
                    {filtered.map((p) => (
                      <PersonItem
                        key={p.candidate_id}
                        person={p}
                        month={month}
                        windowKey={windowKey}
                        open={expanded === p.candidate_id}
                        onToggle={() =>
                          setExpanded((cur) => (cur === p.candidate_id ? null : p.candidate_id))
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PersonItem({
  person,
  month,
  windowKey,
  open,
  onToggle,
}: {
  person: PersonRow;
  month: string;
  windowKey: string;
  open: boolean;
  onToggle: () => void;
}) {
  const detailQ = useQuery({
    queryKey: ["attendance-compliance-person", person.candidate_id, month, windowKey],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "attendance_compliance_person" as never,
        {
          _cand: person.candidate_id,
          _month: month,
          _window: windowKey || "all",
        } as never,
      );
      if (error) throw error;
      return (data ?? []) as BreakdownRow[];
    },
  });
  const rows = detailQ.data ?? [];
  const regular = rows.filter((r) => !r.is_reliever).reduce((s, r) => s + Number(r.duties), 0);
  const reliever = rows.filter((r) => r.is_reliever).reduce((s, r) => s + Number(r.duties), 0);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/30 sm:grid-cols-[1fr_5rem_5rem_5rem_4rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {person.full_name || "—"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {person.employee_code || "No ID"}
              <span className="sm:hidden">
                {" "}
                · P {fmt(person.present_days)} · ED {fmt(person.ed_days)} · {person.site_count} site
                {person.site_count === 1 ? "" : "s"}
              </span>
            </span>
          </span>
        </span>
        <span className="text-right text-sm font-bold tabular-nums text-destructive">
          {fmt(person.duties)}
        </span>
        <span className="hidden text-right text-sm tabular-nums sm:block">
          {fmt(person.present_days)}
        </span>
        <span className="hidden text-right text-sm tabular-nums sm:block">
          {fmt(person.ed_days)}
        </span>
        <span className="hidden text-right text-sm tabular-nums sm:block">{person.site_count}</span>
      </button>
      {open && (
        <div className="bg-secondary/20 px-3 pb-3 pt-1">
          {detailQ.isLoading ? (
            <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading where this person worked…
            </p>
          ) : detailQ.isError ? (
            <p className="py-3 text-xs text-destructive">
              {detailQ.error instanceof Error
                ? detailQ.error.message
                : "Could not load the breakdown."}
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Regular duty: {fmt(regular)}</Badge>
                <Badge
                  variant="outline"
                  className="border-amber-500/50 text-amber-700 dark:text-amber-400"
                >
                  Reliever: {fmt(reliever)}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border/60">
                      <th className="py-1.5 pr-2 text-left font-semibold">Site</th>
                      <th className="py-1.5 pr-2 text-left font-semibold">Designation</th>
                      <th className="py-1.5 pr-2 text-left font-semibold">As</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Present</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Extra Duty</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Duties</th>
                      <th className="py-1.5 text-left font-semibold">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={`${r.unit_id}-${r.designation}-${r.is_reliever}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="py-1.5 pr-2">
                          <span className="block font-medium text-foreground">
                            {r.unit_code} · {r.unit_name}
                          </span>
                          <span className="block text-muted-foreground">
                            {r.customer_name ?? ""} · period {fmtDate(r.period_start)}–
                            {fmtDate(r.period_end)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">{r.designation}</td>
                        <td className="py-1.5 pr-2">
                          {r.is_reliever ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Reliever
                            </span>
                          ) : (
                            <span className="font-semibold text-foreground">Duty</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {fmt(r.present_days)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(r.ed_days)}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">
                          {fmt(r.duties)}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {fmtDate(r.first_date)} – {fmtDate(r.last_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
