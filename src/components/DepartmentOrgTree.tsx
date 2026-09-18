import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, RotateCcw, Users, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabase-batch";
import { Button } from "@/components/ui/button";

type PersonRow = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  reports_to: string | null;
  designation_id: string | null;
};

type Person = PersonRow & { designation: string | null };

type ZoomLevel = 75 | 90 | 100 | 110;
const ZOOM_LEVELS: ZoomLevel[] = [75, 90, 100, 110];
const ZOOM_CLASSES: Record<ZoomLevel, string> = {
  75: "[zoom:.75]",
  90: "[zoom:.9]",
  100: "[zoom:1]",
  110: "[zoom:1.1]",
};

const DEFAULT_LABELS = ["Department head", "Managers", "Assistant managers & seniors", "Team"];

async function loadDepartmentPeople(departments: readonly string[]) {
  const { data: depts, error } = await supabase.from("departments").select("id, name").in("name", departments as string[]);
  if (error) throw error;
  const deptIds = (depts ?? []).map((d) => d.id as string);
  if (deptIds.length === 0) return [] as Person[];

  const [rows, designations] = await Promise.all([
    fetchAllPages<PersonRow>((from, to) =>
      supabase
        .from("candidates")
        .select("id, full_name, employee_code, reports_to, designation_id")
        .in("department_id", deptIds)
        .in("status", ["approved", "active"])
        .order("full_name")
        .range(from, to),
    ),
    fetchAllPages<{ id: string; name: string | null }>((from, to) =>
      supabase.from("designations").select("id, name").range(from, to),
    ),
  ]);

  const designationName = new Map<string, string>();
  for (const d of designations) designationName.set(d.id, d.name ?? "");

  return rows.map((r) => ({
    ...r,
    designation: r.designation_id ? designationName.get(r.designation_id) ?? null : null,
  }));
}

function PersonCard({ person, emphasis }: { person: Person; emphasis: "top" | "head" | "member" }) {
  const size =
    emphasis === "top" ? "px-4 py-3 text-sm" : emphasis === "head" ? "px-3 py-2 text-[13px]" : "px-2.5 py-1.5 text-[12px]";
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
        {person.employee_code && (
          <span className="text-[11px] tabular-nums text-muted-foreground">{person.employee_code}</span>
        )}
      </div>
      {person.designation && (
        <div className="mt-0.5 text-center text-[11px] text-muted-foreground">{person.designation}</div>
      )}
    </div>
  );
}

function LevelRow({
  label,
  people,
  byId,
  emphasis,
}: {
  label: string;
  people: Person[];
  byId: Map<string, Person>;
  emphasis: "top" | "head" | "member";
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
          const manager = person.reports_to ? byId.get(person.reports_to) : undefined;
          return (
            <div key={person.id} className="min-w-0">
              <PersonCard person={person} emphasis={emphasis} />
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
 * Department org chart in strict seniority levels — the same shape as the
 * operations tree, driven purely by the recorded reporting lines so no role or
 * designation order is hardcoded in the UI.
 */
export function DepartmentOrgTree({
  title,
  departments,
  labels = DEFAULT_LABELS,
}: {
  title: string;
  departments: readonly string[];
  labels?: readonly string[];
}) {
  const q = useQuery({
    queryKey: ["department-org-tree", ...departments],
    staleTime: 5 * 60_000,
    queryFn: () => loadDepartmentPeople(departments),
  });
  const [zoom, setZoom] = useState<ZoomLevel>(90);

  const { levels, byId, unattached } = useMemo(() => {
    const people = q.data ?? [];
    const map = new Map(people.map((p) => [p.id, p] as const));
    const childrenOf = new Map<string, Person[]>();
    const roots: Person[] = [];
    const loose: Person[] = [];

    for (const p of people) {
      if (p.reports_to && map.has(p.reports_to)) {
        childrenOf.set(p.reports_to, [...(childrenOf.get(p.reports_to) ?? []), p]);
      }
    }
    for (const p of people) {
      const hasManager = Boolean(p.reports_to && map.has(p.reports_to));
      if (hasManager) continue;
      if ((childrenOf.get(p.id)?.length ?? 0) > 0) roots.push(p);
      else loose.push(p);
    }

    const byName = (a: Person, b: Person) => (a.full_name ?? "").localeCompare(b.full_name ?? "");
    const rows: Person[][] = [];
    let current = [...roots].sort(byName);
    const seen = new Set<string>();
    while (current.length > 0) {
      rows.push(current);
      const next: Person[] = [];
      for (const p of current) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        next.push(...(childrenOf.get(p.id) ?? []));
      }
      current = next.filter((p) => !seen.has(p.id)).sort(byName);
    }

    return { levels: rows, byId: map, unattached: loose.sort(byName) };
  }, [q.data]);

  const changeZoom = (direction: -1 | 1) => {
    const index = ZOOM_LEVELS.indexOf(zoom);
    setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction))]);
  };

  const total = q.data?.length ?? 0;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Organizational tree</div>
          <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
            <Network className="h-4 w-4 text-muted-foreground" />
            {title}
          </h3>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5">
            <Users className="h-3 w-3" />
            {total} people
          </span>
          {unattached.length > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
              {unattached.length} without a reporting line
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-muted/60" />
            ))}
          </div>
        ) : levels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No reporting structure recorded yet.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className={`min-w-[760px] ${ZOOM_CLASSES[zoom]}`}>
              {levels.map((people, index) => (
                <LevelRow
                  key={index}
                  label={labels[index] ?? `Level ${index + 1}`}
                  people={people}
                  byId={byId}
                  emphasis={index === 0 ? "top" : index === 1 ? "head" : "member"}
                />
              ))}
            </div>
          </div>
        )}

        {unattached.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Not attached to a reporting line
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unattached.map((p) => (
                <span key={p.id} className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-foreground">
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
