import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MapPin, Network, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { ROLE_KEYS } from "@/lib/role-keys";

/** Roles that make up the operations chain, top to bottom. */
const OPS_TREE_ROLES: readonly string[] = [
  ROLE_KEYS.VP_OPERATIONS,
  ROLE_KEYS.OPERATIONS_MANAGER,
  ROLE_KEYS.BRANCH_MANAGER,
  ROLE_KEYS.OPERATIONS,
  ROLE_KEYS.FIELD_OFFICER,
];

type PersonRow = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  role_key: string | null;
  reports_to: string | null;
  designation_id: string | null;
};

type Person = PersonRow & { designation: string | null; sites: number };

type Tree = { people: Map<string, Person>; roots: Person[]; childrenOf: Map<string, Person[]>; orphans: Person[] };

async function loadTree(): Promise<Tree> {
  const [rows, designations, activeUnits] = await Promise.all([
    fetchAllPages<PersonRow>((from, to) =>
      supabase
        .from("candidates")
        .select("id, full_name, employee_code, role_key, reports_to, designation_id")
        .in("role_key", OPS_TREE_ROLES as string[])
        .in("status", ["approved", "active"])
        .range(from, to)
        .order("full_name"),
    ),
    fetchAllPages<{ id: string; name: string | null }>((from, to) =>
      supabase.from("designations").select("id, name").range(from, to),
    ),
    fetchAllPages<{ id: string }>((from, to) =>
      supabase.from("units").select("id").eq("status", "active").range(from, to),
    ),
  ]);

  const links = await fetchInChunks<{ candidate_id: string; unit_id: string }>(
    rows.map((r) => r.id),
    (chunk, from, to) =>
      supabase.from("candidate_units").select("candidate_id, unit_id").in("candidate_id", chunk).range(from, to),
  );

  const activeIds = new Set(activeUnits.map((u) => u.id));
  const siteCount = new Map<string, Set<string>>();
  for (const l of links) {
    if (!activeIds.has(l.unit_id)) continue;
    const set = siteCount.get(l.candidate_id) ?? new Set<string>();
    set.add(l.unit_id);
    siteCount.set(l.candidate_id, set);
  }

  const designationName = new Map<string, string>();
  for (const d of designations) designationName.set(d.id, d.name ?? "");

  const people = new Map<string, Person>();
  for (const r of rows) {
    people.set(r.id, {
      ...r,
      designation: r.designation_id ? designationName.get(r.designation_id) ?? null : null,
      sites: siteCount.get(r.id)?.size ?? 0,
    });
  }

  const childrenOf = new Map<string, Person[]>();
  const roots: Person[] = [];
  const orphans: Person[] = [];
  for (const p of people.values()) {
    if (p.reports_to && people.has(p.reports_to)) {
      childrenOf.set(p.reports_to, [...(childrenOf.get(p.reports_to) ?? []), p]);
    } else if (p.role_key === ROLE_KEYS.VP_OPERATIONS) {
      roots.push(p);
    } else {
      orphans.push(p);
    }
  }
  const rank = (p: Person) => OPS_TREE_ROLES.indexOf(p.role_key ?? "");
  const sortFn = (a: Person, b: Person) =>
    rank(a) - rank(b) || b.sites - a.sites || (a.full_name ?? "").localeCompare(b.full_name ?? "");
  for (const [k, v] of childrenOf) childrenOf.set(k, [...v].sort(sortFn));
  roots.sort(sortFn);
  orphans.sort(sortFn);

  return { people, roots, childrenOf, orphans };
}

function Node({
  person,
  childrenOf,
  depth,
}: {
  person: Person;
  childrenOf: Map<string, Person[]>;
  depth: number;
}) {
  const kids = childrenOf.get(person.id) ?? [];
  const [open, setOpen] = useState(depth < 2);
  const isFo = person.role_key === ROLE_KEYS.FIELD_OFFICER;

  return (
    <li className="relative pl-4 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-border/70 last:before:h-4">
      <div className="relative flex items-start gap-2 py-1.5 before:absolute before:-left-4 before:top-4 before:h-px before:w-4 before:bg-border/70">
        {kids.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 rounded-md border border-border/60 bg-background p-0.5 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="mt-2 ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={isFo ? "text-sm text-foreground" : "text-sm font-semibold text-foreground"}>
              {person.full_name ?? "—"}
            </span>
            {person.employee_code && (
              <span className="text-[11px] tabular-nums text-muted-foreground">{person.employee_code}</span>
            )}
            {person.sites > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {person.sites}
              </span>
            )}
            {kids.length > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {kids.length} reporting
              </span>
            )}
          </div>
          {person.designation && (
            <div className="text-[11px] text-muted-foreground">{person.designation}</div>
          )}
        </div>
      </div>
      {open && kids.length > 0 && (
        <ul className="ml-2">
          {kids.map((k) => (
            <Node key={k.id} person={k} childrenOf={childrenOf} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Operations org chart — AVP / VP Operations on top, their reporting heads with
 * designation, and each head's field officers underneath with the count of
 * active client sites they cover.
 */
export function OperationsOrgTree() {
  const q = useQuery({ queryKey: ["ops-org-tree"], staleTime: 5 * 60_000, queryFn: loadTree });
  const data = q.data;

  const totals = useMemo(() => {
    if (!data) return { fos: 0, heads: 0, unattached: 0 };
    let fos = 0;
    let heads = 0;
    for (const p of data.people.values()) {
      if (p.role_key === ROLE_KEYS.FIELD_OFFICER) fos += 1;
      else heads += 1;
    }
    const unattached = data.orphans.filter((p) => p.role_key === ROLE_KEYS.FIELD_OFFICER).length;
    return { fos, heads, unattached };
  }, [data]);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Organizational tree
          </div>
          <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
            <Network className="h-4 w-4 text-muted-foreground" />
            Operations
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5">
            <Users className="h-3 w-3" />
            {totals.fos} field officers
          </span>
          <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5">
            {totals.heads} heads
          </span>
          {totals.unattached > 0 && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-600">
              {totals.unattached} without a head
            </span>
          )}
        </div>
      </header>

      <div className="px-4 py-3">
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-muted/60" />
            ))}
          </div>
        ) : !data || data.roots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No operations hierarchy recorded yet.</p>
        ) : (
          <ul className="-ml-4">
            {data.roots.map((r) => (
              <Node key={r.id} person={r} childrenOf={data.childrenOf} depth={0} />
            ))}
          </ul>
        )}

        {data && data.orphans.length > 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Not attached to a reporting head
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {data.orphans.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-foreground"
                >
                  {p.full_name ?? "—"}
                  {p.employee_code ? ` · ${p.employee_code}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
