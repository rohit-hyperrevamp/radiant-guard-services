import { ScrollingText } from '@/components/ScrollingText';
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useAuth } from '@/lib/auth';
import { useCurrentPermissions } from '@/lib/rbac';
import { indiaDate, previousIndiaDate, validWorkCoordinates, locationFreshness, type WorkPerson, type WorkPeople } from '@/lib/work-location';
import { matchesSearch } from '@/lib/search-match';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocateFixed, Shield, Radio, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
const kinds = { field_officer: { label: 'Field Officer', icon: Radio }, guard: { label: 'Security Guard', icon: Shield }, driver: { label: 'Driver', icon: Truck } };
const time = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded';
function locationLabel(p: WorkPerson) { if (!validWorkCoordinates(p.lat, p.lng)) return 'No location recorded'; const state = locationFreshness(p); return state === 'check_in' ? 'Attendance check-in GPS' : state === 'recent' ? 'Recent device location' : state === 'stale' ? 'Last reported location — stale' : 'No location recorded'; }
export function WorkTeamMap({ mode = 'radar' }: { mode?: 'radar' | 'transport' }) {
  const ready = useHasSupabaseSession(); const { user } = useAuth(); const { can, canWidget, isSuperAdmin } = useCurrentPermissions();
  const allowed = isSuperAdmin || (mode === 'transport' ? can('vehicles') && canWidget('driver_team') : can('field_sense'));
  const [date, setDate] = useState(indiaDate()); const today = indiaDate(); const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
  const q = useQuery({ queryKey: ['work-map-people', user?.phone, mode, date], enabled: ready && allowed && valid, staleTime: 30_000, refetchInterval: date === today ? 30_000 : false, queryFn: async () => {
    const { data, error } = await supabase.rpc('work_map_people' as never, { _mode: mode, _date: date } as never); if (error) throw error; return data as unknown as WorkPeople;
  }});
  const el = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>()); const leaflet = useRef<typeof import('leaflet') | null>(null);
  const [mapReady, setMapReady] = useState(false); const [mapError, setMapError] = useState(''); const fitted = useRef(false);
  const [filter, setFilter] = useState('all'); const [kind, setKind] = useState('all');
  const [search, setSearch] = useState(''); const deferred = useDeferredValue(search); const [person, setPerson] = useState<WorkPerson | null>(null); const [page, setPage] = useState(0);
  const people = useMemo(() => (q.data?.rows ?? []).filter(p => (kind === 'all' || p.kind === kind) && (filter === 'all' || (filter === 'present' ? p.present : filter === 'absent' ? !p.present : p.check_in_at && !p.check_out_at)) && matchesSearch(deferred, [p.full_name, p.employee_code, p.unit_name])), [q.data, kind, filter, deferred]);
  const located = useMemo(() => people.filter(p => validWorkCoordinates(p.lat, p.lng)), [people]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(people.length / 10) - 1));
  const selectDate = (value: string) => { setDate(value); fitted.current = false; setPage(0); setPerson(null); };
  useEffect(() => {
    if (!allowed) return; let cancelled = false; let observer: ResizeObserver | undefined;
    void (async () => {
      try {
        const L = await import('leaflet'); await import('leaflet/dist/leaflet.css'); if (cancelled || !el.current) return;
        leaflet.current = L; map.current = L.map(el.current, { center: [22.9734, 78.6569], zoom: 5 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map.current);
        observer = new ResizeObserver(() => map.current?.invalidateSize()); observer.observe(el.current); setMapReady(true);
      } catch { if (!cancelled) setMapError('The map could not load. Saved employee locations remain available below.'); }
    })();
    return () => { cancelled = true; observer?.disconnect(); map.current?.remove(); map.current = null; markers.current.clear(); setMapReady(false); fitted.current = false; };
  }, [allowed]);
  useEffect(() => {
    const L = leaflet.current; const m = map.current; if (!mapReady || !L || !m) return; const ids = new Set<string>();
    for (const p of located) {
      if (p.lat == null || p.lng == null) continue; ids.add(p.id);
      const popup = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `${p.full_name} · ${p.employee_code ?? ''}`; popup.append(title);
      for (const text of [kinds[p.kind].label, locationLabel(p), time(p.located_at), p.unit_name ?? '']) { const line = document.createElement('div'); line.textContent = text; popup.append(line); }
      const icon = L.divIcon({ className: 'work-map-marker', html: `<span class="work-map-pin work-map-pin-${p.kind}">${p.kind === 'field_officer' ? 'FO' : p.kind === 'guard' ? 'SG' : 'D'}</span>`, iconSize: [36, 40], iconAnchor: [18, 20] });
      const existing = markers.current.get(p.id);
      if (existing) { existing.setLatLng([p.lat, p.lng]); existing.setIcon(icon); existing.setPopupContent(popup); existing.off('click'); existing.on('click', () => setPerson(p)); }
      else { const marker = L.marker([p.lat, p.lng], { icon }).addTo(m).bindPopup(popup); marker.on('click', () => setPerson(p)); markers.current.set(p.id, marker); }
    }
    for (const [id, marker] of markers.current) if (!ids.has(id)) { m.removeLayer(marker); markers.current.delete(id); }
    if (!fitted.current && located.length) { m.fitBounds(L.latLngBounds(located.flatMap(p => p.lat != null && p.lng != null ? [[p.lat, p.lng] as [number, number]] : [])).pad(.15), { maxZoom: 15 }); fitted.current = true; }
  }, [mapReady, located]);
  if (!allowed) return null;
  return <section className="my-4 min-w-0 space-y-3" aria-label={mode === 'transport' ? 'Driver team locations' : 'Field team locations'}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{mode === 'transport' ? 'Driver team locations' : 'Field team locations'}</h2><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={date === today ? 'default' : 'outline'} onClick={() => selectDate(today)}>Today</Button><Button size="sm" variant={date === previousIndiaDate() ? 'default' : 'outline'} onClick={() => selectDate(previousIndiaDate())}>Yesterday</Button><Input type="date" aria-label="Map date" max={today} className="w-40" value={date} onChange={e => selectDate(e.target.value)} /></div></header>
    {!valid && <p className="text-sm text-destructive">Choose a date no later than today.</p>}
    <div className="flex flex-wrap gap-3">{mode === 'transport' ? [{ label: 'Mapped drivers', n: q.data?.total, f: 'all' }, { label: 'Present', n: q.data?.present, f: 'present' }, { label: 'Absent / not marked', n: q.data ? q.data.total - q.data.present : undefined, f: 'absent' }, { label: 'On duty', n: q.data?.onDuty, f: 'on_duty' }].map(s => <Button key={s.f} variant="outline" data-panel="true" className={cn('h-auto min-w-32 flex-1 flex-col gap-2 p-3', filter === s.f && 'ring-2 ring-ring')} onClick={() => { setFilter(s.f); setPage(0); }}><span className="text-xs text-muted-foreground">{s.label}</span><b className="text-2xl">{q.error ? '—' : s.n ?? '…'}</b></Button>) : <div className="flex flex-wrap gap-2">{(['all', 'field_officer', 'guard'] as const).map(k => <Button key={k} variant={kind === k ? 'default' : 'outline'} size="sm" onClick={() => { setKind(k); setPage(0); fitted.current = false; }}>{k === 'all' ? 'Everyone' : kinds[k].label}</Button>)}</div>}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><div className="flex flex-wrap gap-4">{(mode === 'transport' ? ['driver'] as const : ['field_officer', 'guard'] as const).map(k => { const v = kinds[k]; const Icon = v.icon; return <span key={k} className="flex items-center gap-2"><Icon className={cn('h-4 w-4', k === 'guard' ? 'text-chart-2' : k === 'driver' ? 'text-chart-3' : 'text-accent')} />{v.label}</span>; })}</div><span>{located.length} saved locations · {date}</span></div>
    {q.error ? <p role="alert" className="text-sm text-destructive">Locations could not load: {q.error.message}</p> : !q.isLoading && valid && !located.length ? <p className="text-sm text-muted-foreground">{people.length ? 'These employees have no saved GPS location for this date.' : `No recorded check-ins for this selection on ${date}.`}</p> : null}
    {mapError && <p role="alert" className="text-sm text-destructive">{mapError}</p>}
    <div className="relative isolate z-0"><div ref={el} className="work-team-map h-[300px] w-full sm:h-[380px]" /><Button variant="outline" size="icon" aria-label="Fit team locations" title="Fit team locations" disabled={!located.length || !mapReady} className="absolute bottom-6 right-3 z-[500]" onClick={() => { const L = leaflet.current; const m = map.current; if (L && m && located.length) m.fitBounds(L.latLngBounds(located.flatMap(p => p.lat != null && p.lng != null ? [[p.lat, p.lng] as [number, number]] : [])).pad(.15), { maxZoom: 15 }); }}><LocateFixed className="h-4 w-4" /></Button></div>
    <Input aria-label="Search mapped employees" placeholder="Search name, employee ID or site…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
    <div className="max-h-72 divide-y divide-border overflow-y-auto">{people.slice(currentPage * 10, (currentPage + 1) * 10).map(p => <Button key={p.id} variant="ghost" data-panel="true" className="flex h-auto w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setPerson(p)}><span className="min-w-0 flex-1"><ScrollingText text={`${p.full_name} · ${p.employee_code ?? 'No ID'}`} className="font-medium" /><ScrollingText text={`${kinds[p.kind].label} · ${p.unit_name ?? ''} · ${locationLabel(p)}`} className="text-xs text-muted-foreground" /></span><Badge variant="outline">{!p.present ? 'Not marked' : p.check_out_at ? 'Checked out' : p.check_in_at ? 'On duty' : 'Present'}</Badge></Button>)}</div>
    {people.length > 10 && <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{people.length} employees · Page {currentPage + 1} of {Math.ceil(people.length / 10)}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous map employee page" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Next map employee page" disabled={(currentPage + 1) * 10 >= people.length} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    {person && <Dialog open onOpenChange={open => { if (!open) setPerson(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{person.full_name}</DialogTitle></DialogHeader><dl className="grid grid-cols-[minmax(90px,1fr)_minmax(0,2fr)] gap-3 text-sm">{[['Employee ID', person.employee_code], ['Role', kinds[person.kind].label], ['Site', person.unit_name], ['Attendance', person.present ? 'Present' : 'Not marked present'], ['Check-in', time(person.check_in_at)], ['Check-out', time(person.check_out_at)], ['Location source', locationLabel(person)], ['Recorded at', time(person.located_at)], ['Accuracy', person.accuracy != null ? `±${Math.round(person.accuracy)} m` : 'Not recorded']].map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value ?? 'Not recorded'}</dd></div>)}</dl>{validWorkCoordinates(person.lat, person.lng) && <a className="text-sm text-accent underline" href={`https://www.google.com/maps?q=${person.lat},${person.lng}`} target="_blank" rel="noreferrer">Open recorded coordinates</a>}</DialogContent></Dialog>}
  </section>;
}
