import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Battery, BatteryCharging, Radio, Signal, Star, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { FieldOfficerFieldSense } from "@/components/FieldOfficerFieldSense";
import { RANGE_PRESETS, resolveRange, type RangePreset } from "@/lib/field-visits";
import { FieldSenseRangeFilter } from "@/components/FieldSenseRangeFilter";
import { AdminVisitProgressCard } from "@/components/AdminVisitProgressCard";
import { AdminFieldOfficerUnitsCard } from "@/components/AdminFieldOfficerUnitsCard";
import { AdminEscalationRequestsCard } from "@/components/AdminEscalationRequestsCard";
import { FieldSenseLeaderboards } from "@/components/FieldSenseLeaderboards";



export const Route = createFileRoute("/admin/field-sense/")({
  component: FieldSensePage,
  validateSearch: (search: Record<string, unknown>): { range?: string; start?: string; end?: string; highlight?: string; action?: string } => ({
    range: (search.range as string | undefined) ?? undefined,
    start: (search.start as string | undefined) ?? undefined,
    end: (search.end as string | undefined) ?? undefined,
    highlight: (search.highlight as string | undefined) ?? undefined,
    action: (search.action as string | undefined) ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Radar — Live field officers on India map" },
      { name: "description", content: "Live map of on-duty field officers with battery and network telemetry." },
      { property: "og:title", content: "Radar — Live field officers" },
      { property: "og:description", content: "Live map of on-duty field officers with battery and network telemetry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type LivePunch = {
  id: string;
  candidate_id: string;
  check_in_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  battery_pct: number | null;
  battery_charging: boolean | null;
  network_type: string | null;
  candidate?: {
    full_name: string | null;
    employee_code: string | null;
    role_key: string | null;
    mobile: string | null;
  } | null;
};

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seenLabel(iso: string | null): string {
  if (!iso) return "no ping";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function batteryTone(bat: number | null): string {
  if (bat == null) return "#64748b";
  if (bat <= 20) return "#e11d48";
  if (bat <= 40) return "#d97706";
  return "#059669";
}

function netLabel(net: string | null): string {
  return net ?? "n/a";
}

function popupHtml(r: LivePunch): string {
  const name = r.candidate?.full_name ?? "Field officer";
  const code = r.candidate?.employee_code ?? "—";
  const bat = r.battery_pct;
  const batText = bat == null ? "n/a" : `${bat}%${r.battery_charging ? " ⚡" : ""}`;
  const batColor = batteryTone(bat);
  const net = netLabel(r.network_type);
  const seen = seenLabel(r.last_seen_at);
  return `
    <div style="font-family: ui-sans-serif, system-ui; min-width: 180px;">
      <div style="font-weight: 700; font-size: 13px; color:#0f172a;">${name}</div>
      <div style="font-size: 11px; color:#64748b; margin-top:2px;">${code} · ${seen}</div>
      <div style="display:flex; gap:10px; margin-top:8px; font-size:12px; font-weight:600;">
        <span style="color:${batColor};">🔋 ${batText}</span>
        <span style="color:#0f172a;">📶 ${net}</span>
      </div>
    </div>
  `;
}

function FieldSensePage() {
  const { isFieldOfficer, candidateId, isLoading } = useCurrentUserRole();
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isFieldOfficer && candidateId) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Site Visits"
          description="Check in and out at assigned sites and review today's visits."
          crumbs={[{ label: "Admin", to: "/admin/field-dashboard" }, { label: "Site Visits" }]}
        />
        <FieldOfficerFieldSense candidateId={candidateId} />
      </div>
    );
  }
  return <AdminFieldSense />;
}

function AdminFieldSense() {
  const qc = useQueryClient();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const LRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [mapKind, setMapKind] = useState<"street" | "satellite">("street");



  const q = useQuery({
    queryKey: ["field-sense-live", today()],
    refetchInterval: 15_000,
    queryFn: async (): Promise<LivePunch[]> => {
      const { data, error } = await supabase
        .from("self_attendance_punches" as never)
        .select(
          "id, candidate_id, check_in_at, last_lat, last_lng, last_seen_at, battery_pct, battery_charging, network_type, candidate:candidates!inner(full_name, employee_code, role_key, mobile)",
        )
        .eq("punch_date", today())
        .not("check_in_at", "is", null)
        .is("check_out_at", null)
        .eq("candidate.role_key", "field_officer")
        .order("last_seen_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as LivePunch[];
    },
  });

  const totalsQ = useQuery({
    queryKey: ["field-sense-totals"],
    staleTime: 60_000,
    queryFn: async () => {
      const fo = await supabase
        .from("candidates" as never)
        .select("id", { count: "exact", head: true })
        .eq("role_key", "field_officer")
        .in("status", ["approved", "active"]);
      return { fo: fo.count ?? 0 };
    },
  });

  // Init map (client-only, dynamic import)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapEl.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, {
        center: [22.9734, 78.6569], // Center of India
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });
      tileRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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

  // Realtime updates
  useEffect(() => {
    const name = `field-sense-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(name);
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "self_attendance_punches" },
      () => void qc.invalidateQueries({ queryKey: ["field-sense-live", today()] }),
    ).subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = useMemo(() => (q.data ?? []).filter((r) => r.last_lat != null && r.last_lng != null), [q.data]);

  const liveFoCount = rows.length;
  const totalFo = totalsQ.data?.fo ?? 0;

  // Sync markers
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    const seen = new Set<string>();

    // Group rows sharing (approx) same coordinate so overlapping pins fan out
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${(r.last_lat as number).toFixed(5)},${(r.last_lng as number).toFixed(5)}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    const offsetFor = (r: (typeof rows)[number]): [number, number] => {
      const key = `${(r.last_lat as number).toFixed(5)},${(r.last_lng as number).toFixed(5)}`;
      const group = groups.get(key)!;
      if (group.length < 2) return [r.last_lat as number, r.last_lng as number];
      const idx = group.findIndex((g) => g.id === r.id);
      const radius = 0.00012; // ~13m
      const angle = (2 * Math.PI * idx) / group.length;
      return [
        (r.last_lat as number) + radius * Math.cos(angle),
        (r.last_lng as number) + radius * Math.sin(angle),
      ];
    };

    for (const r of rows) {
      const [lat, lng] = offsetFor(r);
      seen.add(r.id);
      const html = popupHtml(r);
      const initial = (r.candidate?.full_name ?? "F").trim().charAt(0).toUpperCase();
      const color = batteryTone(r.battery_pct);
      const icon = L.divIcon({
        className: "field-sense-pin",
        html: `<div style="position:relative;">
          <div style="width:34px;height:34px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.25);border:3px solid #fff;">${initial}</div>
          <span style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:fs-ping 1.6s ease-out infinite;"></span>
        </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const existing = markersRef.current.get(r.id);
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
        existing.setPopupContent(html);
      } else {
        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.bindPopup(html);
        m.bindTooltip(html, { direction: "top", offset: [0, -18], opacity: 1 });
        markersRef.current.set(r.id, m);
      }
    }


    // Remove stale
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(m);
        markersRef.current.delete(id);
      }
    }

    // Auto-fit
    if (rows.length > 0) {
      const bounds = L.latLngBounds(rows.map((r) => [r.last_lat as number, r.last_lng as number]));
      if (rows.length === 1) {
        map.setView(bounds.getCenter(), 14, { animate: true });
      } else {
        map.fitBounds(bounds.pad(0.25), { maxZoom: 14, animate: true });
      }
    }
  }, [rows, ready]);

  // Switch tile layer between street/satellite
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = (mapKind === "street"
      ? L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 })
      : L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { attribution: "© Esri, Maxar, Earthstar Geographics", maxZoom: 19 },
        )
    ).addTo(map);
  }, [mapKind, ready]);


  return (
    <div className="space-y-4">
      <PageHeader
        title="Radar"
        description="Live map of on-duty field officers with battery and network telemetry."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Radar" }]}
      />

      <style>{`@keyframes fs-ping { 0% { transform: scale(1); opacity: 0.6;} 80%,100% { transform: scale(1.8); opacity: 0;} }`}</style>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile label="Field Officers" total={totalFo} live={liveFoCount} tone="sky" />
        <StatTile label="With GPS Ping" total={(q.data ?? []).length} live={rows.length} tone="amber" />
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Live map</div>
          <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setMapKind("street")}
              className={mapKind === "street" ? "rounded-md bg-foreground px-2 py-1 text-background" : "rounded-md px-2 py-1 text-muted-foreground"}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapKind("satellite")}
              className={mapKind === "satellite" ? "rounded-md bg-foreground px-2 py-1 text-background" : "rounded-md px-2 py-1 text-muted-foreground"}
            >
              Satellite
            </button>
          </div>
        </div>
        <div ref={mapEl} style={{ height: "520px", width: "100%" }} />
        {q.isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 text-xs font-semibold text-muted-foreground">
            Loading live field officers…
          </div>
        )}
        {!q.isLoading && rows.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto w-fit rounded-full bg-background/90 px-4 py-2 text-xs font-semibold text-muted-foreground shadow ring-1 ring-border/60">
            No field officer is currently checked in with a GPS ping.
          </div>
        )}
      </section>


      <div className="grid gap-4 xl:grid-cols-2">
        <AdminVisitProgressCard />
        <AdminFieldOfficerUnitsCard />
      </div>

      <AdminEscalationRequestsCard />

      <FieldSenseLeaderboards />
    </div>
  );
}

const TILE_TONES: Record<string, { ring: string; dot: string; live: string; total: string }> = {
  sky: { ring: "ring-sky-200/70", dot: "bg-sky-500", live: "text-sky-700 dark:text-sky-300", total: "text-slate-900 dark:text-slate-100" },
  emerald: { ring: "ring-emerald-200/70", dot: "bg-emerald-500", live: "text-emerald-700 dark:text-emerald-300", total: "text-slate-900 dark:text-slate-100" },
  violet: { ring: "ring-violet-200/70", dot: "bg-violet-500", live: "text-violet-700 dark:text-violet-300", total: "text-slate-900 dark:text-slate-100" },
  amber: { ring: "ring-amber-200/70", dot: "bg-amber-500", live: "text-amber-700 dark:text-amber-300", total: "text-slate-900 dark:text-slate-100" },
};

function StatTile({ label, total, live, tone }: { label: string; total: number; live: number; tone: keyof typeof TILE_TONES }) {
  const t = TILE_TONES[tone];
  return (
    <div className={`rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-sm ring-1 ${t.ring}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={`text-[22px] font-semibold leading-none ${t.total}`}>{total.toLocaleString()}</div>
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">total</div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={`relative flex h-1.5 w-1.5`}>
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${t.dot} opacity-60`} />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
        </span>
        <span className={`text-[11px] font-bold ${t.live}`}>{live.toLocaleString()} live now</span>
      </div>
    </div>
  );
}

