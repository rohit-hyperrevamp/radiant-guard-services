import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BatteryCharging, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_KEYS } from "@/lib/role-keys";
import { useManagerFieldOfficerScope } from "@/lib/use-manager-scope";

export type LivePunch = {
  id: string;
  candidate_id: string;
  check_in_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  battery_pct: number | null;
  network_type: string | null;
  candidate: { full_name: string | null; employee_code: string | null } | null;
};

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function batteryTone(pct: number | null) {
  if (pct == null) return "#64748b";
  if (pct <= 15) return "#dc2626";
  if (pct <= 40) return "#f59e0b";
  return "#059669";
}

/**
 * Radar, consumed on the operations homepage: live field-officer map with the
 * day's ping counts. The full Radar screen stays one click away.
 */
export function useOperationsRadarLive() {
  const managerScope = useManagerFieldOfficerScope();
  // Managers only track the officers reporting to them.
  const officerIds = managerScope.isScoped ? [...managerScope.fieldOfficerIds].sort() : null;

  return useQuery({
    queryKey: ["ops-radar-live", today(), officerIds ?? "all"],
    enabled: !managerScope.isLoading,
    refetchInterval: 20_000,
    queryFn: async (): Promise<LivePunch[]> => {
      if (officerIds && officerIds.length === 0) return [];
      let q = supabase
        .from("self_attendance_punches" as never)
        .select(
          "id, candidate_id, check_in_at, last_lat, last_lng, last_seen_at, battery_pct, network_type, candidate:candidates!inner(full_name, employee_code, role_key)",
        )
        .eq("punch_date", today())
        .not("check_in_at", "is", null)
        .is("check_out_at", null)
        .eq("candidate.role_key", ROLE_KEYS.FIELD_OFFICER);
      if (officerIds) q = q.in("candidate_id", officerIds);
      const { data, error } = await q.order("last_seen_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as LivePunch[];
    },
  });
}

export function OperationsRadarSummary() {
  const qc = useQueryClient();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const LRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const liveQ = useOperationsRadarLive();

  const totalsQ = useQuery({
    queryKey: ["ops-radar-totals"],
    staleTime: 60_000,
    queryFn: async () => {
      const fo = await supabase
        .from("candidates" as never)
        .select("id", { count: "exact", head: true })
        .eq("role_key", ROLE_KEYS.FIELD_OFFICER)
        .in("status", ["approved", "active"]);
      return { fo: fo.count ?? 0 };
    },
  });

  useEffect(() => {
    const name = `ops-radar-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(name);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "self_attendance_punches" },
      () => void qc.invalidateQueries({ queryKey: ["ops-radar-live", today()] }),
    ).subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = useMemo(
    () => (liveQ.data ?? []).filter((r) => r.last_lat != null && r.last_lng != null),
    [liveQ.data],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapEl.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { center: [22.9734, 78.6569], zoom: 4, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    const seen = new Set<string>();
    for (const r of rows) {
      seen.add(r.id);
      const initial = (r.candidate?.full_name ?? "F").trim().charAt(0).toUpperCase();
      const color = batteryTone(r.battery_pct);
      const label = `${r.candidate?.full_name ?? "Field officer"} · ${r.candidate?.employee_code ?? ""}`;
      const icon = L.divIcon({
        className: "ops-radar-pin",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.25);">${initial}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const existing = markersRef.current.get(r.id);
      if (existing) {
        existing.setLatLng([r.last_lat, r.last_lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(label);
      } else {
        const m = L.marker([r.last_lat, r.last_lng], { icon }).addTo(map);
        m.bindTooltip(label, { direction: "top", offset: [0, -14] });
        markersRef.current.set(r.id, m);
      }
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(m);
        markersRef.current.delete(id);
      }
    }
    if (rows.length > 0) {
      const bounds = L.latLngBounds(rows.map((r) => [r.last_lat as number, r.last_lng as number]));
      if (rows.length === 1) map.setView(bounds.getCenter(), 13, { animate: true });
      else map.fitBounds(bounds.pad(0.25), { maxZoom: 13, animate: true });
    }
  }, [rows, ready]);

  const onDuty = (liveQ.data ?? []).length;
  const charged = rows.filter((r) => (r.battery_pct ?? 100) > 40).length;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/90 shadow-sm sm:rounded-3xl">
      <header className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Radar
          </div>
          <h3 className="mt-0.5 font-display text-base font-bold tracking-tight text-foreground">
            Field officers live now
          </h3>
        </div>
        <Link
          to="/admin/field-sense"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Full map <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <Stat icon={<Users className="h-3.5 w-3.5" />} tone="sky" label="Field officers" value={totalsQ.data?.fo ?? 0} />
        <Stat icon={<MapPin className="h-3.5 w-3.5" />} tone="amber" label="With GPS ping" value={`${rows.length}/${onDuty}`} />
        <Stat icon={<BatteryCharging className="h-3.5 w-3.5" />} tone="emerald" label="Healthy battery" value={charged} />
      </div>

      <div className="px-4 pb-4">
        <div ref={mapEl} className="h-[300px] w-full overflow-hidden rounded-xl border border-border/50" />
      </div>
    </section>
  );
}

function Stat({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "emerald" | "amber" | "sky";
}) {
  const toneCls = {
    emerald: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/20 dark:text-emerald-400",
    amber: "text-amber-700 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400",
    sky: "text-sky-700 bg-sky-500/10 ring-sky-500/20 dark:text-sky-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-2.5">
      <div className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap tracking-wider ring-1 " + toneCls}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-black leading-none tracking-tight whitespace-nowrap text-foreground">{value}</div>
    </div>
  );
}
