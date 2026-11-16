import { useDeferredValue, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Settings2, FileClock, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { matchesSearch } from "@/lib/search-match";
import { logActivity } from "@/lib/activity-log";
import { recDb } from "@/lib/recruitment";
import { DOCUMENT_TYPES, PURPOSE_LABELS, type DocumentPolicy, type DocumentPerson, type DocumentPurpose } from "@/lib/document-followup";
import { DOCUMENT_FOLLOWUP_QK, fetchDocumentFollowup } from "@/lib/document-followup-data";
import { DocumentChecklist } from "./DocumentChecklist";
import { EmploymentLetters } from "@/components/EmploymentLetters";

export function DocumentFollowupPanel({ compact = false, tile = false, initialType = "all", initialOverdue = false }: { compact?: boolean; tile?: boolean; initialType?: string; initialOverdue?: boolean }) {
  const perms=useCurrentPermissions(); const session=useHasSupabaseSession(); const qc=useQueryClient();
  const enabled=session && perms.can("recruitment") && perms.canWidget("document_followup");
  const q=useQuery({queryKey:DOCUMENT_FOLLOWUP_QK,queryFn:fetchDocumentFollowup,enabled,staleTime:60_000,gcTime:30*60_000,refetchOnWindowFocus:true,refetchInterval:120_000});
  const [type,setType]=useState(initialType);const [purpose,setPurpose]=useState("all");const [search,setSearch]=useState("");const term=useDeferredValue(search);const [page,setPage]=useState(0);
  const [overdueOnly,setOverdueOnly]=useState(initialOverdue);
  const [selected,setSelected]=useState<DocumentPerson|null>(null);const [settings,setSettings]=useState<DocumentPolicy[]|null>(null);const [saving,setSaving]=useState(false);
  if (!enabled) return null;
  const pending=(q.data?.people ?? []).filter(p=>p.missing.length>0);
  const rows=pending.filter(p=>(type==="all"||p.missing.includes(type))&&(purpose==="all"||p.purpose===purpose)&&(!overdueOnly||p.overdue)&&matchesSearch(term,[p.name,p.code]));
  const counts=new Map<string,number>();for(const p of pending)for(const key of p.missing)counts.set(key,(counts.get(key)??0)+1);
  async function savePolicies() {
    if (!settings) return;setSaving(true);
    try {
      for(const item of settings){const {error}=await recDb.from("employee_document_policies").update({required_keys:item.required_keys,deadline_days:item.deadline_days,updated_at:new Date().toISOString()}).eq("purpose",item.purpose);if(error)throw error;}
      void logActivity({module:"Recruitment Documents",action:"update",entityType:"employee_document_policies",entityLabel:"Required documents and deadlines"});
      await Promise.all([qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK}),qc.invalidateQueries({queryKey:["document-policies"]})]);setSettings(null);toast.success("Document requirements saved");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not save requirements");}finally{setSaving(false);}
  }
  if (tile) return <Button asChild variant="ghost" data-panel className="group h-full w-full min-w-0 items-stretch justify-start overflow-hidden rounded-2xl border border-border/60 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-5">
    <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}} aria-label="Employee documents — view pending files">
      <span className="flex h-full w-full min-w-0 flex-col">
        <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><FileClock className="h-4 w-4 shrink-0 text-primary"/><span className="whitespace-normal">Employee documents</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/></span>
        <strong className="mt-auto block text-2xl tabular-nums text-primary sm:text-3xl">{q.isLoading||q.error ? "—" : new Set(pending.map(p=>p.recId??p.id)).size.toLocaleString("en-IN")}</strong>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 whitespace-normal text-[11px] sm:text-xs"><span className="text-muted-foreground">{q.isLoading?"Loading…":q.error?"Overview unavailable":"People with missing files"}</span>{!q.isLoading&&!q.error&&<span className={pending.some(p=>p.overdue)?"font-semibold text-destructive":"text-muted-foreground"}>{pending.filter(p=>p.overdue).length.toLocaleString("en-IN")} overdue</span>}</span>
      </span>
    </Link>
  </Button>;
  if (compact) return <section className="space-y-3 border-t border-border pt-4" aria-label="Recruitment document overview">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><FileClock className="h-4 w-4 text-primary"/>Employee documents</h3>
      <Button asChild variant="outline" size="sm"><Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}}>View documents<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
    </header>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Loading document overview…</p> : q.error ? <p className="text-sm text-destructive">Document overview unavailable.</p> : <>
      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-primary/5 p-3 text-left" data-panel>
          <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}}><FileClock className="mr-2 h-5 w-5 shrink-0 text-primary"/><span className="min-w-0"><strong className="block text-xl tabular-nums text-primary">{new Set(pending.map(p=>p.recId??p.id)).size.toLocaleString("en-IN")}</strong><span className="block whitespace-normal text-xs text-muted-foreground">People with missing files</span></span></Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-destructive/5 p-3 text-left" data-panel>
          <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:true}}><AlertCircle className="mr-2 h-5 w-5 shrink-0 text-destructive"/><span className="min-w-0"><strong className="block text-xl tabular-nums text-destructive">{pending.filter(p=>p.overdue).length.toLocaleString("en-IN")}</strong><span className="block whitespace-normal text-xs text-muted-foreground">Overdue checklists</span></span></Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">{[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key,count])=><Button key={key} asChild variant="outline" size="sm"><Link to="/admin/hr/recruitment/documents" search={{type:key,overdue:false}}>{DOCUMENT_TYPES[key]??key}<span className="ml-2 font-semibold tabular-nums text-primary">{count.toLocaleString("en-IN")}</span></Link></Button>)}</div>
      {pending.length===0&&<p className="text-xs text-muted-foreground">No pending documents.</p>}
    </>}
  </section>;
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FileClock className="h-5 w-5 text-primary"/>Pending employee documents</h2><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/admin/hr/recruitment/onboarding">Onboarding</Link></Button><Button asChild size="sm" variant="outline"><Link to="/admin/employees" search={{tab:"candidate"}}>Rehire</Link></Button><Button asChild size="sm" variant="outline"><Link to="/admin/employees" search={{tab:"employee"}}>Employees & exits</Link></Button>{perms.can("recruitment","edit")&&<Button variant="outline" size="sm" disabled={!q.data} onClick={()=>setSettings(structuredClone(q.data?.policies??[]))}><Settings2 className="mr-2 h-4 w-4"/>Requirements</Button>}</div></div>
    {q.isLoading?<p className="text-sm text-muted-foreground">Loading document records…</p>:q.error?<p className="text-sm text-destructive">Document follow-up could not be loaded. No zero count is shown.</p>:<>
      <div className="flex flex-wrap items-center gap-3 text-sm"><strong>{new Set(pending.map(p=>p.recId??p.id)).size} people with missing documents</strong><Button size="sm" variant={overdueOnly?"destructive":"outline"} onClick={()=>{setOverdueOnly(!overdueOnly);setPage(0);}}>{pending.filter(p=>p.overdue).length} overdue checklists{overdueOnly?" · Clear filter":""}</Button></div>
      <div className="flex flex-wrap gap-2"><Button variant={type==="all"?"default":"outline"} size="sm" onClick={()=>{setType("all");setPage(0);}}>All types</Button>{[...counts].sort((a,b)=>b[1]-a[1]).map(([key,count])=><Button key={key} variant={type===key?"default":"outline"} size="sm" onClick={()=>{setType(key);setPage(0);}}>{DOCUMENT_TYPES[key]??key} · {count}</Button>)}</div>
      <div className="flex flex-wrap gap-3"><Input className="max-w-sm" placeholder="Search employee name or ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><Select value={purpose} onValueChange={v=>{setPurpose(v);setPage(0);}}><SelectTrigger className="w-48"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All purposes</SelectItem>{Object.entries(PURPOSE_LABELS).map(([key,label])=><SelectItem value={key} key={key}>{label}</SelectItem>)}</SelectContent></Select></div>
      <ul className="divide-y divide-border">{rows.slice(page*15,page*15+15).map(p=><li key={`${p.id}-${p.purpose}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><Button variant="link" className="h-auto p-0 text-left" onClick={()=>setSelected(p)}>{p.name} · {p.code}</Button><p className="mt-1 text-xs text-muted-foreground">{PURPOSE_LABELS[p.purpose]} · Missing: {p.missing.map(k=>DOCUMENT_TYPES[k]??k).join(", ")}</p></div><div className={p.overdue?"text-xs text-destructive":"text-xs text-muted-foreground"}>{p.due?`${p.overdue?"Overdue · ":"Due "}${p.due}`:"Joining/action date not recorded"}</div></li>)}</ul>
      {rows.length===0&&<p className="text-sm text-muted-foreground">No missing documents for these filters.</p>}
      {rows.length>15&&<div className="flex items-center justify-end gap-3"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</Button><span className="text-xs">{page+1}/{Math.ceil(rows.length/15)}</span><Button size="sm" variant="outline" disabled={(page+1)*15>=rows.length} onClick={()=>setPage(page+1)}>Next</Button></div>}
    </>}
    <Dialog open={!!selected} onOpenChange={v=>{if(!v)setSelected(null);}}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name} · {selected?.code}</DialogTitle></DialogHeader>{selected&&<><DocumentChecklist id={selected.id} recId={selected.recId===selected.id?selected.recId:undefined} purpose={selected.purpose} start={selected.start}/>{selected.recId===selected.id?<Button asChild variant="outline"><Link to="/admin/hr/recruitment/candidates/$recId" params={{recId:selected.id}}>Open recruitment record</Link></Button>:<><EmploymentLetters candidateId={selected.id} group={selected.purpose==="offboarding"?"exit":"hiring"}/><Button asChild variant="outline"><Link to="/admin/candidates/$id/details" params={{id:selected.id}} search={{section:selected.purpose==="offboarding"?"offboarding":"hiring_letters"}}>Open employee record</Link></Button></>}</>}</DialogContent></Dialog>
    <Dialog open={!!settings} onOpenChange={v=>{if(!v)setSettings(null);}}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Document requirements & submission deadlines</DialogTitle></DialogHeader>{settings?.map((policy,index)=><section className="space-y-3 border-b border-border py-3" key={policy.purpose}><h3 className="font-semibold">{PURPOSE_LABELS[policy.purpose]}</h3><label className="flex items-center gap-3 text-sm">Submission deadline (days)<Input type="number" min={0} max={365} className="w-24" value={policy.deadline_days} onChange={e=>setSettings(previous=>previous?.map((p,i)=>i===index?{...p,deadline_days:Math.max(0,Math.min(365,Number(e.target.value)))}:p)??null)}/></label><div className="grid gap-2 sm:grid-cols-2">{Object.entries(DOCUMENT_TYPES).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={policy.required_keys.includes(key)} onCheckedChange={checked=>setSettings(previous=>previous?.map((p,i)=>i===index?{...p,required_keys:checked?[...new Set([...p.required_keys,key])]:p.required_keys.filter(k=>k!==key)}:p)??null)}/>{label}</label>)}</div></section>)}<Button disabled={saving} onClick={()=>void savePolicies()}>{saving?"Saving…":"Save requirements"}</Button></DialogContent></Dialog>
  </section>;
}