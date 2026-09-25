import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RANGE_PRESETS, resolveRange, type RangePreset } from "@/lib/field-visits";
import { FieldSenseRangeFilter } from "@/components/FieldSenseRangeFilter";

// ------------------------ Leaderboards ------------------------

type LbPreset = Exclude<RangePreset, "custom"> | "custom";

type FoStats = {
  candidate_id: string;
  full_name: string;
  employee_code: string | null;
  visits: number;
  ratedCount: number;
  avgRating: number | null;
  km: number;
};

type UnitStats = {
  unit_id: string;
  unit_name: string;
  customer_name: string | null;
  visits: number;
};


function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function FieldSenseLeaderboards() {
  const [preset, setPreset] = useState<LbPreset>("this_month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const resolved = useMemo(
    () => resolveRange(preset as RangePreset, customStart || null, customEnd || null),
    [preset, customStart, customEnd],
  );

  const dataQ = useQuery({
    queryKey: ["field-sense-lb", resolved.start, resolved.end],
    staleTime: 30_000,
    queryFn: async () => {
      const [foRes, visitsRes, tracksRes, unitsRes, custRes, punchesRes] = await Promise.all([
        supabase
          .from("candidates" as never)
          .select("id, full_name, employee_code")
          .eq("role_key", "field_officer")
          .in("status", ["approved", "active"]),
        supabase
          .from("field_visits" as never)
          .select("candidate_id, unit_id, customer_rating, check_in_at, check_in_lat, check_in_lng, check_out_at")
          .gte("visit_date", resolved.start)
          .lte("visit_date", resolved.end)
          .not("check_out_at", "is", null),
        supabase
          .from("field_track_points" as never)
          .select("candidate_id, track_date, lat, lng, recorded_at")
          .gte("track_date", resolved.start)
          .lte("track_date", resolved.end)
          .order("recorded_at", { ascending: true }),
        supabase.from("units" as never).select("id, name, customer_id, latitude, longitude"),
        supabase.from("customers" as never).select("id, name"),
        supabase
          .from("self_attendance_punches" as never)
          .select("candidate_id, punch_date, distance_km, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng")
          .gte("punch_date", resolved.start)
          .lte("punch_date", resolved.end),
      ]);

      const fos = ((foRes.data ?? []) as unknown) as Array<{ id: string; full_name: string; employee_code: string | null }>;
      const visits = ((visitsRes.data ?? []) as unknown) as Array<{
        candidate_id: string;
        unit_id: string;
        customer_rating: number | null;
        check_in_at: string | null;
        check_in_lat: number | string | null;
        check_in_lng: number | string | null;
      }>;
      const tracks = ((tracksRes.data ?? []) as unknown) as Array<{
        candidate_id: string;
        track_date: string;
        lat: number | string;
        lng: number | string;
      }>;
      const units = ((unitsRes.data ?? []) as unknown) as Array<{
        id: string;
        name: string;
        customer_id: string | null;
        latitude: number | string | null;
        longitude: number | string | null;
      }>;
      const customers = ((custRes.data ?? []) as unknown) as Array<{ id: string; name: string }>;
      const punches = ((punchesRes.data ?? []) as unknown) as Array<{
        candidate_id: string;
        punch_date: string;
        distance_km: number | string | null;
        check_in_at: string | null;
        check_in_lat: number | string | null;
        check_in_lng: number | string | null;
        check_out_at: string | null;
        check_out_lat: number | string | null;
        check_out_lng: number | string | null;
      }>;

      const unitById = new Map(units.map((u) => [u.id, u]));
      const custById = new Map(customers.map((c) => [c.id, c.name]));

      // FO aggregates
      const visitByCand = new Map<string, { visits: number; ratings: number[] }>();
      for (const v of visits) {
        const row = visitByCand.get(v.candidate_id) ?? { visits: 0, ratings: [] };
        row.visits += 1;
        if (v.customer_rating != null) row.ratings.push(Number(v.customer_rating));
        visitByCand.set(v.candidate_id, row);
      }

      // Distance per candidate: build day-by-day waypoints (punch-in → site
      // visits in order → punch-out), sum haversine, and apply a road factor
      // so numbers align with the FO map (which follows real roads via OSRM).
      // Fall back to raw GPS-ping haversine when waypoints are missing, and
      // always take the larger of the two so we don't undercount motion.
      const ROAD_FACTOR = 1.3;
      const isNum = (n: unknown): n is number => Number.isFinite(Number(n));
      const toPt = (lat: unknown, lng: unknown) =>
        isNum(lat) && isNum(lng) ? { lat: Number(lat), lng: Number(lng) } : null;
      const dateKey = (iso: string | null | undefined, fallback: string) =>
        iso ? iso.slice(0, 10) : fallback;

      // 1) Raw ping haversine
      const rawKmByCand = new Map<string, number>();
      const grouped = new Map<string, Array<{ lat: number; lng: number }>>();
      for (const p of tracks) {
        const key = `${p.candidate_id}|${p.track_date}`;
        const arr = grouped.get(key) ?? [];
        arr.push({ lat: Number(p.lat), lng: Number(p.lng) });
        grouped.set(key, arr);
      }
      for (const [key, pts] of grouped) {
        const cand = key.split("|")[0];
        let m = 0;
        for (let i = 1; i < pts.length; i += 1) m += haversineM(pts[i - 1], pts[i]);
        rawKmByCand.set(cand, (rawKmByCand.get(cand) ?? 0) + m / 1000);
      }

      // 2) Waypoint distance per candidate/day
      const wpKmByCand = new Map<string, number>();
      const dayBucket = new Map<string, Array<{ pt: { lat: number; lng: number }; at: number; kind: string }>>();
      const pushWp = (cand: string, day: string, pt: { lat: number; lng: number } | null, at: string | null, kind: string) => {
        if (!pt || !at) return;
        const k = `${cand}|${day}`;
        const arr = dayBucket.get(k) ?? [];
        arr.push({ pt, at: new Date(at).getTime(), kind });
        dayBucket.set(k, arr);
      };
      for (const pu of punches) {
        pushWp(pu.candidate_id, pu.punch_date, toPt(pu.check_in_lat, pu.check_in_lng), pu.check_in_at ?? pu.punch_date, "punch-in");
        pushWp(pu.candidate_id, pu.punch_date, toPt(pu.check_out_lat, pu.check_out_lng), pu.check_out_at, "punch-out");
      }
      for (const v of visits) {
        const u = unitById.get(v.unit_id);
        const site = toPt(u?.latitude, u?.longitude) ?? toPt(v.check_in_lat, v.check_in_lng);
        const day = dateKey(v.check_in_at, "");
        if (!day) continue;
        pushWp(v.candidate_id, day, site, v.check_in_at, "visit-in");
      }
      for (const [key, arr] of dayBucket) {
        const cand = key.split("|")[0];
        arr.sort((a, b) => a.at - b.at);
        let m = 0;
        for (let i = 1; i < arr.length; i += 1) m += haversineM(arr[i - 1].pt, arr[i].pt);
        wpKmByCand.set(cand, (wpKmByCand.get(cand) ?? 0) + (m * ROAD_FACTOR) / 1000);
      }

      // 3) Stored road-snapped distance from FO app (source of truth)
      const storedKmByCand = new Map<string, number>();
      for (const pu of punches) {
        const v = Number(pu.distance_km);
        if (!Number.isFinite(v) || v <= 0) continue;
        storedKmByCand.set(pu.candidate_id, (storedKmByCand.get(pu.candidate_id) ?? 0) + v);
      }

      const foStats: FoStats[] = fos.map((f) => {
        const v = visitByCand.get(f.id);
        const ratings = v?.ratings ?? [];
        const stored = storedKmByCand.get(f.id) ?? 0;
        const km = stored > 0
          ? stored
          : Math.max(rawKmByCand.get(f.id) ?? 0, wpKmByCand.get(f.id) ?? 0);
        return {
          candidate_id: f.id,
          full_name: f.full_name,
          employee_code: f.employee_code,
          visits: v?.visits ?? 0,
          ratedCount: ratings.length,
          avgRating: ratings.length ? ratings.reduce((s, x) => s + x, 0) / ratings.length : null,
          km: Number(km.toFixed(2)),
        };
      });

      // Unit aggregates — include ALL units so zero-visit units surface in "Least visited"
      const unitCount = new Map<string, number>();
      for (const v of visits) {
        unitCount.set(v.unit_id, (unitCount.get(v.unit_id) ?? 0) + 1);
      }
      const unitStats: UnitStats[] = units.map((u) => ({
        unit_id: u.id,
        unit_name: u.name ?? "—",
        customer_name: u.customer_id ? custById.get(u.customer_id) ?? null : null,
        visits: unitCount.get(u.id) ?? 0,
      }));

      return { foStats, unitStats };
    },
  });

  const foStats = dataQ.data?.foStats ?? [];
  const unitStats = dataQ.data?.unitStats ?? [];

  const foByVisitsDesc = [...foStats].sort((a, b) => b.visits - a.visits || a.full_name.localeCompare(b.full_name));
  const foByVisitsAsc = [...foStats].sort((a, b) => a.visits - b.visits || a.full_name.localeCompare(b.full_name));
  const rated = foStats.filter((f) => f.avgRating != null);
  const foByRatingDesc = [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
  const foByRatingAsc = [...rated].sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0));
  const foByKmDesc = [...foStats].sort((a, b) => b.km - a.km);
  const foByKmAsc = [...foStats].sort((a, b) => a.km - b.km);
  const unitsDesc = [...unitStats].sort((a, b) => b.visits - a.visits || a.unit_name.localeCompare(b.unit_name));
  const unitsAsc = [...unitStats].sort((a, b) => a.visits - b.visits || a.unit_name.localeCompare(b.unit_name));

  return (
    <section className="space-y-3">
      {/* Filter bar */}
      <FieldSenseRangeFilter
        preset={preset as RangePreset}
        onPresetChange={(p) => setPreset(p as LbPreset)}
        customStart={customStart}
        customEnd={customEnd}
        onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
        resolvedLabel={`${resolved.label} · ${resolved.start === resolved.end ? resolved.start : `${resolved.start} → ${resolved.end}`}`}
      />

      {dataQ.isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-center text-xs italic text-muted-foreground shadow-sm">
          Crunching leaderboards…
        </div>
      ) : (
        <>
          {/* Field officer leaderboards */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Leaderboard
              title="Field officers · Most visits"
              tone="sky"
              rows={foByVisitsDesc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: r.employee_code ?? "—",
                metric: `${r.visits}`,
                metricLabel: r.visits === 1 ? "visit" : "visits",
              })}
              emptyLabel="No visits recorded in range."
            />
            <Leaderboard
              title="Field officers · Least visits"
              tone="rose"
              rows={foByVisitsAsc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: r.employee_code ?? "—",
                metric: `${r.visits}`,
                metricLabel: r.visits === 1 ? "visit" : "visits",
              })}
              emptyLabel="No visits recorded in range."
            />
            <Leaderboard
              title="Field officers · Highest rating"
              tone="amber"
              rows={foByRatingDesc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: `${r.ratedCount} rated`,
                metric: (r.avgRating ?? 0).toFixed(2),
                metricLabel: "avg ★",
              })}
              emptyLabel="No client ratings in range."
              accent={<Star className="h-3.5 w-3.5 text-amber-500" />}
            />
            <Leaderboard
              title="Field officers · Lowest rating"
              tone="violet"
              rows={foByRatingAsc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: `${r.ratedCount} rated`,
                metric: (r.avgRating ?? 0).toFixed(2),
                metricLabel: "avg ★",
              })}
              emptyLabel="No client ratings in range."
              accent={<Star className="h-3.5 w-3.5 text-violet-500" />}
            />
            <Leaderboard
              title="Field officers · Distance traveled (high → low)"
              tone="emerald"
              rows={foByKmDesc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: r.employee_code ?? "—",
                metric: r.km.toFixed(2),
                metricLabel: "km",
              })}
              emptyLabel="No GPS trail recorded in range."
            />
            <Leaderboard
              title="Field officers · Distance traveled (low → high)"
              tone="slate"
              rows={foByKmAsc}
              render={(r) => ({
                key: r.candidate_id,
                primary: r.full_name,
                secondary: r.employee_code ?? "—",
                metric: r.km.toFixed(2),
                metricLabel: "km",
              })}
              emptyLabel="No GPS trail recorded in range."
            />
          </div>

          {/* Units + Customers */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Leaderboard
              title="Clients · Most visited"
              tone="sky"
              rows={unitsDesc}
              render={(r) => ({
                key: r.unit_id,
                primary: r.unit_name,
                secondary: r.customer_name ?? "—",
                metric: `${r.visits}`,
                metricLabel: r.visits === 1 ? "visit" : "visits",
              })}
              emptyLabel="No clients visited in range."
            />
            <Leaderboard
              title="Clients · Least visited"
              tone="rose"
              rows={unitsAsc}
              render={(r) => ({
                key: r.unit_id,
                primary: r.unit_name,
                secondary: r.customer_name ?? "—",
                metric: `${r.visits}`,
                metricLabel: r.visits === 1 ? "visit" : "visits",
              })}
              emptyLabel="No clients visited in range."
            />
          </div>
        </>
      )}
    </section>
  );
}

const LB_TONES: Record<string, string> = {
  sky: "text-sky-700 dark:text-sky-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  violet: "text-violet-700 dark:text-violet-300",
  rose: "text-rose-700 dark:text-rose-300",
  slate: "text-slate-700 dark:text-slate-300",
};

function Leaderboard<T>({
  title,
  tone,
  rows,
  render,
  emptyLabel,
  accent,
}: {
  title: string;
  tone: keyof typeof LB_TONES;
  rows: T[];
  render: (r: T) => { key: string; primary: string; secondary: string; metric: string; metricLabel: string };
  emptyLabel: string;
  accent?: React.ReactNode;
}) {
  const top = rows.slice(0, 8);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className={`mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] ${LB_TONES[tone]}`}>
        {accent}
        {title}
        <span className="text-muted-foreground">({rows.length})</span>
      </div>
      {top.length === 0 ? (
        <div className="py-4 text-center text-[11px] italic text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ol className="space-y-1.5">
          {top.map((r, i) => {
            const item = render(r);
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-foreground/90 text-[11px] font-bold text-background">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{item.primary}</div>
                    {item.secondary ? (
                      <div className="truncate text-[11px] text-muted-foreground">{item.secondary}</div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-baseline gap-1 tabular-nums">
                  <span className="font-display text-base font-bold text-foreground">{item.metric}</span>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">{item.metricLabel}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}


