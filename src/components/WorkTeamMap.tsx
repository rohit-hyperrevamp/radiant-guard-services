import { ScrollingText } from '@/components/ScrollingText';
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useCurrentPermissions } from '@/lib/rbac';
import { indiaDate, locationFreshness, type WorkPerson, type WorkPeople } from '@/lib/work-location';
import { matchesSearch } from '@/lib/search-match';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocateFixed, Shield, Radio, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
const kinds = { field_officer: { label: 'Field Officer', icon: Radio }, guard: { label: 'Security Guard', icon: Shield }, driver: { label: 'Driver', icon: Truck } };
const time = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) : 'Not recorded';
function locationLabel(p: WorkPerson) { const state = locationFreshness(p); return state === 'check_in' ? 'Attendance check-in GPS' : state === 'recent' ? 'Recent device location' : state === 'stale' ? 'Last reported location — stale' : 'No location recorded'; }
export function WorkTeamMap({ mode = 'radar' }: { mode?: 'radar' | 'transport' }) {
  const ready = useHasSupabaseSession(); const { can, canWidget, isSuperAdmin } = useCurrentPermissions();
  const allowed = isSuperAdmin || (mode === 'transport' ? can('vehicles') && canWidget('driver_team') : can('field_sense'));
  const q = useQuery({ queryKey: ['work-map-people', mode, indiaDate()], enabled: ready && allowed, staleTime:30_000, refetchInterval:30_000, queryFn:async () => {
    const {data,error} = await supabase.rpc('work_map_people' as never, {_mode:mode,_date:indiaDate()} as never); if(error) throw error; return data as unknown as WorkPeople;
  }});
  const el = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string,Marker>()); const leaflet = useRef<typeof import('leaflet') | null>(null);
  const [mapReady,setMapReady] = useState(false); const fitted = useRef(false);
  const [filter,setFilter] = useState('all'); const [kind,setKind] = useState('all');
  const [search,setSearch] = useState(''); const deferred = useDeferredValue(search); const [person,setPerson] = useState<WorkPerson | null>(null);
  const [limit,setLimit] = useState(50);
  const people = useMemo(() => (q.data?.rows ?? []).filter(p => (kind==='all' || p.kind===kind) && (filter==='all' || (filter==='present' ? p.present : filter==='absent' ? !p.present : p.check_in_at && !p.check_out_at)) && matchesSearch(deferred,[p.full_name,p.employee_code,p.unit_name])),[q.data,kind,filter,deferred]);
  const located = useMemo(() => people.filter(p => p.lat!=null && p.lng!=null),[people]);
  useEffect(() => { if(!allowed) return; let cancelled=false;
    void (async () => { const L=await import('leaflet'); await import('leaflet/dist/leaflet.css'); if(cancelled || !el.current) return; leaflet.current=L; map.current=L.map(el.current,{center:[22.9734,78.6569],zoom:5}); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map.current); setMapReady(true); })();
    return () => {cancelled=true; map.current?.remove(); map.current=null; markers.current.clear();};
  },[allowed]);
  useEffect(() => { const L=leaflet.current; const m=map.current; if(!mapReady || !L || !m) return; const ids=new Set<string>();
    for(const p of located) { if(p.lat==null || p.lng==null) continue; ids.add(p.id);
      const popup=document.createElement('div'); const title=document.createElement('strong'); title.textContent=`${p.full_name} · ${p.employee_code ?? ''}`; popup.append(title);
      for(const text of [kinds[p.kind].label,locationLabel(p),time(p.located_at),p.unit_name ?? '']) {const line=document.createElement('div');line.textContent=text;popup.append(line);}
      const icon=L.divIcon({className:'work-map-marker',html:`<span class="work-map-pin work-map-pin-${p.kind}">${p.kind==='field_officer'?'FO':p.kind==='guard'?'SG':'D'}</span>`,iconSize:[36,40],iconAnchor:[18,20]});
      const existing=markers.current.get(p.id); if(existing){existing.setLatLng([p.lat,p.lng]);existing.setIcon(icon);existing.setPopupContent(popup);existing.off('click');existing.on('click',()=>setPerson(p));}else{const marker=L.marker([p.lat,p.lng],{icon}).addTo(m).bindPopup(popup);marker.on('click',()=>setPerson(p));markers.current.set(p.id,marker);}
    }
    for(const [id,marker] of markers.current) if(!ids.has(id)){m.removeLayer(marker);markers.current.delete(id);}
    if(!fitted.current && located.length){ m.fitBounds(L.latLngBounds(located.flatMap(p => p.lat!=null && p.lng!=null ? [[p.lat,p.lng] as [number,number]] : [])).pad(.15),{maxZoom:15});fitted.current=true;}
  },[mapReady,located]);
  if(!allowed) return null;
  return <section className="my-4 space-y-4" aria-label={mode==='transport'?'Driver team locations':'Field team locations'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{mode==='transport'?'Driver team':'On-duty field team'}</h2><span className="text-xs text-muted-foreground">{indiaDate()} · {q.dataUpdatedAt ? `Updated ${time(new Date(q.dataUpdatedAt).toISOString())}` : 'Loading'}</span></div>
    <div className="flex flex-wrap gap-3">{mode==='transport' ? [{label:'Mapped drivers',n:q.data?.total,f:'all'},{label:'Present today',n:q.data?.present,f:'present'},{label:'Absent / not marked',n:q.data ? q.data.total-q.data.present:undefined,f:'absent'},{label:'On duty',n:q.data?.onDuty,f:'on_duty'}].map(s => <Button key={s.f} variant="outline" data-panel="true" className={cn('h-auto min-w-32 flex-1 flex-col gap-2 p-3',filter===s.f && 'ring-2 ring-ring')} onClick={()=>setFilter(s.f)}><span className="text-xs text-muted-foreground">{s.label}</span><b className="text-2xl">{q.error?'—':s.n ?? '…'}</b></Button>) : <div className="flex flex-wrap gap-2">{['all','field_officer','guard'].map(k => <Button key={k} variant={kind===k?'default':'outline'} size="sm" onClick={()=>{setKind(k);fitted.current=false;}}>{k==='all'?'Everyone':kinds[k as 'field_officer'|'guard'].label}</Button>)}</div>}</div>
    <div className="flex flex-wrap items-center gap-4 text-xs">{(mode==='transport'?['driver']:['field_officer','guard']).map(k=>{const v=kinds[k as keyof typeof kinds];const Icon=v.icon;return <span key={k} className="flex items-center gap-2"><Icon className={cn('h-4 w-4',k==='guard'?'text-chart-2':k==='driver'?'text-chart-3':'text-accent')} />{v.label}</span>;})}</div>
    <div className="relative isolate z-0"><div ref={el} className="work-team-map h-[400px] w-full sm:h-[520px]" />{!q.isLoading && !located.length && <p className="absolute inset-x-3 top-3 z-[500] rounded-md bg-card p-3 text-sm shadow-sm">{q.error ? `Locations could not load: ${q.error.message}` : 'No recorded coordinates for this selection'}</p>}<Button variant="outline" size="icon" aria-label="Fit team locations" title="Fit team locations" className="absolute bottom-6 right-3 z-[500]" onClick={()=>{const L=leaflet.current; const m=map.current;if(L&&m&&located.length) m.fitBounds(L.latLngBounds(located.flatMap(p=>p.lat!=null&&p.lng!=null?[[p.lat,p.lng] as [number,number]]:[])).pad(.15),{maxZoom:15});}}><LocateFixed className="h-4 w-4" /></Button></div>
    <Input aria-label="Search mapped employees" placeholder="Search name, employee ID or site…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(50);}} />
    <div className="max-h-96 divide-y divide-border overflow-y-auto">{people.slice(0,limit).map(p=><Button key={p.id} variant="ghost" data-panel="true" className="flex h-auto w-full flex-wrap items-center justify-between gap-3 p-3 text-left" onClick={()=>setPerson(p)}><span className="min-w-0 flex-1"><ScrollingText text={`${p.full_name} · ${p.employee_code ?? 'No ID'}`} className="font-medium" /><ScrollingText text={`${kinds[p.kind].label} · ${p.unit_name ?? ''} · ${locationLabel(p)}`} className="text-xs text-muted-foreground" /></span><Badge variant="outline">{!p.present?'Not marked':p.check_out_at?'Checked out':p.check_in_at?'On duty':'Present'}</Badge></Button>)}{people.length>limit&&<Button variant="outline" className="m-2" onClick={()=>setLimit(limit+50)}>Show more ({people.length-limit})</Button>}</div>
    {person&&<Dialog open onOpenChange={open=>{if(!open)setPerson(null);}}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{person.full_name}</DialogTitle></DialogHeader><dl className="grid grid-cols-2 gap-3 text-sm"><dt>Employee ID</dt><dd>{person.employee_code}</dd><dt>Role</dt><dd>{kinds[person.kind].label}</dd><dt>Site</dt><dd>{person.unit_name}</dd><dt>Attendance</dt><dd>{person.present?'Present':'Not marked present'}</dd><dt>Check-in</dt><dd>{time(person.check_in_at)}</dd><dt>Check-out</dt><dd>{time(person.check_out_at)}</dd><dt>Location source</dt><dd>{locationLabel(person)}</dd><dt>Recorded at</dt><dd>{time(person.located_at)}</dd><dt>Accuracy</dt><dd>{person.accuracy!=null?`±${Math.round(person.accuracy)} m`:'Not recorded'}</dd></dl>{person.lat!=null&&person.lng!=null&&<a className="text-sm text-accent underline" href={`https://www.google.com/maps?q=${person.lat},${person.lng}`} target="_blank" rel="noreferrer">Open recorded coordinates</a>}</DialogContent></Dialog>}
  </section>;
}