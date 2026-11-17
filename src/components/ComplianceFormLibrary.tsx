import { lazy, Suspense, useDeferredValue, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentPermissions } from "@/lib/rbac";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { matchesSearch } from "@/lib/search-match";
import { complianceFormCatalog, type ComplianceTemplate } from "@/lib/compliance-form-catalog";
import { downloadLetter } from "@/lib/employment-letters";
const Editor=lazy(()=>import("./ComplianceTemplateEditor").then(m=>({default:m.ComplianceTemplateEditor})));
export function ComplianceFormLibrary({month}:{month?:string}) {
  const permissions=useCurrentPermissions();const session=useHasSupabaseSession();
  const [search,setSearch]=useState("");const words=useDeferredValue(search);
  const [category,setCategory]=useState("all");const [selected,setSelected]=useState<ComplianceTemplate|null>(null);
  const [busy,setBusy]=useState("");
  if(!session||!permissions.can("employees","view"))return null;
  const canExport=permissions.canExport("employees");
  const rows=complianceFormCatalog.filter(f=>(category==="all"||category===f.category)&&matchesSearch(words,[f.title,f.category,f.original]));
  return <section className="my-6 space-y-4 py-5"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 className="min-w-0 text-base font-semibold">Compliance form library</h2><span className="shrink-0 text-sm text-muted-foreground">45 formats</span></div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]"><div className="relative min-w-0"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search form name or number" value={search} onChange={e=>setSearch(e.target.value)}/></div><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{[...new Set(complianceFormCatalog.map(f=>f.category))].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
    <div className="divide-y divide-border">{rows.map(f=><div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><h3 className="break-words text-sm font-medium">{f.title}</h3><p className="text-xs text-muted-foreground">{f.category} · {f.pages} page{f.pages!==1?"s":""}{f.aliases.length?" · duplicate consolidated":""}</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="icon" title={`Preview / fill ${f.title}`} aria-label={`Preview / fill ${f.title}`} onClick={()=>setSelected(f)}><Eye className="h-4 w-4"/></Button>{canExport&&<Button variant="outline" size="icon" title={`Download original ${f.title}`} aria-label={`Download original ${f.title}`} disabled={busy===f.id} onClick={async()=>{setBusy(f.id);try{const response=await fetch(f.originalUrl);if(!response.ok)throw new Error();downloadLetter(await response.blob(),f.original.split("/").pop()??f.title);}catch{toast.error("Original file could not be downloaded");}finally{setBusy("");}}}><Download className="h-4 w-4"/></Button>}</div></div>)}</div>
    {!rows.length&&<p className="text-sm text-muted-foreground">No matching forms.</p>}
    {selected&&<Suspense fallback={<p role="status">Opening form…</p>}><Editor key={selected.id} template={selected} initialMonth={month} close={()=>setSelected(null)} canExport={canExport}/></Suspense>}
  </section>;
}