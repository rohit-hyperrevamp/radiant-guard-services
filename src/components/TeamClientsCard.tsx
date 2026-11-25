import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useManagerFieldOfficerScope } from "@/lib/use-manager-scope";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { istAddDays, istDate } from "@/lib/dashboard-base";

const MATE_TONES = [
  "bg-rose-100/80 dark:bg-rose-500/15",
  "bg-cyan-100/80 dark:bg-cyan-500/15",
  "bg-amber-100/80 dark:bg-amber-500/15",
  "bg-emerald-100/80 dark:bg-emerald-500/15",
  "bg-violet-100/80 dark:bg-violet-500/15",
  "bg-sky-100/80 dark:bg-sky-500/15",
];
const todayIso = () => istDate();

type Mate = { id: string; full_name: string | null; employee_code: string | null; designation: string | null; sites: string[]; siteIds: string[] };
type Site = {
  id: string;
  code: string | null;
  name: string | null;
  org: string;
  contracts: number;
  people: number;
  sheet: string | null;
};

/** Team members and every client site in the manager's team view, with contract, people and attendance status. */
export function TeamClientsCard() {
  const scope = useManagerFieldOfficerScope();
  const { candidateId } = useCurrentUserRole();
  const [q, setQ] = useState("");
  const [mateId, setMateId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const unitIds = useMemo(() => [...scope.unitIds].sort(), [scope.unitIds]);

  const teamQ = useQuery({
    queryKey: ["team-card-mates", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      if (!candidateId) return [] as Array<Mate & { inAt: string | null }>;
      // My team = direct reports only (candidates.reports_to = me).
      // Every read is paged/chunked: PostgREST stops at 1,000 rows otherwise.
      const records = await fetchAllPages<Omit<Mate, "designation" | "sites" | "siteIds"> & { designation_id: string | null; role_key: string | null }>((from, to) =>
        supabase.from("candidates").select("id,full_name,employee_code,designation_id,role_key").eq("reports_to", candidateId).in("status", ["active", "approved"]).order("id").range(from, to),
      );
      if (!records.length) return [] as Array<Mate & { inAt: string | null }>;
      const ids = records.map((p) => p.id);
      const punches = await fetchInChunks<{ candidate_id: string; check_in_at: string | null }>(ids, (chunk, from, to) =>
        supabase.from("self_attendance_punches").select("id,candidate_id,check_in_at").in("candidate_id", chunk).eq("punch_date", todayIso()).order("id").range(from, to),
      );
      const designationIds = [...new Set(records.flatMap((p) => p.designation_id ? [p.designation_id] : []))];
      const designationNames = new Map<string, string>();
      if (designationIds.length) {
        const { data, error } = await supabase.from("designations").select("id,name").in("id", designationIds);
        if (error) throw error;
        for (const row of data ?? []) designationNames.set(row.id, row.name);
      }
      const inAt = new Map(punches.map((p) => [p.candidate_id, p.check_in_at]));
      const mates = records
        .filter((p) => p.role_key !== "guard" && p.role_key !== "security_guard")
        .map((p) => ({ ...p, designation: p.designation_id ? designationNames.get(p.designation_id) ?? null : null, inAt: inAt.get(p.id) ?? null }));
      // Client mapping per teammate: units where they are account/operations/HR manager, plus candidate_units rows.
      const mateIds = mates.map((m) => m.id);
      const siteMap = new Map<string, Set<string>>();
      const unitName = new Map<string, string>();
      if (mateIds.length) {
        const [managedRows, mappedRows] = await Promise.all([
          fetchInChunks<{ id: string; name: string | null; account_manager_id: string | null; operations_manager_id: string | null; hr_executive_id: string | null }>(mateIds, (chunk, from, to) =>
            supabase.from("units").select("id,name,account_manager_id,operations_manager_id,hr_executive_id").eq("status", "active").or(`account_manager_id.in.(${chunk.join(",")}),operations_manager_id.in.(${chunk.join(",")}),hr_executive_id.in.(${chunk.join(",")})`).order("id").range(from, to),
          ),
          fetchInChunks<{ candidate_id: string; unit_id: string }>(mateIds, (chunk, from, to) =>
            supabase.from("candidate_units").select("id,candidate_id,unit_id").in("candidate_id", chunk).order("id").range(from, to),
          ),
        ]);
        const managed = { data: managedRows };
        const mapped = { data: mappedRows };
        const add = (cid: string | null, unit: { id: string; name: string | null }) => {
          if (!cid) return;
          unitName.set(unit.id, unit.name ?? unit.id);
          if (!siteMap.has(cid)) siteMap.set(cid, new Set());
          siteMap.get(cid)!.add(unit.id);
        };
        for (const u of (managed.data ?? []) as unknown as Array<{ id: string; name: string | null; account_manager_id: string | null; operations_manager_id: string | null; hr_executive_id: string | null }>) {
          add(u.account_manager_id, u); add(u.operations_manager_id, u); add(u.hr_executive_id, u);
        }
        const extraIds = [...new Set(((mapped.data ?? []) as Array<{ unit_id: string }>).map((r) => r.unit_id).filter((id) => !unitName.has(id)))];
        if (extraIds.length) {
          const extra = await fetchInChunks<{ id: string; name: string | null }>(extraIds, (chunk, from, to) =>
            supabase.from("units").select("id,name").eq("status", "active").in("id", chunk).order("id").range(from, to),
          );
          for (const u of extra) unitName.set(u.id, u.name ?? u.id);
        }
        for (const r of (mapped.data ?? []) as Array<{ candidate_id: string; unit_id: string }>) {
          if (!unitName.has(r.unit_id)) continue;
          if (!siteMap.has(r.candidate_id)) siteMap.set(r.candidate_id, new Set());
          siteMap.get(r.candidate_id)!.add(r.unit_id);
        }
      }
      return mates.map((m) => ({
        ...m,
        siteIds: [...(siteMap.get(m.id) ?? [])],
        sites: [...(siteMap.get(m.id) ?? [])].map((id) => unitName.get(id) ?? id).sort((a, b) => a.localeCompare(b)),
      }));
    },
  });

  const sitesQ = useQuery({
    queryKey: ["team-card-sites", unitIds],
    enabled: unitIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Paged per chunk: a manager's people/contract/sheet rows easily pass the
      // 1,000-row cap, which silently undercounted headcount per site.
      // Latest sheet only matters: look back a few months, not the full history.
      const sheetSince = istAddDays(istDate(), -120);
      const [units, contractRows, peopleRows, sheetRows] = await Promise.all([
        fetchInChunks<{ id: string; code: string | null; name: string | null; customer_id: string | null }>(unitIds, (chunk, from, to) =>
          supabase.from("units").select("id,code,name,customer_id").eq("status", "active").in("id", chunk).order("id").range(from, to),
        ),
        fetchInChunks<{ unit_id: string }>(unitIds, (chunk, from, to) =>
          supabase.from("client_contracts").select("id,unit_id").in("unit_id", chunk).eq("status", "active").order("id").range(from, to),
        ),
        fetchInChunks<{ unit_id: string }>(unitIds, (chunk, from, to) =>
          supabase.from("candidates").select("id,unit_id").in("unit_id", chunk).in("status", ["active", "approved"]).order("id").range(from, to),
        ),
        fetchInChunks<{ unit_id: string; status: string; period_end: string }>(unitIds, (chunk, from, to) =>
          supabase.from("attendance_sheets").select("id,unit_id,status,period_end").in("unit_id", chunk).gte("period_end", sheetSince).order("id").range(from, to),
        ),
      ]);
      const contracts = new Map<string, number>();
      const people = new Map<string, number>();
      const sheet = new Map<string, { s: string; p: string }>();
      for (const r of contractRows) contracts.set(r.unit_id, (contracts.get(r.unit_id) ?? 0) + 1);
      for (const r of peopleRows) people.set(r.unit_id, (people.get(r.unit_id) ?? 0) + 1);
      for (const r of sheetRows) {
        const cur = sheet.get(r.unit_id);
        if (!cur || r.period_end > cur.p) sheet.set(r.unit_id, { s: r.status, p: r.period_end });
      }
      const custIds = [...new Set(units.map((u) => u.customer_id).filter(Boolean) as string[])];
      const orgs = new Map<string, string>();
      for (const r of await fetchInChunks<{ id: string; name: string }>(custIds, (chunk, from, to) =>
        supabase.from("customers").select("id,name").in("id", chunk).order("id").range(from, to),
      )) orgs.set(r.id, r.name);
      return units
        .map<Site>((u) => ({
          id: u.id,
          code: u.code,
          name: u.name,
          org: (u.customer_id && orgs.get(u.customer_id)) || "—",
          contracts: contracts.get(u.id) ?? 0,
          people: people.get(u.id) ?? 0,
          sheet: sheet.get(u.id)?.s ?? null,
        }))
        .sort((a, b) => a.org.localeCompare(b.org) || (a.name ?? "").localeCompare(b.name ?? ""));
    },
  });

  if (!scope.isScoped) return null;
  if (teamQ.error || sitesQ.error) return (
    <section className="space-y-2 border border-destructive/30 p-4">
      <p className="text-sm text-destructive">Team information could not load.</p>
      <Button variant="outline" size="sm" onClick={() => { void teamQ.refetch(); void sitesQ.refetch(); }}>Try again</Button>
    </section>
  );
  const sites = sitesQ.data ?? [];
  const mates = teamQ.data ?? [];
  const selected = mates.find((m) => m.id === mateId) ?? null;
  const selectedIds = selected ? new Set(selected.siteIds) : null;
  const needle = q.trim().toLowerCase();
  const shown = sites
    .filter((s) => !selectedIds || selectedIds.has(s.id))
    .filter((s) => !needle || `${s.code} ${s.name} ${s.org}`.toLowerCase().includes(needle));
  const PAGE = 10;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = shown.slice(cur * PAGE, cur * PAGE + PAGE);
  const orgCount = new Set(sites.map((s) => s.org)).size;
  const totals = {
    contracts: sites.reduce((n, s) => n + s.contracts, 0),
    people: sites.reduce((n, s) => n + s.people, 0),
    approved: sites.filter((s) => s.sheet === "approved").length,
    open: sites.filter((s) => s.sheet && s.sheet !== "approved").length,
    none: sites.filter((s) => !s.sheet).length,
  };

  return (
    <div className="space-y-4">
      {(teamQ.isLoading || mates.length > 0) && <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">My team ({mates.length}) <span className="font-normal text-xs text-muted-foreground">— tap a person to see their clients</span></div>
        {teamQ.isLoading ? <div className="text-xs text-muted-foreground">Loading team…</div> : mates.length === 0 && <div className="text-xs text-muted-foreground">Nobody reports to you yet.</div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {mates.map((m, i) => {
            const active = m.id === mateId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMateId(active ? null : m.id); setPage(0); }}
                aria-pressed={active}
                className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${MATE_TONES[i % MATE_TONES.length]} ${active ? "border-primary ring-2 ring-primary/40" : "border-border/40"}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.designation ?? ""} · <span className={m.inAt ? "text-primary" : ""}>{m.inAt ? `In ${new Date(m.inAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not checked in"}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-semibold tabular-nums">{m.siteIds.length}</div>
                  <div className="text-[10px] text-muted-foreground">clients</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {selected ? `${selected.full_name}'s clients (${selected.siteIds.length})` : "Team clients"}
            {selected && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setMateId(null); setPage(0); }}>Show whole team</Button>}
          </div>
          <div className="text-xs text-muted-foreground">
            {orgCount} organizations · {sites.length} sites · {totals.contracts} active contracts · {totals.people} people · attendance {totals.approved} approved / {totals.open} open / {totals.none} not filled
          </div>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search organization or site…" className="h-9 pl-8" />
        </div>
        {sitesQ.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading sites…</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Organization</th>
                  <th className="p-2 text-left">Site</th>
                  <th className="p-2 text-right">Contracts</th>
                  <th className="p-2 text-right">People</th>
                  <th className="p-2 text-left">Latest attendance</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (<tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">No clients mapped.</td></tr>)}
                {pageRows.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2">{s.org}</td>
                    <td className="p-2">
                      <Link to="/admin/attendance/$unitId" params={{ unitId: s.id }} className="hover:underline">
                        {s.code} · {s.name}
                      </Link>
                    </td>
                    <td className="p-2 text-right">{s.contracts}</td>
                    <td className="p-2 text-right">{s.people}</td>
                    <td className="p-2 capitalize">{s.sheet ?? <span className="text-destructive">Not filled</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border p-2 text-xs text-muted-foreground">
              <span>{shown.length ? `${cur * PAGE + 1}–${Math.min(shown.length, cur * PAGE + PAGE)} of ${shown.length}` : "0 of 0"}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
                <span>Page {cur + 1} of {pages}</span>
                <Button variant="outline" size="sm" className="h-7" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
