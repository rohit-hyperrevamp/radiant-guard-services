import { useTeamPeopleOnly } from "@/lib/use-team-people";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineUserIds } from "@/lib/online-presence";

export const Route = createFileRoute("/admin/live-staff")({
  head: () => ({
    meta: [
      { title: "Live Staff | Radiant Guard Services" },
      { name: "description", content: "Who among non-billable staff is online and checked in right now." },
      { property: "og:title", content: "Live Staff | Radiant Guard Services" },
      { property: "og:description", content: "Who among non-billable staff is online and checked in right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveStaffPage,
});

type Row = {
  candidate_id: string;
  user_id: string | null;
  full_name: string;
  employee_code: string | null;
  role_key: string | null;
  department: string | null;
  designation: string | null;
  last_sign_in_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
};

const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtWhen = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
const titleCase = (s: string | null) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");

type Filter = "all" | "online" | "offline" | "in" | "notin";
const PAGE = 50;

function LiveStaffPage() {
  const qc = useQueryClient();
  const online = useOnlineUserIds();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const data = useQuery({
    queryKey: ["nonbillable-live-status"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nonbillable_live_status" as never);
      if (error) throw error;
      return (data as unknown as Row[]) ?? [];
    },
  });

  // Check-ins/outs reflect instantly.
  useEffect(() => {
    const ch = supabase
      .channel("live-staff-punches")
      .on("postgres_changes", { event: "*", schema: "public", table: "self_attendance_punches" }, () =>
        qc.invalidateQueries({ queryKey: ["nonbillable-live-status"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const team = useTeamPeopleOnly();
  void team;
  const [view, setView] = useState<"all" | "mine">("all");
  const { candidateId: myId } = useCurrentUserRole();
  const myTeam = useQuery({
    queryKey: ["live-staff-my-team", myId],
    enabled: !!myId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("candidates").select("id").eq("reports_to", myId as string),
        supabase.from("candidate_reporting_managers").select("candidate_id").eq("manager_id", myId as string),
      ]);
      return new Set<string>([
        ...((a.data ?? []) as { id: string }[]).map((r) => r.id),
        ...((b.data ?? []) as { candidate_id: string }[]).map((r) => r.candidate_id),
      ]);
    },
  });
  const myTeamIds = myTeam.data ?? new Set<string>();
  const rows = (data.data ?? []).filter((r) => view === "all" || myTeamIds.has(r.candidate_id));
  const isOnline = (r: Row) => !!r.user_id && online.has(r.user_id);
  const isIn = (r: Row) => !!r.check_in_at;
  const depts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department ?? "Unassigned"))).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (dept && (r.department ?? "Unassigned") !== dept) return false;
    if (q && !`${r.full_name} ${r.employee_code ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "online") return isOnline(r);
    if (filter === "offline") return !isOnline(r);
    if (filter === "in") return isIn(r);
    if (filter === "notin") return !isIn(r);
    return true;
  });
  filtered.sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)) || a.full_name.localeCompare(b.full_name));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const onlineCount = rows.filter(isOnline).length;
  const inCount = rows.filter(isIn).length;
  const tiles: Array<{ key: Filter; label: string; value: number; tone: string }> = [
    { key: "all", label: "Total staff", value: rows.length, tone: "text-foreground" },
    { key: "online", label: "Live now", value: onlineCount, tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "offline", label: "Not logged in", value: rows.length - onlineCount, tone: "text-destructive" },
    { key: "in", label: "Checked in today", value: inCount, tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "notin", label: "Not checked in", value: rows.length - inCount, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Staff"
        description="Non-billable staff (field officers excluded) — updates live."
        crumbs={[{ label: "Live Staff" }]}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={() => { setFilter(t.key); setPage(0); }}
            className={`rounded-xl border bg-card p-3 text-left transition-colors ${filter === t.key ? "border-accent" : "border-border hover:border-accent/40"}`}
          >
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className={`font-display text-2xl font-semibold ${t.tone}`}>{t.value}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="inline-flex rounded-md border border-input p-0.5">
          {([["all", "All staff"], ["mine", `My team (${myTeamIds.size})`]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setView(k); setPage(0); }}
              className={`rounded px-3 py-1.5 text-sm ${view === k ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={dept}
          onChange={(e) => { setDept(e.target.value); setPage(0); }}
        >
          <option value="">All departments</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2.5">Name</th>
              <th className="p-2.5">Category</th>
              <th className="p-2.5">Department</th>
              <th className="p-2.5">Designation</th>
              <th className="p-2.5">Logged in</th>
              <th className="p-2.5">Check-in</th>
              <th className="p-2.5">Check-out</th>
            </tr>
          </thead>
          <tbody>
            {data.isLoading && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {data.error && (
              <tr><td colSpan={7} className="p-4 text-center text-destructive">Couldn't load staff.</td></tr>
            )}
            {shown.map((r) => {
              const on = isOnline(r);
              return (
                <tr key={r.candidate_id} className="border-t border-border">
                  <td className="p-2.5">
                    <div className="font-medium text-foreground">{r.full_name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.employee_code ?? ""}</div>
                  </td>
                  <td className="p-2.5">{titleCase(r.role_key)}</td>
                  <td className="p-2.5">{r.department ?? "Unassigned"}</td>
                  <td className="p-2.5">{r.designation ?? "—"}</td>
                  <td className="p-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-destructive"}`} />
                      {on ? "Live now" : <span className="text-muted-foreground">Last: {fmtWhen(r.last_sign_in_at)}</span>}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${r.check_in_at ? "bg-emerald-500" : "bg-destructive"}`} />
                      {r.check_in_at ? fmtTime(r.check_in_at) : "Not checked in"}
                    </span>
                  </td>
                  <td className="p-2.5">{fmtTime(r.check_out_at)}</td>
                </tr>
              );
            })}
            {!data.isLoading && shown.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No one matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button className="rounded-md border border-border px-3 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <button className="rounded-md border border-border px-3 py-1 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
