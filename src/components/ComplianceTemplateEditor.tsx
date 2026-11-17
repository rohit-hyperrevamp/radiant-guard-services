import { useEffect, useRef, useState } from "react";
import { Download, FileUp, RotateCcw, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FittedDocument } from "@/components/FittedDocument";
import { EmployeePicker } from "@/components/EmployeePicker";
import { recDb } from "@/lib/recruitment";
import { downloadLetter } from "@/lib/employment-letters";
import type { ComplianceTemplate } from "@/lib/compliance-form-catalog";
import { digitalKey, digitalPrintHtml, digitalFieldLines, parseDigitalDraft, type DigitalForm, type DigitalDraft } from "@/lib/compliance-digital";
import { autoFillDigital, employeeAutofillFacts } from '@/lib/compliance-autofill';
import { supabase } from '@/integrations/supabase/client';
import { MonthYearPicker } from '@/components/MonthYearPicker';
import { ComplianceMonthlyForms } from '@/components/ComplianceMonthlyForms';

// Source colours are document content, not application theme colours.
const ink = (rgb: number[] | null) => rgb ? `rgb(${rgb.map(c=>Math.round(c*255)).join(',')})` : 'none';
const textInk = (n: number) => `rgb(${n>>16&255},${n>>8&255},${n&255})`;

export function ComplianceTemplateEditor({ template, close, canExport, initialMonth }: { template: ComplianceTemplate; close: () => void; canExport: boolean; initialMonth?:string }) {
  const [form,setForm]=useState<DigitalForm|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState("");
  const [employee,setEmployee]=useState("");
  const [particulars,setParticulars]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [sourceBusy,setSourceBusy]=useState(false);
  const [month,setMonth]=useState(initialMonth??new Date().toISOString().slice(0,7));
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
    const current=++request.current;setParticulars({});setSourceBusy(false);if(!employee||!form)return;
    setSourceBusy(true);
    void Promise.all([
      recDb.from("candidates").select("id,full_name,employee_code,date_of_birth,preferred_joining_date,mobile,personal_mobile,email,gender,marital_status,aadhaar_number,pan_number,bank_account_number,bank_ifsc,permanent_address1,permanent_address2,permanent_city,permanent_district,permanent_state,permanent_pincode,compliance,contacts,other_info").eq("id",employee).single(),
      supabase.from('org_settings').select('company_name,registered_address,esic_number,pf_number').maybeSingle()
    ]).then(([person,org])=>{
      if(request.current!==current)return;
      setSourceBusy(false);
      if(person.error||org.error){toast.error("Employee details could not be loaded");return;}
      const facts=employeeAutofillFacts(person.data??{},org.data??{});
      setParticulars(facts);setValues(autoFillDigital(form,facts));
    });return()=>{request.current++;};
  },[employee,form]);
  const items=form?.pages.flatMap((p,i)=>[...p.texts.map(t=>({key:digitalKey(i,t.id),label:t.text,initial:t.text,page:i})),...p.fields.map(f=>({key:digitalKey(i,f.id),label:f.label,initial:"",page:i}))])??[];
  const active=items.find(x=>x.key===selected);
  const overflowItems=form?.pages.flatMap((p,i)=>[...p.texts,...p.fields].filter(t=>{const value=values[digitalKey(i,t.id)];return value!==undefined&&('text' in t?value!==t.text:true)&&digitalFieldLines(value,t.box,t.size).overflow;}))??[];
  const setValue=(value:string)=>{if(selected)setValues(v=>({...v,[selected]:value}));};
  const fileName=template.title.replace(/[^a-z0-9 -]/gi,"");
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent size="document" className="flex h-[calc(100dvh-1.5rem)] flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-10"><DialogTitle>{template.title}</DialogTitle></DialogHeader>
    <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0 space-y-2"><Label>Employee</Label><EmployeePicker value={employee} onChange={id=>{setEmployee(id);setParticulars({});setValues({});setSelected("");}}/></div>
      <div className="min-w-0 space-y-2"><Label>Month</Label><MonthYearPicker value={month} onChange={setMonth} className="flex w-full max-w-full sm:w-auto [&_[role=combobox]]:min-w-[90px] [&_[role=combobox]]:whitespace-nowrap"/></div>
    </div>
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-2">
        {sourceBusy&&<p role="status" className="text-sm text-muted-foreground">Filling employee information…</p>}
        {overflowItems.length>0&&<p role="alert" className="text-sm text-destructive">Some information is too long for its field. Shorten it before exporting.</p>}
        {active&&<div className="space-y-3"><Label htmlFor="digital-form-value">{active.label||"Field value"} · page {active.page+1}</Label><Textarea id="digital-form-value" value={values[active.key]??active.initial} onChange={e=>setValue(e.target.value)} rows={4}/><Button variant="outline" onClick={()=>setValues(v=>{const next={...v};delete next[active.key];return next;})}><RotateCcw className="mr-2 h-4 w-4"/>Restore original</Button></div>}
        <div className="space-y-2"><Label>Form field</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Choose a field"/></SelectTrigger><SelectContent>{items.filter(item=>!item.initial).map(item=><SelectItem key={item.key} value={item.key}>Page {item.page+1} · {item.label}</SelectItem>)}</SelectContent></Select></div>
        {Object.values(particulars).some(Boolean)&&<div className="space-y-2"><Label>Employee information</Label><Select value="" disabled={!active||sourceBusy} onValueChange={key=>setValue(particulars[key]??"")}><SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Insert saved information"/></SelectTrigger><SelectContent>{Object.entries(particulars).filter(([,value])=>value).map(([key,value])=><SelectItem key={key} value={key}>{key.replaceAll("_"," ")}: {value}</SelectItem>)}</SelectContent></Select></div>}
        {form?.pages.some(p=>p.scanReview)&&<p role="status" className="text-xs text-muted-foreground">Recreated from a scanned or outlined original. Check wording and alignment against the original before submission.</p>}
      </aside>
      <div ref={paper} className="min-w-0 space-y-4 overflow-y-auto bg-muted p-2">{error&&<p role="alert" className="text-destructive">{error}</p>}{!form&&!error&&<p role="status">Loading digital form…</p>}{form?.pages.map((p,i)=><FittedDocument key={i}><svg className="compliance-digital-sheet" role="group" aria-label={`${template.title}, page ${i+1}`} xmlns="http://www.w3.org/2000/svg" width={p.width} height={p.height} viewBox={`0 0 ${p.width} ${p.height}`}>
        <rect width={p.width} height={p.height} className="digital-paper"/>
        {p.sourceArtwork?<g dangerouslySetInnerHTML={{__html:p.sourceArtwork}}/>:p.paths.map((path,n)=><path key={n} d={path.d} stroke={ink(path.stroke)} fill={ink(path.fill)} strokeWidth={path.width??.5}/>)}
        {p.texts.map(t=>{const key=digitalKey(i,t.id);const value=values[key]??t.text;const unchanged=value===t.text;const [x,y,x1,y1]=t.box;const angle=t.direction?Math.atan2(t.direction[1],t.direction[0])*180/Math.PI:0;const fitted=digitalFieldLines(value,t.box,t.size);return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{t.text}</title>{!unchanged&&<rect x={x} y={y} width={x1-x} height={y1-y} className="digital-paper"/>}{unchanged&&t.sourceMarkup?<g dangerouslySetInnerHTML={{__html:t.sourceMarkup}}/>:unchanged&&t.outlined?null:<text x={unchanged?t.origin[0]:x} y={unchanged?t.origin[1]:y+fitted.size} transform={unchanged&&angle?`rotate(${angle} ${t.origin[0]} ${t.origin[1]})`:undefined} fontSize={unchanged?t.size:fitted.size} fontFamily={t.family} fontWeight={t.bold?700:400} fontStyle={t.italic?'italic':'normal'} fill={textInk(t.color)}>{unchanged?value:fitted.lines.map((line,n)=><tspan key={n} x={x} dy={n?fitted.size*1.15:0}>{line}</tspan>)}</text>}<rect x={x} y={y} width={Math.max(3,x1-x)} height={Math.max(3,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection'}/></g>;})}
        {p.fields.map(f=>{const key=digitalKey(i,f.id);const [x,y,x1,y1]=f.box;const value=values[key]??"";const fitted=digitalFieldLines(value,f.box,f.size);return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{f.label}</title>{value&&f.placeholder&&<rect x={x} y={y} width={x1-x} height={y1-y} className="digital-paper"/>}<rect x={x} y={y} width={Math.max(1,x1-x)} height={Math.max(1,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection digital-blank'}/><text x={x} y={y+fitted.size} fontFamily="serif" fontSize={fitted.size} className="digital-ink">{fitted.lines.map((line,n)=><tspan key={n} x={x} dy={n?fitted.size*1.15:0}>{line}</tspan>)}</text></g>;})}
      </svg></FittedDocument>)}</div>
    </div>
    <details className="shrink-0"><summary className="cursor-pointer text-sm font-medium">Monthly statutory records · {month}</summary><div className="max-h-[25dvh] overflow-auto pt-2"><ComplianceMonthlyForms month={month} onEmployee={id=>{setEmployee(id);setValues({});setSelected('');}}/></div></details>
    <Input ref={upload} type="file" accept=".json,application/json" className="hidden" aria-label="Import editable form draft" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file||!form)return;try{if(file.size>2_000_000)throw new Error('Choose a draft smaller than 2 MB.');setValues(parseDigitalDraft(await file.text(),form));setEmployee("");setSelected("");toast.success("Draft imported");}catch(e){toast.error(e instanceof Error?e.message:"Import failed");}}}/>
    <div className="flex shrink-0 flex-wrap justify-end gap-3 pt-3"><Button variant="outline" onClick={close}>Close</Button><Button variant="outline" disabled={!form} onClick={()=>upload.current?.click()}><FileUp className="mr-2 h-4 w-4"/>Import draft</Button><Button variant="outline" disabled={!canExport||!form} onClick={()=>{const draft:DigitalDraft={templateId:template.id,version:1,values};downloadLetter(new Blob([JSON.stringify(draft)],{type:"application/json"}),`${fileName}-editable.json`);}}><Download className="mr-2 h-4 w-4"/>Export editable draft</Button><Button disabled={!canExport||busy||!form} onClick={async()=>{
      if(!form||!paper.current)return;if(overflowItems.length){toast.error('Shorten overflowing fields before exporting.');return;}setBusy(true);
      const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.className='digital-print-frame';document.body.appendChild(frame);
      try{
        const doc=frame.contentDocument;const win=frame.contentWindow;if(!doc||!win)throw new Error('Export window unavailable.');
        const svgs=Array.from(paper.current.querySelectorAll('svg.compliance-digital-sheet')).map(svg=>{const copy=svg.cloneNode(true) as SVGSVGElement;copy.querySelectorAll('.digital-selection').forEach(n=>n.remove());copy.querySelectorAll('.digital-paper').forEach(n=>n.setAttribute('fill','white'));copy.querySelectorAll('.digital-ink').forEach(n=>n.setAttribute('fill','black'));return copy.outerHTML;});
        doc.open();doc.write(digitalPrintHtml(svgs,form.pages,template.title));doc.close();await doc.fonts.ready;win.focus();win.print();
      }catch(e){toast.error(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);setTimeout(()=>frame.remove(),60000);}
    }}><Printer className="mr-2 h-4 w-4"/>{busy?'Preparing…':'Export PDF'}</Button></div>
  </DialogContent></Dialog>;
}