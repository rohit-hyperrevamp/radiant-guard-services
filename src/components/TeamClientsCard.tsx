import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useManagerFieldOfficerScope } from "@/lib/use-manager-scope";
import { useCurrentUserRole } from "@/lib/use-current-user-role";

const CHUNK = 200;
const chunks = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / CHUNK) }, (_, i) => a.slice(i * CHUNK, i * CHUNK + CHUNK));
const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

type Mate = { id: string; full_name: string | null; employee_code: string | null; designation: string | null; sites: string[] };
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
  const unitIds = useMemo(() => [...scope.unitIds].sort(), [scope.unitIds]);

  const teamQ = useQuery({
    queryKey: ["team-card-mates", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      if (!candidateId) return [] as Array<Mate & { inAt: string | null }>;
      // My team = direct reports only (candidates.reports_to = me).
      const direct = await supabase.from("candidates").select("id").eq("reports_to", candidateId).in("status", ["active", "approved"]);
      if (direct.error) throw direct.error;
      const ids = new Set<string>();
      for (const r of (direct.data ?? []) as Array<{ id: string }>) ids.add(r.id);
      if (!ids.size) return [] as Array<Mate & { inAt: string | null }>;
      const [people, punches] = await Promise.all([
        supabase.from("candidates").select("id,full_name,employee_code,designation_id,role_key").in("id", [...ids]),
        supabase.from("self_attendance_punches").select("candidate_id,check_in_at").in("candidate_id", [...ids]).eq("punch_date", todayIso()),
      ]);
      if (people.error) throw people.error;
      if (punches.error) throw punches.error;
      const records = (people.data ?? []) as unknown as Array<Omit<Mate, "designation"> & { designation_id: string | null; role_key: string | null }>;
      const designationIds = [...new Set(records.flatMap((p) => p.designation_id ? [p.designation_id] : []))];
      const designationNames = new Map<string, string>();
      if (designationIds.length) {
        const { data, error } = await supabase.from("designations").select("id,name").in("id", designationIds);
        if (error) throw error;
        for (const row of data ?? []) designationNames.set(row.id, row.name);
      }
      const inAt = new Map(((punches.data ?? []) as Array<{ candidate_id: string; check_in_at: string | null }>).map((p) => [p.candidate_id, p.check_in_at]));
      const mates = records
        .filter((p) => p.role_key !== "guard" && p.role_key !== "security_guard")
        .map((p) => ({ ...p, designation: p.designation_id ? designationNames.get(p.designation_id) ?? null : null, inAt: inAt.get(p.id) ?? null }));
      // Client mapping per teammate: units where they are account/operations/HR manager, plus candidate_units rows.
      const mateIds = mates.map((m) => m.id);
      const siteMap = new Map<string, Set<string>>();
      const unitName = new Map<string, string>();
      if (mateIds.length) {
        const [managed, mapped] = await Promise.all([
          supabase.from("units").select("id,name,account_manager_id,operations_manager_id,hr_executive_id").or(`account_manager_id.in.(${mateIds.join(",")}),operations_manager_id.in.(${mateIds.join(",")}),hr_executive_id.in.(${mateIds.join(",")})`).limit(5000),
          supabase.from("candidate_units").select("candidate_id,unit_id").in("candidate_id", mateIds).limit(5000),
        ]);
        if (managed.error) throw managed.error;
        if (mapped.error) throw mapped.error;
        const add = (cid: string | null, unit: { id: string; name: string | null }) => {
          if (!cid) return;
          unitName.set(unit.id, unit.name ?? unit.id);
          if (!siteMap.has(cid)) siteMap.set(cid, new Set());
          siteMap.get(cid)!.add(unit.id);
        };
        for (const u of (managed.data ?? []) as Array<{ id: string; name: string | null; account_manager_id: string | null; operations_manager_id: string | null; hr_executive_id: string | null }>) {
          add(u.account_manager_id, u); add(u.operations_manager_id, u); add(u.hr_executive_id, u);
        }
        const extraIds = [...new Set(((mapped.data ?? []) as Array<{ unit_id: string }>).map((r) => r.unit_id).filter((id) => !unitName.has(id)))];
        if (extraIds.length) {
          const { data: extra, error: extraErr } = await supabase.from("units").select("id,name").in("id", extraIds);
          if (extraErr) throw extraErr;
          for (const u of (extra ?? []) as Array<{ id: string; name: string | null }>) unitName.set(u.id, u.name ?? u.id);
        }
        for (const r of (mapped.data ?? []) as Array<{ candidate_id: string; unit_id: string }>) {
          if (!siteMap.has(r.candidate_id)) siteMap.set(r.candidate_id, new Set());
          siteMap.get(r.candidate_id)!.add(r.unit_id);
        }
      }
      return mates.map((m) => ({
        ...m,
        sites: [...(siteMap.get(m.id) ?? [])].map((id) => unitName.get(id) ?? id).sort((a, b) => a.localeCompare(b)),
      }));
    },
  });

  const sitesQ = useQuery({
    queryKey: ["team-card-sites", unitIds],
    enabled: unitIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const units: Array<{ id: string; code: string | null; name: string | null; customer_id: string | null }> = [];
      const contracts = new Map<string, number>();
      const people = new Map<string, number>();
      const sheet = new Map<string, { s: string; p: string }>();
      for (const part of chunks(unitIds)) {
        const [u, c, p, s] = await Promise.all([
          supabase.from("units").select("id,code,name,customer_id").in("id", part),
          supabase.from("client_contracts").select("unit_id").in("unit_id", part).eq("status", "active").limit(5000),
          supabase.from("candidates").select("unit_id").in("unit_id", part).in("status", ["active", "approved"]).limit(20000),
          supabase.from("attendance_sheets").select("unit_id,status,period_end").in("unit_id", part).order("period_end", { ascending: false }).limit(5000),
        ]);
        for (const result of [u, c, p, s]) if (result.error) throw result.error;
        units.push(...((u.data ?? []) as typeof units));
        for (const r of (c.data ?? []) as Array<{ unit_id: string }>) contracts.set(r.unit_id, (contracts.get(r.unit_id) ?? 0) + 1);
        for (const r of (p.data ?? []) as Array<{ unit_id: string }>) people.set(r.unit_id, (people.get(r.unit_id) ?? 0) + 1);
        for (const r of (s.data ?? []) as Array<{ unit_id: string; status: string; period_end: string }>) {
          const cur = sheet.get(r.unit_id);
          if (!cur || r.period_end > cur.p) sheet.set(r.unit_id, { s: r.status, p: r.period_end });
        }
      }
      const custIds = [...new Set(units.map((u) => u.customer_id).filter(Boolean) as string[])];
      const orgs = new Map<string, string>();
      for (const part of chunks(custIds)) {
        const { data, error } = await supabase.from("customers").select("id,name").in("id", part);
        if (error) throw error;
        for (const r of (data ?? []) as Array<{ id: string; name: string }>) orgs.set(r.id, r.name);
      }
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
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? sites.filter((s) => `${s.code} ${s.name} ${s.org}`.toLowerCase().includes(needle))
    : sites;
  const orgCount = new Set(sites.map((s) => s.org)).size;
  const totals = {
    contracts: sites.reduce((n, s) => n + s.contracts, 0),
    people: sites.reduce((n, s) => n + s.people, 0),
    approved: sites.filter((s) => s.sheet === "approved").length,
    open: sites.filter((s) => s.sheet && s.sheet !== "approved").length,
    none: sites.filter((s) => !s.sheet).length,
  };
  const mates = teamQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">My team ({mates.length})</div>
        {teamQ.isLoading ? <div className="text-xs text-muted-foreground">Loading team…</div> : mates.length === 0 && <div className="text-xs text-muted-foreground">Nobody reports to you yet.</div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {mates.map((m) => (
            <div key={m.id} className="rounded-xl border border-border p-3">
              <div className="truncate text-sm font-medium">{m.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{m.designation ?? ""} · {m.employee_code}</div>
              <div className={`mt-1 text-xs ${m.inAt ? "text-primary" : "text-muted-foreground"}`}>
                {m.inAt ? `Checked in ${new Date(m.inAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not checked in today"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Team clients</div>
          <div className="text-xs text-muted-foreground">
            {orgCount} organizations · {sites.length} sites · {totals.contracts} active contracts · {totals.people} people · attendance {totals.approved} approved / {totals.open} open / {totals.none} not filled
          </div>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organization or site…" className="h-9 pl-8" />
        </div>
        {sitesQ.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading sites…</div>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
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
                {shown.slice(0, 300).map((s) => (
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
            {shown.length > 300 && <div className="p-2 text-xs text-muted-foreground">Showing 300 of {shown.length} — search to narrow.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
