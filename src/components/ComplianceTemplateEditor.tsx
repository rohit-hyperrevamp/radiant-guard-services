import { useEffect, useRef, useState } from "react";
import { Download, FileUp, RotateCcw, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FittedDocument } from "@/components/FittedDocument";
import { EmployeePicker } from "@/components/EmployeePicker";
import { recDb } from "@/lib/recruitment";
import { downloadLetter } from "@/lib/employment-letters";
import type { ComplianceTemplate } from "@/lib/compliance-form-catalog";
import { digitalKey, digitalPrintHtml, parseDigitalDraft, type DigitalForm, type DigitalDraft } from "@/lib/compliance-digital";

// Source colours are document content, not application theme colours.
const ink = (rgb: number[] | null) => rgb ? `rgb(${rgb.map(c=>Math.round(c*255)).join(',')})` : 'none';
const textInk = (n: number) => `rgb(${n>>16&255},${n>>8&255},${n&255})`;

export function ComplianceTemplateEditor({ template, close, canExport }: { template: ComplianceTemplate; close: () => void; canExport: boolean }) {
  const [form,setForm]=useState<DigitalForm|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState("");
  const [employee,setEmployee]=useState("");
  const [particulars,setParticulars]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const paper=useRef<HTMLDivElement>(null);
  const upload=useRef<HTMLInputElement>(null);
  const request=useRef(0);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/compliance-digital/${template.id}.json`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("Digital form could not be loaded.");
      const data:DigitalForm=await response.json();if(!controller.signal.aborted)setForm(data);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Form could not be loaded.");});
    return()=>controller.abort();
  },[template.id]);
  useEffect(()=>{
    const current=++request.current;setParticulars({});if(!employee)return;
    void recDb.from("candidates").select("full_name,employee_code,date_of_birth,preferred_joining_date,mobile,aadhaar_number").eq("id",employee).single().then(({data,error}: {data: Record<string, unknown> | null; error: unknown})=>{
      if(request.current!==current)return;
      if(error){toast.error("Employee details could not be loaded");return;}
      setParticulars(Object.fromEntries(Object.entries(data??{}).filter(([,v])=>v!==null).map(([k,v])=>[k,String(v)])));
    });return()=>{request.current++;};
  },[employee]);
  const items=form?.pages.flatMap((p,i)=>[...p.texts.map(t=>({key:digitalKey(i,t.id),label:t.text,initial:t.text,page:i})),...p.fields.map(f=>({key:digitalKey(i,f.id),label:f.label,initial:"",page:i}))])??[];
  const active=items.find(x=>x.key===selected);
  const setValue=(value:string)=>{if(selected)setValues(v=>({...v,[selected]:value}));};
  const fileName=template.title.replace(/[^a-z0-9 -]/gi,"");
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent size="document" className="flex flex-col overflow-hidden"><DialogHeader><DialogTitle>{template.title}</DialogTitle></DialogHeader>
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4 md:overflow-y-auto">
        <EmployeePicker value={employee} onChange={id=>{setEmployee(id);setParticulars({});setValues({});setSelected("");}}/>
        {active&&<div className="space-y-3"><Label htmlFor="digital-form-value">{active.label||"Field value"} · page {active.page+1}</Label><Textarea id="digital-form-value" value={values[active.key]??active.initial} onChange={e=>setValue(e.target.value)} rows={4}/><Button variant="outline" onClick={()=>setValues(v=>{const next={...v};delete next[active.key];return next;})}><RotateCcw className="mr-2 h-4 w-4"/>Restore original</Button></div>}
        {Object.entries(particulars).map(([key,value])=><Button key={key} variant="outline" disabled={!active} className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setValue(value)}>{key.replaceAll("_"," ")}: {value}</Button>)}
        <div className="space-y-2">{form?.pages.map((p,i)=><details key={i}><summary className="cursor-pointer text-sm font-medium">Page {i+1} · {p.fields.length} blank fields</summary><div className="space-y-1 pt-2">{p.fields.map((f,n)=><Button key={f.id} variant={selected===digitalKey(i,f.id)?"secondary":"ghost"} className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setSelected(digitalKey(i,f.id))}>{n+1}. {values[digitalKey(i,f.id)]||f.label}</Button>)}</div></details>)}</div>
        {form?.pages.some(p=>p.scanReview)&&<p role="status" className="text-xs text-muted-foreground">Recreated from a scanned or outlined original. Check wording and alignment against the original before submission.</p>}
      </aside>
      <div ref={paper} className="min-w-0 space-y-4 overflow-y-auto bg-muted p-2">{error&&<p role="alert" className="text-destructive">{error}</p>}{!form&&!error&&<p role="status">Loading digital form…</p>}{form?.pages.map((p,i)=><FittedDocument key={i}><svg className="compliance-digital-sheet" role="group" aria-label={`${template.title}, page ${i+1}`} xmlns="http://www.w3.org/2000/svg" width={p.width} height={p.height} viewBox={`0 0 ${p.width} ${p.height}`}>
        <rect width={p.width} height={p.height} className="digital-paper"/>
        {p.paths.map((path,n)=><path key={n} d={path.d} stroke={ink(path.stroke)} fill={ink(path.fill)} strokeWidth={path.width||.5}/>)}
        {p.texts.map(t=>{const key=digitalKey(i,t.id);const value=values[key]??t.text;const [x,y,x1,y1]=t.box;return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{t.text}</title>{values[key]!==undefined&&<rect x={x} y={y} width={x1-x} height={y1-y} className="digital-paper"/>}<text x={t.origin[0]} y={t.origin[1]} fontSize={t.size} fontFamily={t.family} fontWeight={t.bold?700:400} fontStyle={t.italic?'italic':'normal'} fill={textInk(t.color)} textLength={value===t.text||value.length>t.text.length?Math.max(1,x1-x):undefined} lengthAdjust="spacingAndGlyphs">{value}</text><rect x={x} y={y} width={Math.max(3,x1-x)} height={Math.max(3,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection'}/></g>;})}
        {p.fields.map(f=>{const key=digitalKey(i,f.id);const [x,y,x1,y1]=f.box;const value=values[key]??"";return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{f.label}</title><rect x={x} y={y} width={Math.max(1,x1-x)} height={Math.max(1,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection digital-blank'}/><text x={x} y={y+Math.min(f.size,y1-y)} fontFamily="serif" fontSize={Math.max(5,Math.min(f.size,(x1-x)/Math.max(1,value.length)*1.8))} className="digital-ink">{value}</text></g>;})}
      </svg></FittedDocument>)}</div>
    </div>
    <Input ref={upload} type="file" accept=".json,application/json" className="hidden" aria-label="Import editable form draft" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file||!form)return;try{if(file.size>2_000_000)throw new Error('Choose a draft smaller than 2 MB.');setValues(parseDigitalDraft(await file.text(),form));setEmployee("");setSelected("");toast.success("Draft imported");}catch(e){toast.error(e instanceof Error?e.message:"Import failed");}}}/>
    <div className="flex shrink-0 flex-wrap justify-end gap-3 pt-3"><Button variant="outline" onClick={close}>Close</Button><Button variant="outline" disabled={!form} onClick={()=>upload.current?.click()}><FileUp className="mr-2 h-4 w-4"/>Import draft</Button><Button variant="outline" disabled={!canExport||!form} onClick={()=>{const draft:DigitalDraft={templateId:template.id,version:1,values};downloadLetter(new Blob([JSON.stringify(draft)],{type:"application/json"}),`${fileName}-editable.json`);}}><Download className="mr-2 h-4 w-4"/>Export editable draft</Button><Button disabled={!canExport||busy||!form} onClick={async()=>{
      if(!form||!paper.current)return;setBusy(true);
      const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.className='digital-print-frame';document.body.appendChild(frame);
      try{
        const doc=frame.contentDocument;const win=frame.contentWindow;if(!doc||!win)throw new Error('Export window unavailable.');
        const svgs=Array.from(paper.current.querySelectorAll('svg.compliance-digital-sheet')).map(svg=>{const copy=svg.cloneNode(true) as SVGSVGElement;copy.querySelectorAll('.digital-selection').forEach(n=>n.remove());copy.querySelectorAll('.digital-paper').forEach(n=>n.setAttribute('fill','white'));copy.querySelectorAll('.digital-ink').forEach(n=>n.setAttribute('fill','black'));return copy.outerHTML;});
        doc.open();doc.write(digitalPrintHtml(svgs,form.pages,template.title));doc.close();await doc.fonts.ready;win.focus();win.print();
      }catch(e){toast.error(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);setTimeout(()=>frame.remove(),60000);}
    }}><Printer className="mr-2 h-4 w-4"/>{busy?'Preparing…':'Export PDF'}</Button></div>
  </DialogContent></Dialog>;
}