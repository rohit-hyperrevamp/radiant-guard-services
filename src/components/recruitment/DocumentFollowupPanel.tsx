import { useDeferredValue, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Settings2, FileClock, ArrowRight, AlertCircle, Copy, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { serverSearchWords } from "@/lib/search-match";
import { logActivity } from "@/lib/activity-log";
import { recDb } from "@/lib/recruitment";
import { documentDateRange, type DocumentDatePeriod, DETAIL_TYPES, followupRequestText, DOCUMENT_TYPES, PURPOSE_LABELS, type DocumentPolicy, type DocumentPerson, type DocumentPurpose } from "@/lib/document-followup";
import { DOCUMENT_FOLLOWUP_QK, DOCUMENT_PAGE_SIZE, fetchDocumentList, fetchDocumentPolicies, fetchDocumentSummary } from "@/lib/document-followup-data";
import { DocumentChecklist } from "./DocumentChecklist";
import { EmploymentLetters } from "@/components/EmploymentLetters";

export function DocumentFollowupPanel({ compact = false, tile = false, initialType = "all", initialOverdue = false, initialStatus = "active" }: { compact?: boolean; tile?: boolean; initialType?: string; initialOverdue?: boolean; initialStatus?: string }) {
  const perms=useCurrentPermissions(); const session=useHasSupabaseSession(); const qc=useQueryClient();
  const enabled=session && perms.can("recruitment") && perms.canWidget("document_followup");
  const [type,setType]=useState(initialType);const [purpose,setPurpose]=useState("all");const [search,setSearch]=useState("");const term=useDeferredValue(search);const [page,setPage]=useState(0);
  const [overdueOnly,setOverdueOnly]=useState(initialOverdue);const [status,setStatus]=useState(initialStatus);
  const [period,setPeriod]=useState<DocumentDatePeriod>("all");
  const [customFrom,setCustomFrom]=useState("");const [customTo,setCustomTo]=useState("");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const range=documentDateRange(period,today,customFrom,customTo);
  // Dashboard cards need counts only; the full page asks the database for one filtered page at a time.
  const q=useQuery({queryKey:[...DOCUMENT_FOLLOWUP_QK,"summary",status,range.from,range.to],queryFn:()=>fetchDocumentSummary(status,range.from,range.to),placeholderData:keepPreviousData,enabled:enabled&&range.valid,staleTime:120_000,gcTime:30*60_000,refetchOnWindowFocus:true,refetchInterval:300_000});
  const filters={type,purpose,overdue:overdueOnly,words:serverSearchWords(term),page,status,from:range.from,to:range.to};
  const list=useQuery({queryKey:[...DOCUMENT_FOLLOWUP_QK,"list",filters],queryFn:()=>fetchDocumentList(filters),enabled:enabled&&!tile&&!compact&&range.valid,staleTime:60_000,gcTime:10*60_000,placeholderData:keepPreviousData});
  const policies=useQuery({queryKey:["document-policies"],queryFn:fetchDocumentPolicies,enabled:enabled&&!tile&&!compact,staleTime:5*60_000});
  const [selected,setSelected]=useState<DocumentPerson|null>(null);const [settings,setSettings]=useState<DocumentPolicy[]|null>(null);const [saving,setSaving]=useState(false);
  const [notifying,setNotifying]=useState(false);
  async function notifyEmployee() {
    if (!selected || selected.recId===selected.id) return;
    setNotifying(true);
    try {
      const {data,error}=await recDb.rpc("notify_document_followup",{p_candidate:selected.id});if(error)throw error;
      const messages:Record<string,string>={sent:"Reminder sent to the employee dashboard",already_sent:"This reminder was already sent today",complete:"All pending items are complete",no_account:"No employee login is available — use Copy request"};
      toast.success(messages[data?.status]??"Request completed");
    } catch(error){toast.error(error instanceof Error?error.message:"Could not send reminder");}finally{setNotifying(false);}
  }
  if (!enabled) return null;
  const peopleCount=q.data?.people??0;const overdueCount=q.data?.overdue??0;
  const counts=new Map<string,number>(Object.entries(q.data?.types??{}));const detailCounts=new Map<string,number>(Object.entries(q.data?.details??{}));
  const rows=list.data?.rows??[];const total=list.data?.total??0;
  async function savePolicies() {
    if (!settings) return;setSaving(true);
    try {
      for(const item of settings){const {error}=await recDb.from("employee_document_policies").update({required_keys:item.required_keys,required_details:item.required_details??[],deadline_days:item.deadline_days,updated_at:new Date().toISOString()}).eq("purpose",item.purpose);if(error)throw error;}
      void logActivity({module:"Recruitment Documents",action:"update",entityType:"employee_document_policies",entityLabel:"Required documents and deadlines"});
      await Promise.all([qc.invalidateQueries({queryKey:DOCUMENT_FOLLOWUP_QK}),qc.invalidateQueries({queryKey:["document-policies"]})]);setSettings(null);toast.success("Document requirements saved");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not save requirements");}finally{setSaving(false);}
  }
  const exitCount=q.data?.exits??0;
  const exitLink = <Button asChild variant="ghost" size="sm" className="h-auto justify-between gap-3 whitespace-normal text-left text-destructive"><Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false,status:"exits"}}><span>Pending exit documents & details</span><span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">{q.isLoading||q.error?"—":exitCount.toLocaleString("en-IN")}<ArrowRight className="h-4 w-4"/></span></Link></Button>;
  if (tile) return <div className="flex h-full min-w-0 flex-col gap-1"><Button asChild variant="ghost" data-panel className="group h-full w-full min-w-0 items-stretch justify-start overflow-hidden rounded-2xl border border-border/60 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 sm:p-5">
    <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}} aria-label="Employee documents — view pending files">
      <span className="flex h-full w-full min-w-0 flex-col">
        <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><FileClock className="h-4 w-4 shrink-0 text-primary"/><span className="whitespace-normal">Employee documents</span></span><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/></span>
        <strong className="mt-auto block text-2xl tabular-nums text-primary sm:text-3xl">{q.isLoading||q.error ? "—" : peopleCount.toLocaleString("en-IN")}</strong>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 whitespace-normal text-[11px] sm:text-xs"><span className="text-muted-foreground">{q.isLoading?"Loading…":q.error?"Overview unavailable":"Active people with pending items"}</span>{!q.isLoading&&!q.error&&<span className={overdueCount>0?"font-semibold text-destructive":"text-muted-foreground"}>{overdueCount.toLocaleString("en-IN")} overdue</span>}</span>
      </span>
    </Link>
  </Button>{exitLink}</div>;
  if (compact) return <section className="space-y-3 border-t border-border pt-4" aria-label="Recruitment document overview">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><FileClock className="h-4 w-4 text-primary"/>Employee documents</h3>
      <Button asChild variant="outline" size="sm"><Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}}>View documents<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
    </header>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Loading document overview…</p> : q.error ? <p className="text-sm text-destructive">Document overview unavailable.</p> : <>
      <div className="grid grid-cols-2 gap-3">
        <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-primary/5 p-3 text-left" data-panel>
          <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:false}}><FileClock className="mr-2 h-5 w-5 shrink-0 text-primary"/><span className="min-w-0"><strong className="block text-xl tabular-nums text-primary">{peopleCount.toLocaleString("en-IN")}</strong><span className="block whitespace-normal text-xs text-muted-foreground">Active people with pending items</span></span></Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-destructive/5 p-3 text-left" data-panel>
          <Link to="/admin/hr/recruitment/documents" search={{type:"all",overdue:true}}><AlertCircle className="mr-2 h-5 w-5 shrink-0 text-destructive"/><span className="min-w-0"><strong className="block text-xl tabular-nums text-destructive">{overdueCount.toLocaleString("en-IN")}</strong><span className="block whitespace-normal text-xs text-muted-foreground">Overdue checklists</span></span></Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">{[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key,count])=><Button key={key} asChild variant="outline" size="sm"><Link to="/admin/hr/recruitment/documents" search={{type:key,overdue:false}}>{DOCUMENT_TYPES[key]??key}<span className="ml-2 font-semibold tabular-nums text-primary">{count.toLocaleString("en-IN")}</span></Link></Button>)}</div>
      {exitLink}
      {peopleCount===0&&<p className="text-xs text-muted-foreground">No pending documents.</p>}
    </>}
  </section>;
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center gap-3"><Button variant={status==="exits"?"default":"outline"} size="sm" onClick={()=>{setStatus("exits");setPurpose("offboarding");setType("all");setOverdueOnly(false);setPage(0);}}>Pending exits · {q.data?exitCount.toLocaleString("en-IN"):"—"}</Button><Button variant={status==="active"?"default":"outline"} size="sm" onClick={()=>{setStatus("active");setPurpose("all");setType("all");setOverdueOnly(false);setPage(0);}}>Active employee follow-up</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FileClock className="h-5 w-5 text-primary"/>Pending documents & details</h2><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/admin/hr/recruitment/onboarding">Onboarding</Link></Button><Button asChild size="sm" variant="outline"><Link to="/admin/employees" search={{tab:"candidate"}}>Rehire</Link></Button><Button asChild size="sm" variant="outline"><Link to="/admin/employees" search={{tab:"employee"}}>Employees & exits</Link></Button>{perms.can("recruitment","edit")&&<Button variant="outline" size="sm" disabled={!policies.data} onClick={()=>setSettings(structuredClone(policies.data??[]))}><Settings2 className="mr-2 h-4 w-4"/>Requirements</Button>}</div></div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="document-date-period">Joining / action date</label><Select value={period} onValueChange={v=>{setPeriod(v as DocumentDatePeriod);setPage(0);}}><SelectTrigger id="document-date-period" className="w-48"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All dates</SelectItem><SelectItem value="6months">Last 6 months</SelectItem><SelectItem value="1year">Last 1 year</SelectItem><SelectItem value="2years">Last 2 years</SelectItem><SelectItem value="custom">Custom dates</SelectItem></SelectContent></Select></div>
      {period==="custom"&&<><div className="space-y-1"><label htmlFor="document-date-from" className="text-xs font-medium text-muted-foreground">From</label><Input id="document-date-from" type="date" className="w-44" value={customFrom} max={customTo||undefined} onChange={e=>{setCustomFrom(e.target.value);setPage(0);}}/></div><div className="space-y-1"><label htmlFor="document-date-to" className="text-xs font-medium text-muted-foreground">To</label><Input id="document-date-to" type="date" className="w-44" value={customTo} min={customFrom||undefined} onChange={e=>{setCustomTo(e.target.value);setPage(0);}}/></div></>}
      {range.valid&&range.from&&range.to&&<span className="pb-2 text-xs text-muted-foreground">{range.from} – {range.to}</span>}
    </div>
    {!range.valid?<p role="status" className="text-sm text-muted-foreground">Choose a valid start and end date.</p>:
    q.isLoading&&list.isLoading?<p className="text-sm text-muted-foreground">Loading document records…</p>:list.error?<p className="text-sm text-destructive">Document follow-up could not be loaded. No zero count is shown.</p>:<>
      <div className="flex flex-wrap items-center gap-3 text-sm"><strong>{q.data?`${peopleCount.toLocaleString("en-IN")} ${status==="all"?"":status+" "}people with pending items`:"Counting people…"}</strong><Button size="sm" variant={overdueOnly?"destructive":"outline"} onClick={()=>{setOverdueOnly(!overdueOnly);setPage(0);}}>{overdueCount.toLocaleString("en-IN")} overdue checklists{overdueOnly?" · Clear filter":""}</Button></div>
      <div className="flex flex-wrap gap-2"><Button variant={type==="all"?"default":"outline"} size="sm" onClick={()=>{setType("all");setPage(0);}}>All types</Button>{[...counts].sort((a,b)=>b[1]-a[1]).map(([key,count])=><Button key={key} variant={type===key?"default":"outline"} size="sm" onClick={()=>{setType(key);setPage(0);}}>{DOCUMENT_TYPES[key]??key} · {count.toLocaleString("en-IN")}</Button>)}</div>
      {detailCounts.size>0&&<div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted-foreground">Missing details:</span>{[...detailCounts].sort((a,b)=>b[1]-a[1]).map(([key,count])=><Button key={key} variant={type===key?"default":"secondary"} size="sm" onClick={()=>{setType(key);setPage(0);}}>{DETAIL_TYPES[key]??key} · {count.toLocaleString("en-IN")}</Button>)}</div>}
      <div className="flex flex-wrap gap-3"><Input className="max-w-sm" placeholder="Search employee name or ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><Select value={purpose} onValueChange={v=>{setPurpose(v);setPage(0);}}><SelectTrigger className="w-48"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All purposes</SelectItem>{Object.entries(PURPOSE_LABELS).map(([key,label])=><SelectItem value={key} key={key}>{label}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={v=>{setStatus(v);setPurpose(v==="exits"?"offboarding":"all");setPage(0);}}><SelectTrigger className="w-44" aria-label="Employee status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="active">Active employees</SelectItem><SelectItem value="exits">Pending exits</SelectItem><SelectItem value="inactive">Inactive / exited</SelectItem><SelectItem value="all">All employees</SelectItem></SelectContent></Select></div>
      <ul className={`divide-y divide-border ${list.isFetching?"opacity-60":""}`}>{rows.map(p=><li key={`${p.id}-${p.purpose}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><Button variant="link" className="h-auto p-0 text-left" onClick={()=>setSelected(p)}>{p.name} · {p.code}</Button><p className="mt-1 text-xs text-muted-foreground">{PURPOSE_LABELS[p.purpose]}{p.active===false?" · Inactive":""}{p.missing.length>0&&<> · Documents: {p.missing.map(k=>DOCUMENT_TYPES[k]??k).join(", ")}</>}{(p.missingDetails?.length??0)>0&&<> · <span className="text-destructive">Details: {(p.missingDetails??[]).map(k=>DETAIL_TYPES[k]??k).join(", ")}</span></>}</p></div><div className={p.overdue?"text-xs text-destructive":"text-xs text-muted-foreground"}>{p.due?`${p.overdue?"Overdue · ":"Due "}${p.due}`:"Joining/action date not recorded"}</div></li>)}</ul>
      {!list.isLoading&&rows.length===0&&<p className="text-sm text-muted-foreground">No pending documents or details for these filters.</p>}
      {list.isLoading&&<p className="text-sm text-muted-foreground">Loading…</p>}
      {total>DOCUMENT_PAGE_SIZE&&<div className="flex items-center justify-end gap-3"><Button size="sm" variant="outline" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</Button><span className="text-xs">{page+1}/{Math.ceil(total/DOCUMENT_PAGE_SIZE)}</span><Button size="sm" variant="outline" disabled={(page+1)*DOCUMENT_PAGE_SIZE>=total} onClick={()=>setPage(page+1)}>Next</Button></div>}
    </>}
    <Dialog open={!!selected} onOpenChange={v=>{if(!v)setSelected(null);}}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{selected?.name} · {selected?.code}</DialogTitle></DialogHeader>{selected&&<>{(selected.missingDetails?.length??0)>0&&<section className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"><h3 className="text-sm font-semibold">Missing details</h3><ul className="flex flex-wrap gap-2">{(selected.missingDetails??[]).map(k=><li key={k} className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive">{DETAIL_TYPES[k]??k}</li>)}</ul><p className="text-xs text-muted-foreground">Add these from the employee record once the employee shares them.</p></section>}<Button variant="outline" size="sm" className="w-fit" onClick={()=>{void navigator.clipboard.writeText(followupRequestText(selected.name,selected.missing,selected.missingDetails??[],selected.due)).then(()=>toast.success("Request message copied"),()=>toast.error("Could not copy"));}}><Copy className="mr-2 h-4 w-4"/>Copy request for employee</Button>{perms.can("recruitment","edit")&&selected.recId!==selected.id&&<Button variant="outline" size="sm" disabled={notifying} onClick={()=>void notifyEmployee()}><Bell className="mr-2 h-4 w-4"/>{notifying?"Sending…":"Notify employee"}</Button>}<DocumentChecklist id={selected.id} recId={selected.recId===selected.id?selected.recId:undefined} purpose={selected.purpose} start={selected.start}/>{selected.recId===selected.id?<Button asChild variant="outline"><Link to="/admin/hr/recruitment/candidates/$recId" params={{recId:selected.id}}>Open recruitment record</Link></Button>:<><EmploymentLetters candidateId={selected.id} group={selected.purpose==="offboarding"?"exit":"hiring"}/><Button asChild variant="outline"><Link to="/admin/candidates/$id/details" params={{id:selected.id}} search={{section:selected.purpose==="offboarding"?"offboarding":"hiring_letters"}}>Open employee record</Link></Button></>}</>}</DialogContent></Dialog>
    <Dialog open={!!settings} onOpenChange={v=>{if(!v)setSettings(null);}}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Required documents, details & deadlines</DialogTitle></DialogHeader>{settings?.map((policy,index)=><section className="space-y-3 border-b border-border py-3" key={policy.purpose}><h3 className="font-semibold">{PURPOSE_LABELS[policy.purpose]}</h3><label className="flex items-center gap-3 text-sm">Submission deadline (days)<Input type="number" min={0} max={365} className="w-24" value={policy.deadline_days} onChange={e=>setSettings(previous=>previous?.map((p,i)=>i===index?{...p,deadline_days:Math.max(0,Math.min(365,Number(e.target.value)))}:p)??null)}/></label><div className="grid gap-2 sm:grid-cols-2">{Object.entries(DOCUMENT_TYPES).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={policy.required_keys.includes(key)} onCheckedChange={checked=>setSettings(previous=>previous?.map((p,i)=>i===index?{...p,required_keys:checked?[...new Set([...p.required_keys,key])]:p.required_keys.filter(k=>k!==key)}:p)??null)}/>{label}</label>)}</div><h4 className="pt-2 text-sm font-medium">Required details</h4><div className="grid gap-2 sm:grid-cols-2">{Object.entries(DETAIL_TYPES).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={(policy.required_details??[]).includes(key)} onCheckedChange={checked=>setSettings(previous=>previous?.map((p,i)=>i===index?{...p,required_details:checked?[...new Set([...(p.required_details??[]),key])]:(p.required_details??[]).filter(k=>k!==key)}:p)??null)}/>{label}</label>)}</div></section>)}<Button disabled={saving} onClick={()=>void savePolicies()}>{saving?"Saving…":"Save requirements"}</Button></DialogContent></Dialog>
  </section>;
}