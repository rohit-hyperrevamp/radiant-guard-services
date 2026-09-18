import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MapPin, Network, RotateCcw, Shield, Users, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchInChunks } from "@/lib/supabase-batch";
import { ROLE_KEYS } from "@/lib/role-keys";
import { Button } from "@/components/ui/button";

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
type Guard = { id: string; full_name: string | null; employee_code: string | null; reports_to: string | null };

type Tree = {
  people: Map<string, Person>;
  roots: Person[];
  childrenOf: Map<string, Person[]>;
  orphans: Person[];
  guardsOf: Map<string, Guard[]>;
  guardTotal: number;
};

type ZoomLevel = 75 | 90 | 100 | 110;

const ZOOM_LEVELS: ZoomLevel[] = [75, 90, 100, 110];
const ZOOM_CLASSES: Record<ZoomLevel, string> = {
  75: "[zoom:.75]",
  90: "[zoom:.9]",
  100: "[zoom:1]",
  110: "[zoom:1.1]",
};

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

  const fieldOfficerIds = rows.filter((r) => r.role_key === ROLE_KEYS.FIELD_OFFICER).map((r) => r.id);
  const guards = fieldOfficerIds.length
    ? await fetchInChunks<Guard>(fieldOfficerIds, (chunk, from, to) =>
        supabase
          .from("candidates")
          .select("id, full_name, employee_code, reports_to")
          .eq("role_key", ROLE_KEYS.GUARD)
          .eq("status", "active")
          .in("reports_to", chunk)
          .order("full_name")
          .range(from, to),
      )
    : [];

  const guardsOf = new Map<string, Guard[]>();
  for (const g of guards) {
    if (!g.reports_to) continue;
    guardsOf.set(g.reports_to, [...(guardsOf.get(g.reports_to) ?? []), g]);
  }

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

  return { people, roots, childrenOf, orphans, guardsOf, guardTotal: guards.length };
}

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "sky" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === "sky"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "border-border/60 bg-muted/50 text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

/** A card in the centred tree. Field officers can expand to reveal their guards. */
function TreeCard({
  person,
  guards,
  emphasis,
}: {
  person: Person;
  guards: Guard[];
  emphasis: "top" | "head" | "officer";
}) {
  const [open, setOpen] = useState(false);
  const size =
    emphasis === "top"
      ? "px-4 py-3 text-sm"
      : emphasis === "head"
        ? "px-3 py-2 text-[13px]"
        : "px-2.5 py-1.5 text-[12px]";
  const shell =
    emphasis === "top"
      ? "border-foreground/25 bg-foreground/[0.04] shadow-sm"
      : emphasis === "head"
        ? "border-border/70 bg-card"
        : "border-border/50 bg-background";

  return (
    <div className={`rounded-xl border ${shell} ${size}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center">
        <span className="font-semibold text-foreground">{person.full_name ?? "—"}</span>
        {person.employee_code && <span className="text-[11px] tabular-nums text-muted-foreground">{person.employee_code}</span>}
        {person.sites > 0 && (
          <Chip>
            <MapPin className="h-2.5 w-2.5" />
            {person.sites}
          </Chip>
        )}
        {guards.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            className="h-auto rounded-full p-0 focus-visible:ring-1"
            aria-label={`${open ? "Hide" : "Show"} guards reporting to ${person.full_name ?? "field officer"}`}
          >
            <Chip tone="sky">
              <Shield className="h-2.5 w-2.5" />
              {guards.length} guards
              {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            </Chip>
          </Button>
        )}
      </div>
      {person.designation && (
        <div className="mt-0.5 text-center text-[11px] text-muted-foreground">{person.designation}</div>
      )}
      {open && guards.length > 0 && (
        <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto rounded-lg bg-muted/40 p-2 text-left">
          {guards.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-foreground/90">{g.full_name ?? "—"}</span>
              {g.employee_code && <span className="shrink-0 tabular-nums text-muted-foreground">{g.employee_code}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LevelRow({
  label,
  people,
  tree,
  emphasis,
}: {
  label: string;
  people: Person[];
  tree: Tree;
  emphasis: "top" | "head" | "officer";
}) {
  if (people.length === 0) return null;

  return (
    <div className="pt-6 first:pt-0">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-px flex-1 bg-border/60" />
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2">
        {people.map((person) => {
          const manager = person.reports_to ? tree.people.get(person.reports_to) : undefined;
          return (
            <div key={person.id} className="min-w-0">
              <TreeCard person={person} guards={tree.guardsOf.get(person.id) ?? []} emphasis={emphasis} />
              {manager && (
                <div className="mt-1 truncate text-center text-[9px] text-muted-foreground">
                  Reports to {manager.full_name ?? "—"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Operations org chart — VP Operations centred at the top, reporting heads
 * fanned out left and right beneath, then their field officers, and each field
 * officer expandable to the guards reporting into them.
 */
export function OperationsOrgTree() {
  const q = useQuery({ queryKey: ["ops-org-tree", "levelled-v2"], staleTime: 5 * 60_000, queryFn: loadTree });
  const data = q.data;
  const [zoom, setZoom] = useState<ZoomLevel>(90);

  const levels = useMemo(() => {
    const all = data ? [...data.people.values()] : [];
    const byName = (a: Person, b: Person) => (a.full_name ?? "").localeCompare(b.full_name ?? "");
    const managerRoles: readonly string[] = [
      ROLE_KEYS.OPERATIONS_MANAGER,
      ROLE_KEYS.BRANCH_MANAGER,
      ROLE_KEYS.OPERATIONS,
    ];
    return {
      leadership: all.filter((person) => person.role_key === ROLE_KEYS.VP_OPERATIONS).sort(byName),
      managers: all.filter((person) => managerRoles.includes(person.role_key ?? "")).sort(byName),
      officers: all.filter((person) => person.role_key === ROLE_KEYS.FIELD_OFFICER).sort(byName),
    };
  }, [data]);

  const changeZoom = (direction: -1 | 1) => {
    const current = ZOOM_LEVELS.indexOf(zoom);
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, current + direction));
    setZoom(ZOOM_LEVELS[next]);
  };

  const totals = useMemo(() => {
    if (!data) return { fos: 0, heads: 0, unattached: 0, guards: 0 };
    let fos = 0;
    let heads = 0;
    for (const p of data.people.values()) {
      if (p.role_key === ROLE_KEYS.FIELD_OFFICER) fos += 1;
      else heads += 1;
    }
    const unattached = data.orphans.filter((p) => p.role_key === ROLE_KEYS.FIELD_OFFICER).length;
    return { fos, heads, unattached, guards: data.guardTotal };
  }, [data]);

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Organizational tree
          </div>
          <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
            <Network className="h-4 w-4 text-muted-foreground" />
            Operations
          </h3>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5">
            <Users className="h-3 w-3" />
            {totals.fos} field officers
          </span>
          <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5">{totals.heads} heads</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">
            <Shield className="h-3 w-3" />
            {totals.guards} guards linked
          </span>
          {totals.unattached > 0 && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-600">
              {totals.unattached} without a head
            </span>
          )}
          <div className="ml-1 inline-flex shrink-0 items-center rounded-lg border border-border/60 bg-background p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => changeZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]} aria-label="Zoom out organizational tree" title="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-9 text-center text-[10px] tabular-nums">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label="Zoom in organizational tree" title="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(90)} disabled={zoom === 90} aria-label="Reset organizational tree zoom" title="Reset zoom">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-4">
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-muted/60" />
            ))}
          </div>
        ) : !data || data.roots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No operations hierarchy recorded yet.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className={`min-w-[900px] ${ZOOM_CLASSES[zoom]}`}>
              <LevelRow label="Operations leadership" people={levels.leadership} tree={data} emphasis="top" />
              <LevelRow label="Operations managers & branch heads" people={levels.managers} tree={data} emphasis="head" />
              <LevelRow label="Field officers" people={levels.officers} tree={data} emphasis="officer" />
            </div>
          </div>
        )}

        {data && data.orphans.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
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
