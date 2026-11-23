import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useCurrentPermissions } from '@/lib/rbac';
import { resolveRange, type RangePreset } from '@/lib/field-visits';
import { visitCoverage, type DetailedVisit, type VisitHistory } from '@/lib/visit-coverage';
import { indiaDate } from '@/lib/work-location';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldSenseRangeFilter } from '@/components/FieldSenseRangeFilter';
import { VisitProofs } from '@/components/VisitProofs';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
type Officer = {id:string;full_name:string;employee_code:string|null;assigned:number;completed:number;in_meeting:number;travelling:number};
export function RadarVisitHistory() {
  const ready=useHasSupabaseSession();const {can,isSuperAdmin}=useCurrentPermissions();
  const [preset,setPreset]=useState<RangePreset>('today');const [start,setStart]=useState('');const [end,setEnd]=useState('');
  const [search,setSearch]=useState('');const deferred=useDeferredValue(search);const [page,setPage]=useState(0);const [officer,setOfficer]=useState<Officer|null>(null);
  const range=useMemo(()=>resolveRange(preset,start,end),[preset,start,end]);const valid=range.start<=range.end&&range.end<=indiaDate();
  const q=useQuery({queryKey:['radar-visit-summary',range.start,range.end,deferred,page],enabled:ready&&valid&&(isSuperAdmin||can('field_sense')),staleTime:30_000,refetchInterval:preset==='today'?30_000:false,queryFn:async()=>{
    const {data,error}=await supabase.rpc('radar_visit_summary' as never,{_start:range.start,_end:range.end,_search:deferred,_page:page} as never);if(error)throw error;return data as unknown as {total:number;rows:Officer[]};
  }});
  return <section className="space-y-4" aria-label="Employee visit coverage"><h2 className="text-lg font-semibold">Site coverage & visit forms</h2>
    <FieldSenseRangeFilter bare preset={preset} onPresetChange={v=>{setPreset(v);setPage(0);}} customStart={start} customEnd={end} onCustomChange={(s,e)=>{setStart(s);setEnd(e);setPage(0);}} resolvedLabel={`${range.start} → ${range.end}`} />
    <Input aria-label="Search field visit employees" placeholder="Search employee name or ID…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} />
    {!valid&&<p className="text-sm text-destructive">Choose a valid date range ending today or earlier</p>}{q.error&&<p className="text-sm text-destructive">Visit history could not load: {q.error.message}</p>}
    <div className="divide-y divide-border">{q.isLoading&&<p className="p-4 text-sm text-muted-foreground">Loading visits…</p>}{q.data?.rows.map(o=><Button key={o.id} data-panel="true" variant="ghost" className="flex h-auto w-full flex-wrap justify-between gap-3 p-3 text-left" onClick={()=>setOfficer(o)}><span className="min-w-0"><span className="block whitespace-normal font-medium">{o.full_name} · {o.employee_code}</span><span className="block text-xs text-muted-foreground">{o.completed} sites completed · {o.assigned} mapped sites</span></span><span className="flex flex-wrap gap-2">{o.in_meeting>0&&<Badge variant="outline">{preset==='today'?'In meeting':'Unclosed visits'} · {o.in_meeting}</Badge>}{o.travelling>0&&<Badge variant="outline">Visit acknowledged · {o.travelling}</Badge>}{!o.in_meeting&&!o.travelling&&<Badge variant="outline">{o.completed?'Visits completed':'No completed visits'}</Badge>}</span></Button>)}</div>
    {q.data?.total===0&&<p className="text-sm text-muted-foreground">No matching employees</p>}
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{q.data?.total ?? 0} employees · Page {page+1}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Previous employee page" disabled={!page} onClick={()=>setPage(page-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Next employee page" disabled={!q.data||((page+1)*50>=q.data.total)} onClick={()=>setPage(page+1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    {officer&&<EmployeeHistory officer={officer} start={range.start} end={range.end} onClose={()=>setOfficer(null)} />}
  </section>;
}
function EmployeeHistory({officer,start,end,onClose}:{officer:Officer;start:string;end:string;onClose:()=>void}) {
  const {canExport}=useCurrentPermissions();const [tab,setTab]=useState('completed');const [visit,setVisit]=useState<DetailedVisit|null>(null);const [exporting,setExporting]=useState(false);
  const q=useQuery({queryKey:['radar-employee-history',officer.id,start,end],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.rpc('radar_employee_history' as never,{_candidate:officer.id,_start:start,_end:end} as never);if(error)throw error;return data as unknown as VisitHistory;}});
  const coverage=q.data?visitCoverage(q.data):null;
  const exportPdf=async()=>{if(!q.data||!canExport('field_sense'))return;setExporting(true);try{const {generateEmployeeVisitPdf}=await import('@/lib/field-sense-report-pdf');await generateEmployeeVisitPdf(officer.full_name,officer.employee_code,start,end,q.data.visits);}catch(e){toast.error(e instanceof Error?e.message:'PDF export failed');}finally{setExporting(false);}};
  return <Dialog open onOpenChange={o=>{if(!o)onClose();}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{officer.full_name} · {officer.employee_code}</DialogTitle></DialogHeader>
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{start} → {end}</span>{canExport('field_sense')&&<Button variant="outline" disabled={exporting||!q.data?.visits.length} onClick={()=>void exportPdf()}><Download className="mr-2 h-4 w-4" />{exporting?'Preparing forms…':'Export all forms PDF'}</Button>}</div>
    {q.error&&<p className="text-sm text-destructive">{q.error.message}</p>}{q.isLoading&&<p className="text-sm text-muted-foreground">Loading saved forms…</p>}
    {coverage&&<><div className="flex flex-wrap gap-2">{[{v:'completed',l:`Completed sites (${coverage.completedSites})`},{v:'pending',l:`Pending sites (${coverage.pending.length})`},{v:'all',l:`All visit forms (${q.data?.visits.length})`}].map(t=><Button key={t.v} variant={tab===t.v?'default':'outline'} onClick={()=>{setTab(t.v);setVisit(null);}}>{t.l}</Button>)}</div><div className="text-xs text-muted-foreground">{coverage.assignedSites} mapped sites · {q.data?.rosterSource==='saved'?'Saved assignment roster for this period':'Current assignment roster; historical assignments were not recorded'}</div>
    {!visit&&<div className="max-h-96 divide-y divide-border overflow-y-auto">{tab==='pending'?coverage.pending.map(s=><div key={s.unit_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{s.customer_name} — {s.unit_name} · {s.unit_code}</span><Badge variant="outline">{coverage.inProgress.has(s.unit_id)?'Unclosed visit':'Not completed in this period'}</Badge></div>):(tab==='all'?q.data?.visits??[]:coverage.completedVisits).map(v=><Button key={v.id} data-panel="true" variant="ghost" className="flex h-auto w-full flex-wrap justify-between gap-3 p-3 text-left" onClick={()=>setVisit(v)}><span className="min-w-0 whitespace-normal">{v.customer_name} — {v.unit_name} · {v.unit_code}<span className="block text-xs text-muted-foreground">{v.visit_date} · Visit {v.visit_seq}</span></span><Badge variant="outline">{v.check_out_at?'Completed':'Unclosed'}</Badge></Button>)}</div>}
    {visit&&<><Button variant="outline" size="sm" className="w-fit" onClick={()=>setVisit(null)}><ChevronLeft className="mr-1 h-4 w-4" />Back to sites</Button><SavedVisitForm visit={visit} /></>}</>}
  </DialogContent></Dialog>;
}
function SavedVisitForm({visit}:{visit:DetailedVisit}) {
  const versions=useQuery({queryKey:['field-visit-history',visit.id],queryFn:async()=>{const {data,error}=await supabase.from('field_visit_history' as never).select('id,action,recorded_at,form_data').eq('visit_id',visit.id).order('recorded_at');if(error)throw error;return(data??[]) as unknown as {id:string;action:string;recorded_at:string;form_data:DetailedVisit}[];}});
  const [version,setVersion]=useState<string|null>(null);const v=versions.data?.find(row=>row.id===version)?.form_data??visit;
  return <div className="space-y-4"><h3 className="font-semibold">{visit.customer_name} — {visit.unit_name}</h3><dl className="grid grid-cols-[minmax(90px,1fr)_minmax(0,2fr)] gap-3 text-sm">{[['Visit date',v.visit_date],['Check-in',new Date(v.check_in_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})],['Check-out',v.check_out_at?new Date(v.check_out_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'Not recorded'],['Client',v.client_name??'Not recorded'],['Rating',v.customer_rating!=null?`${v.customer_rating} / 5`:'Not recorded']].map(([label,value])=><div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl><div className="whitespace-pre-wrap break-words text-sm">{v.visit_notes??'No notes recorded'}</div><VisitProofs visitId={v.id} signaturePath={v.client_signature_url} photoPath={v.client_photo_url} />
    <h4 className="text-sm font-medium">Form history</h4>{versions.error&&<p className="text-xs text-destructive">Could not load form history</p>}<div className="flex flex-wrap gap-2"><Button size="sm" variant={version===null?'default':'outline'} onClick={()=>setVersion(null)}>Current saved form</Button>{versions.data?.map(row=><Button key={row.id} size="sm" variant={version===row.id?'default':'outline'} onClick={()=>setVersion(row.id)}>{row.action} · {new Date(row.recorded_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</Button>)}</div>
  </div>;
}