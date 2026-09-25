import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ExternalLink, MapPin, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/DataPagination";
import { usePagination } from "@/components/DataPagination";
import { selfieUrl } from "@/lib/attendance-selfie";
import { mapsUrl } from "@/lib/self-attendance";

type PunchPhoto = {
  id: string;
  candidate_id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy: number | null;
  check_in_photo_path: string | null;
  check_out_photo_path: string | null;
  check_in_place: string | null;
  check_out_place: string | null;
  name: string;
  code: string | null;
  role: string | null;
};

type Shot = { path: string; title: string; at: string | null; lat: number | null; lng: number | null; acc: number | null; place: string | null };

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function Thumb({ shot, label, onOpen }: { shot: Shot | null; label: string; onOpen: (s: Shot) => void }) {
  const urlQ = useQuery({
    queryKey: ["selfie-url", shot?.path],
    enabled: !!shot?.path,
    staleTime: 50 * 60_000,
    queryFn: () => selfieUrl(shot!.path),
  });
  if (!shot) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-[10px] font-semibold text-muted-foreground">
        No {label.toLowerCase()} photo
      </div>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(shot)} className="group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-muted">
      {urlQ.data ? <img src={urlQ.data} alt={shot.title} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /> : null}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-foreground">{label} · {fmt(shot.at)}</span>
    </button>
  );
}

function Viewer({ shot, onClose }: { shot: Shot | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [shot?.path]);
  const urlQ = useQuery({
    queryKey: ["selfie-url", shot?.path],
    enabled: !!shot?.path,
    staleTime: 50 * 60_000,
    queryFn: () => selfieUrl(shot!.path),
  });
  const map = shot ? mapsUrl(shot.lat, shot.lng) : null;
  return (
    <Dialog open={!!shot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{shot?.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><Minus className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(5, z + 0.5))}><Plus className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom(1)}><RotateCcw className="h-4 w-4" /></Button>
          {urlQ.data ? (
            <a href={urlQ.data} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Open full size <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        <div
          className="h-[60vh] overflow-auto rounded-xl bg-muted"
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) setZoom((z) => Math.min(5, Math.max(1, z * Math.exp(-e.deltaY * 0.002)))); }}
        >
          {urlQ.data ? (
            <img
              src={urlQ.data}
              alt={shot?.title}
              onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
              style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              className="mx-auto block h-auto cursor-zoom-in"
            />
          ) : <div className="p-6 text-center text-xs text-muted-foreground">Loading photo…</div>}
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div><span className="font-semibold text-foreground">Time:</span> {shot?.at ? new Date(shot.at).toLocaleString("en-IN") : "—"}</div>
          <div>
            <span className="font-semibold text-foreground">Coordinates:</span>{" "}
            {shot?.lat != null ? `${Number(shot.lat).toFixed(6)}, ${Number(shot.lng).toFixed(6)} (±${Math.round(Number(shot.acc ?? 0))} m)` : "—"}
            {map ? <a href={map} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-primary">Map</a> : null}
          </div>
          <div className="sm:col-span-2"><span className="font-semibold text-foreground">Place:</span> {shot?.place ?? "—"}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AttendancePhotosSection({ date }: { date: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Shot | null>(null);

  const dataQ = useQuery({
    queryKey: ["attendance-photos", date],
    refetchInterval: 30_000,
    queryFn: async (): Promise<PunchPhoto[]> => {
      const { data, error } = await supabase
        .from("self_attendance_punches" as never)
        .select("id, candidate_id, check_in_at, check_out_at, check_in_lat, check_in_lng, check_in_accuracy, check_out_lat, check_out_lng, check_out_accuracy, check_in_photo_path, check_out_photo_path, check_in_place, check_out_place")
        .eq("punch_date", date)
        .not("check_in_at", "is", null)
        .order("check_in_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Omit<PunchPhoto, "name" | "code" | "role">[];
      const ids = Array.from(new Set(rows.map((r) => r.candidate_id)));
      const names = new Map<string, { full_name: string; employee_code: string | null; role_key: string | null }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: c } = await supabase.from("candidates" as never).select("id, full_name, employee_code, role_key").in("id", ids.slice(i, i + 200));
        for (const r of (c ?? []) as unknown as Array<{ id: string; full_name: string; employee_code: string | null; role_key: string | null }>) names.set(r.id, r);
      }
      return rows.map((r) => ({
        ...r,
        name: names.get(r.candidate_id)?.full_name ?? "Employee",
        code: names.get(r.candidate_id)?.employee_code ?? null,
        role: names.get(r.candidate_id)?.role_key ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = dataQ.data ?? [];
    return s ? all.filter((r) => r.name.toLowerCase().includes(s) || (r.code ?? "").toLowerCase().includes(s)) : all;
  }, [dataQ.data, q]);
  const pg = usePagination(filtered, 12);

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Attendance photos</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} punched in</span>
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ID" className="h-9 pl-8" />
        </div>
      </div>
      {dataQ.isLoading ? (
        <div className="p-6 text-center text-xs italic text-muted-foreground">Loading photos…</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-xs italic text-muted-foreground">No one has punched in on this date.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pg.pageItems.map((r) => {
            const title = `${r.name}${r.code ? ` · ${r.code}` : ""}`;
            const inShot: Shot | null = r.check_in_photo_path
              ? { path: r.check_in_photo_path, title: `${title} — Log in`, at: r.check_in_at, lat: r.check_in_lat, lng: r.check_in_lng, acc: r.check_in_accuracy, place: r.check_in_place }
              : null;
            const outShot: Shot | null = r.check_out_photo_path
              ? { path: r.check_out_photo_path, title: `${title} — Log out`, at: r.check_out_at, lat: r.check_out_lat, lng: r.check_out_lng, acc: r.check_out_accuracy, place: r.check_out_place }
              : null;
            const map = mapsUrl(r.check_in_lat, r.check_in_lng);
            return (
              <div key={r.id} className="rounded-xl border border-border/60 bg-background p-2.5">
                <div className="mb-2 min-w-0">
                  <div className="truncate text-[13px] font-bold text-foreground">{r.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {r.code ?? "—"} · {r.role === "field_officer" ? "Field Officer" : r.role === "guard" ? "Guard" : (r.role ?? "Staff").replace(/_/g, " ")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Thumb shot={inShot} label="In" onOpen={setOpen} />
                  <Thumb shot={outShot} label="Out" onOpen={setOpen} />
                </div>
                <div className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="line-clamp-2">
                    {r.check_in_place ?? (r.check_in_lat != null ? `${Number(r.check_in_lat).toFixed(5)}, ${Number(r.check_in_lng).toFixed(5)}` : "No location")}
                  </span>
                  {map ? <a href={map} target="_blank" rel="noreferrer" className="ml-auto shrink-0 font-semibold text-primary">Map</a> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3"><DataPagination {...pg} /></div>
      <Viewer shot={open} onClose={() => setOpen(null)} />
    </section>
  );
}
