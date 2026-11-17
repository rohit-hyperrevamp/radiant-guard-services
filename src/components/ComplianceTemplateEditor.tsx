import { useEffect, useRef, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FittedDocument } from "@/components/FittedDocument";
import { EmployeePicker } from "@/components/EmployeePicker";
import { recDb } from "@/lib/recruitment";
import { downloadLetter } from "@/lib/employment-letters";
import { exportCompliancePdf, type ComplianceTemplate, type ComplianceEntry } from "@/lib/compliance-form-catalog";

export function ComplianceTemplateEditor({ template, close, canExport }: { template: ComplianceTemplate; close: () => void; canExport: boolean }) {
  const [pages,setPages]=useState<{width:number;height:number;url:string}[]>([]);
  const [entries,setEntries]=useState<ComplianceEntry[]>([]);
  const [selected,setSelected]=useState("");
  const [employee,setEmployee]=useState("");
  const [particulars,setParticulars]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const source=useRef<Uint8Array|null>(null);
  useEffect(()=>{
    let live=true; const urls:string[]=[];
    void (async()=>{try{
      const response=await fetch(template.pdfUrl);if(!response.ok)throw new Error("Original could not be loaded");
      const bytes=new Uint8Array(await response.arrayBuffer());source.current=bytes;
      const pdfjs=await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).href;
      const doc=await pdfjs.getDocument({data:bytes.slice()}).promise;
      const result=[];
      for(let i=1;i<=doc.numPages;i++){
        const page=await doc.getPage(i);const viewport=page.getViewport({scale:1});
        const canvas=document.createElement("canvas");canvas.width=viewport.width*1.5;canvas.height=viewport.height*1.5;
        await page.render({canvas,viewport:page.getViewport({scale:1.5})}).promise;
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve));if(!blob)throw new Error("Page preview unavailable");
        const url=URL.createObjectURL(blob);urls.push(url);result.push({width:viewport.width,height:viewport.height,url});
      }
      if(live)setPages(result);await doc.destroy();
    }catch(e){if(live)setError(e instanceof Error?e.message:"Preview failed");}})();
    return()=>{live=false;urls.forEach(url=>URL.revokeObjectURL(url));source.current=null;};
  },[template]);
  useEffect(()=>{
    let live=true;setParticulars({});if(!employee)return;
    void recDb.from("candidates").select("full_name,employee_code,date_of_birth,preferred_joining_date,mobile,aadhaar_number").eq("id",employee).single().then(({data,error}: {data: Record<string, unknown> | null; error: unknown})=>{if(!live)return;if(error){toast.error("Employee details could not be loaded");return;}setParticulars(Object.fromEntries(Object.entries(data??{}).filter(([,v])=>v!==null).map(([k,v])=>[k,String(v)])));});
    return()=>{live=false;};
  },[employee]);
  const active=entries.find(e=>e.id===selected);
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent size="document" className="flex flex-col overflow-hidden"><DialogHeader><DialogTitle>{template.title}</DialogTitle></DialogHeader>
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4 md:overflow-y-auto">
        <EmployeePicker value={employee} onChange={id=>{setEmployee(id);setEntries([]);setSelected("");}}/>
        <Button variant="outline" onClick={()=>{const entry={id:crypto.randomUUID(),page:0,x:40,y:100,text:"",size:10};setEntries(es=>[...es,entry]);setSelected(entry.id);}} disabled={!pages.length}><Plus className="mr-2 h-4 w-4"/>Add field</Button>
        {active&&<div className="space-y-3"><Label htmlFor="compliance-entry">Field value</Label><Input id="compliance-entry" value={active.text} onChange={e=>setEntries(es=>es.map(x=>x.id===selected?{...x,text:e.target.value}:x))}/><div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"><div className="min-w-0"><Label htmlFor="compliance-size">Text size</Label><Input id="compliance-size" type="number" min={6} max={24} value={active.size} onChange={e=>setEntries(es=>es.map(x=>x.id===selected?{...x,size:Math.min(24,Math.max(6,Number(e.target.value)))}:x))}/></div><Button variant="outline" size="icon" title="Remove field" onClick={()=>{setEntries(es=>es.filter(e=>e.id!==selected));setSelected("");}}><Trash2 className="h-4 w-4"/></Button></div></div>}
        {Object.entries(particulars).map(([key,value])=><Button key={key} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>{const entry={id:crypto.randomUUID(),page:0,x:40,y:100,text:value,size:10};setEntries(es=>[...es,entry]);setSelected(entry.id);}}>{key.replaceAll("_"," ")}: {value}</Button>)}
        <ul className="space-y-2">{entries.map((e,i)=><li key={e.id}><Button variant={e.id===selected?"secondary":"ghost"} onClick={()=>setSelected(e.id)} className="w-full justify-start">{i+1}. {e.text||"Empty field"} · page {e.page+1}</Button></li>)}</ul>
        <p className="text-xs text-muted-foreground">{template.note}</p>
      </aside>
      <div className="min-w-0 space-y-4 overflow-y-auto bg-muted p-2">{error&&<p role="alert" className="text-destructive">{error}</p>}{!pages.length&&!error&&<p role="status">Loading original pages…</p>}{pages.map((p,i)=><FittedDocument key={i}><div className="relative cursor-crosshair" style={{width:p.width,height:p.height}} onClick={e=>{if(!selected)return;const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)*p.width/rect.width,y=(e.clientY-rect.top)*p.height/rect.height;setEntries(es=>es.map(v=>v.id===selected?{...v,page:i,x,y}:v));}}><img src={p.url} alt={`${template.title}, page ${i+1}`} className="block h-full w-full"/>{entries.filter(e=>e.page===i).map(e=><span key={e.id} className="absolute bg-background text-foreground" style={{left:e.x,top:e.y,fontSize:e.size,width:'max-content',maxWidth:p.width-e.x-12,lineHeight:1.1}}>{e.text||"______"}</span>)}</div></FittedDocument>)}</div>
    </div><div className="flex shrink-0 justify-end gap-3 pt-3"><Button variant="outline" onClick={close}>Close</Button><Button disabled={!canExport||busy||!pages.length} onClick={async()=>{if(!source.current)return;setBusy(true);try{const blob=await exportCompliancePdf(source.current,entries);downloadLetter(blob,`${template.title.replace(/[^a-z0-9 -]/gi,"")}-draft.pdf`);}catch(e){toast.error(e instanceof Error?e.message:"Export failed");}finally{setBusy(false);}}}><Download className="mr-2 h-4 w-4"/>{busy?"Preparing…":"Export filled PDF"}</Button></div>
  </DialogContent></Dialog>;
}