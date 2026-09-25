import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { selfieUrl } from "@/lib/attendance-selfie";

type Punch = {
  check_in_at: string | null; check_in_lat: number | null; check_in_lng: number | null; check_in_place?: string | null; check_in_photo_path?: string | null;
  check_out_at: string | null; check_out_lat: number | null; check_out_lng: number | null; check_out_place?: string | null; check_out_photo_path?: string | null;
  last_lat: number | null; last_lng: number | null; last_seen_at: string | null;
};
type Visit = { id: string; unit_id: string; visit_seq: number | null; check_in_at: string | null; check_out_at: string | null; check_in_lat: number | null; check_in_lng: number | null };

function todayIso() {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const t = (s: string | null) => (s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");

/** Radar-team map of one officer's day: punch in/out, live position, trail and visits. */
export function OfficerDayMap({ candidateId, date }: { candidateId: string; date?: string }) {
  const day = date ?? todayIso();
  const q = useQuery({
    queryKey: ["officer-day-map", candidateId, day],
    refetchInterval: day === todayIso() ? 20_000 : false,
    queryFn: async () => {
      const [pRes, vRes, tRes] = await Promise.all([
        supabase.from("self_attendance_punches" as never).select("*").eq("candidate_id", candidateId).eq("punch_date", day).maybeSingle(),
        supabase.from("field_visits" as never).select("id, unit_id, visit_seq, check_in_at, check_out_at, check_in_lat, check_in_lng").eq("candidate_id", candidateId).eq("visit_date", day).order("check_in_at"),
        supabase.from("field_track_points" as never).select("lat, lng, recorded_at").eq("candidate_id", candidateId).eq("track_date", day).order("recorded_at").limit(5000),
      ]);
      const visits = (vRes.data ?? []) as unknown as Visit[];
      const unitIds = [...new Set(visits.map((v) => v.unit_id))];
      const units = unitIds.length
        ? (((await supabase.from("units" as never).select("id, name").in("id", unitIds)).data ?? []) as unknown as Array<{ id: string; name: string }>)
        : [];
      const punch = (pRes.data as Punch | null) ?? null;
      const [inUrl, outUrl] = await Promise.all([selfieUrl(punch?.check_in_photo_path), selfieUrl(punch?.check_out_photo_path)]);
      return {
        punch, visits, inUrl, outUrl,
        unitName: new Map(units.map((u) => [u.id, u.name])),
        track: ((tRes.data ?? []) as unknown as Array<{ lat: number | string; lng: number | string }>).map((p) => [Number(p.lat), Number(p.lng)] as [number, number]),
      };
    },
  });

  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<"street" | "satellite">("street");
  const tileRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { zoomControl: true }).setView([18.52, 73.86], 11);
      tileRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const L = (await import("leaflet")).default;
      tileRef.current?.remove();
      tileRef.current = kind === "street"
        ? L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 })
        : L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri", maxZoom: 19 });
      tileRef.current.addTo(mapRef.current);
    })();
  }, [kind, ready]);

  useEffect(() => {
    if (!ready || !q.data) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const g = layerRef.current; g.clearLayers();
      const pts: [number, number][] = [];
      const dot = (lat: number, lng: number, color: string, label: string, html: string) => {
        pts.push([lat, lng]);
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:9999px;min-width:26px;height:26px;padding:0 6px;display:flex;align-items:center;justify-content:center;font:700 11px system-ui;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        }).bindPopup(html).addTo(g);
      };
      const { punch, visits, track, unitName, inUrl, outUrl } = q.data;
      if (track.length > 1) { L.polyline(track, { color: "#0ea5e9", weight: 4, opacity: 0.8 }).addTo(g); pts.push(...track); }
      const img = (u: string | null) => (u ? `<br/><img src="${u}" style="width:160px;border-radius:8px;margin-top:6px"/>` : "");
      if (punch?.check_in_lat != null && punch.check_in_lng != null)
        dot(punch.check_in_lat, punch.check_in_lng, "#16a34a", "IN", `<b>Logged in ${t(punch.check_in_at)}</b><br/>${punch.check_in_place ?? ""}${img(inUrl)}`);
      visits.forEach((v, i) => {
        if (v.check_in_lat == null || v.check_in_lng == null) return;
        dot(v.check_in_lat, v.check_in_lng, "#7c3aed", String(v.visit_seq ?? i + 1), `<b>${unitName.get(v.unit_id) ?? "Site"}</b><br/>${t(v.check_in_at)} – ${t(v.check_out_at)}`);
      });
      if (punch?.check_out_lat != null && punch.check_out_lng != null)
        dot(punch.check_out_lat, punch.check_out_lng, "#dc2626", "OUT", `<b>Logged out ${t(punch.check_out_at)}</b><br/>${punch.check_out_place ?? ""}${img(outUrl)}`);
      if (punch?.last_lat != null && punch.last_lng != null && !punch.check_out_at)
        dot(punch.last_lat, punch.last_lng, "#0284c7", "●", `<b>Last seen ${t(punch.last_seen_at)}</b>`);
      if (pts.length === 1) mapRef.current.setView(pts[0], 16);
      else if (pts.length > 1) mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    })();
  }, [ready, q.data]);

  const empty = q.data && !q.data.punch && q.data.visits.length === 0 && q.data.track.length === 0;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="text-[13px] font-semibold">Location & duties map</div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>🟢 Log in</span><span>🟣 Visits</span><span>🔴 Log out</span><span>🔵 Trail / live</span>
          <button className="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground" onClick={() => setKind((k) => (k === "street" ? "satellite" : "street"))}>
            {kind === "street" ? "Satellite" : "Street"}
          </button>
        </div>
      </div>
      <div className="relative">
        <div ref={el} className="h-[420px] w-full md:h-[520px]" />
        {empty && <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center text-[13px] font-semibold text-muted-foreground">No location recorded for this day.</div>}
      </div>
    </div>
  );
}
