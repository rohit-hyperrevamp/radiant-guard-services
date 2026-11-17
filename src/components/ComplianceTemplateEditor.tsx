import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FittedDocument } from "@/components/FittedDocument";
import { recDb } from "@/lib/recruitment";
import { downloadLetter } from "@/lib/employment-letters";
import type { ComplianceTemplate } from "@/lib/compliance-form-catalog";
import { digitalKey, digitalPrintHtml, digitalFieldLines, digitalAnswerLayout, parseDigitalDraft, type DigitalForm, type DigitalDraft } from "@/lib/compliance-digital";
import { autoFillDigital, employeeAutofillFacts, contextualAutofillFacts, mergeAutofillValues, ageAtMonthEnd, ANSWER_FONT } from '@/lib/compliance-autofill';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { complianceMonthQuery } from '@/lib/compliance-month';
import { useCurrentPermissions } from '@/lib/rbac';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { ComplianceFormControls, type FormClient } from './ComplianceFormControls';
import { ComplianceFieldEditor } from './ComplianceFieldEditor';
import { ComplianceMonthlyForms } from '@/components/ComplianceMonthlyForms';
import { reviewedDigitalLayout } from '@/lib/compliance-reviewed-layout';

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
  const [imported,setImported]=useState(false);
  const [month,setMonth]=useState(initialMonth??new Date().toISOString().slice(0,7));
  const [client,setClient]=useState<FormClient|null>(null);
  const [profileFacts,setProfileFacts]=useState<Record<string,string>>({});
  const [birthDate,setBirthDate]=useState('');
  const [fontRevision,setFontRevision]=useState(0);
  const permissions=useCurrentPermissions();const session=useHasSupabaseSession();
  const ledger=useQuery({...complianceMonthQuery(month,'posted'),enabled:session&&permissions.can('compliance','view')&&!!employee});
  const measure=useMemo(()=>{if(typeof document==='undefined')return undefined;const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)return undefined;return (text:string,size:number)=>{ctx.font=`${size}px ${ANSWER_FONT}`;return ctx.measureText(text).width;};},[fontRevision]);
  useEffect(()=>{let live=true;void document.fonts.ready.then(()=>{if(live)setFontRevision(n=>n+1);});return()=>{live=false;};},[]);
  const paper=useRef<HTMLDivElement>(null);
  const upload=useRef<HTMLInputElement>(null);
  const request=useRef(0);
  const autoValues=useRef<Record<string,string>>({});
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/compliance-digital/${template.id}.json`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error("Digital form could not be loaded.");
      const data:DigitalForm=await response.json();if(!controller.signal.aborted)setForm(reviewedDigitalLayout(data));
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Form could not be loaded.");});
    return()=>controller.abort();
  },[template.id]);
  useEffect(()=>{
    const current=++request.current;setProfileFacts({});setBirthDate('');setSourceBusy(false);if(!form||!session||imported)return;
    setSourceBusy(true);
    void Promise.all([
      employee?recDb.from("candidates").select("id,full_name,employee_code,designation_id,date_of_birth,preferred_joining_date,mobile,personal_mobile,email,gender,marital_status,aadhaar_number,pan_number,bank_account_number,bank_ifsc,permanent_address1,permanent_address2,permanent_city,permanent_district,permanent_state,permanent_pincode,compliance,contacts,other_info").eq("id",employee).single():Promise.resolve({data:null,error:null}),
      supabase.from('org_settings').select('company_name,registered_address,esic_number,pf_number').maybeSingle()
    ]).then(async ([person,org])=>{
      if(request.current!==current)return;
      if(person.error||org.error){setSourceBusy(false);toast.error("Saved details could not be loaded");return;}
      // Imported employees often keep their role only in the posting designation list.
      const posted=person.data&&!person.data.designation_id?await recDb.from('candidate_designations').select('designation_id,is_primary').eq('candidate_id',person.data.id).order('is_primary',{ascending:false}).limit(1).maybeSingle():null;
      const designationId=person.data?.designation_id??posted?.data?.designation_id??null;
      const designation=designationId?await recDb.from('designations').select('name').eq('id',designationId).maybeSingle():null;
      if(request.current!==current)return;
      const facts=employeeAutofillFacts({...person.data,designation:designation?.data?.name??''},org.data??{});
      setProfileFacts(facts);setBirthDate(String(person.data?.date_of_birth??''));setSourceBusy(false);
    }).catch(()=>{if(request.current===current){setSourceBusy(false);toast.error('Saved details could not be loaded');}});return()=>{request.current++;};
  },[employee,form,session,imported]);
  useEffect(()=>{
    if(!form||imported)return;
    const facts={...profileFacts,...contextualAutofillFacts(month,client?{name:client.name,code:client.code,address:[client.shipping_address1,client.shipping_address2].filter(Boolean).join(', ')}:null,ledger.data?.deds??[],ledger.data?.contribs??[],employee,client?.id),age:ageAtMonthEnd(birthDate,month)};
    setParticulars(facts);
    const next=autoFillDigital(form,facts);
    const previous=autoValues.current;
    setValues(values=>mergeAutofillValues(values,previous,next));
    autoValues.current=next;
  },[form,profileFacts,birthDate,client,month,employee,ledger.data,imported]);
  const items=form?.pages.flatMap((p,i)=>[...p.texts.map(t=>({key:digitalKey(i,t.id),label:t.text,initial:t.text,page:i})),...p.fields.map(f=>({key:digitalKey(i,f.id),label:f.label,initial:"",page:i}))])??[];
  const overflowItems=form?.pages.flatMap((p,i)=>[...p.texts,...p.fields].filter(t=>{const value=values[digitalKey(i,t.id)];return value!==undefined&&('text' in t?value!==t.text:true)&&digitalFieldLines(value,t.box,t.size,measure).overflow;}))??[];
  const fileName=template.title.replace(/[^a-z0-9 -]/gi,"");
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent size="document" className="flex h-[calc(100dvh-1.5rem)] flex-col overflow-hidden"><DialogHeader className="shrink-0 pr-10"><DialogTitle>{template.title}</DialogTitle></DialogHeader>
    <ComplianceFormControls employee={employee} onEmployee={id=>{setImported(false);setEmployee(id);setValues({});setSelected('');autoValues.current={};}} month={month} onMonth={value=>{setImported(false);setMonth(value);}} client={client} onClient={value=>{setImported(false);setClient(value);}}/>
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-2">
        {sourceBusy&&<p role="status" className="text-sm text-muted-foreground">Filling employee information…</p>}
        {overflowItems.length>0&&<p role="alert" className="text-sm text-destructive">Some information is too long for its field. Shorten it before exporting.</p>}
        <ComplianceFieldEditor items={items.filter(item=>!item.initial||item.key===selected)} selected={selected} onSelect={setSelected} values={values} onChange={(key,value)=>setValues(v=>({...v,[key]:value}))} onRestore={key=>setValues(v=>{const next={...v};delete next[key];return next;})} facts={particulars}/>
        {ledger.isError&&<p role="alert" className="text-sm text-destructive">Monthly information could not be loaded.</p>}
        {form?.pages.some(p=>p.scanReview)&&<p role="status" className="text-xs text-muted-foreground">Recreated from a scanned or outlined original. Check wording and alignment against the original before submission.</p>}
      </aside>
      <div ref={paper} className="min-w-0 space-y-4 overflow-y-auto bg-muted p-2">{error&&<p role="alert" className="text-destructive">{error}</p>}{!form&&!error&&<p role="status">Loading digital form…</p>}{form?.pages.map((p,i)=><FittedDocument key={i}><svg className="compliance-digital-sheet" role="group" aria-label={`${template.title}, page ${i+1}`} xmlns="http://www.w3.org/2000/svg" width={p.width} height={p.height} viewBox={`0 0 ${p.width} ${p.height}`}>
        <rect width={p.width} height={p.height} className="digital-paper"/>
        {p.sourceArtwork?<g dangerouslySetInnerHTML={{__html:p.sourceArtwork}}/>:p.paths.map((path,n)=><path key={n} d={path.d} stroke={ink(path.stroke)} fill={ink(path.fill)} strokeWidth={path.width??.5}/>)}
        {p.texts.map(t=>{const key=digitalKey(i,t.id);const value=values[key]??t.text;const unchanged=value===t.text;const [x,y,x1,y1]=t.box;const angle=t.direction?Math.atan2(t.direction[1],t.direction[0])*180/Math.PI:0;const fitted=digitalFieldLines(value,t.box,t.size,measure);return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{t.text}</title>{!unchanged&&<rect x={x} y={y} width={x1-x} height={y1-y} className="digital-paper"/>}{unchanged&&t.sourceMarkup?<g dangerouslySetInnerHTML={{__html:t.sourceMarkup}}/>:unchanged&&t.outlined?null:<text x={unchanged?t.origin[0]:x} y={unchanged?t.origin[1]:y+fitted.size} transform={unchanged&&angle?`rotate(${angle} ${t.origin[0]} ${t.origin[1]})`:undefined} fontSize={unchanged?t.size:fitted.size} fontFamily={t.family} fontWeight={t.bold?700:400} fontStyle={t.italic?'italic':'normal'} fill={textInk(t.color)}>{unchanged?value:fitted.lines.map((line,n)=><tspan key={n} x={x} dy={n?fitted.size*1.15:0}>{line}</tspan>)}</text>}<rect x={x} y={y} width={Math.max(3,x1-x)} height={Math.max(3,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection'}/></g>;})}
        {p.fields.map(f=>{const key=digitalKey(i,f.id);const [x,y,x1,y1]=f.box;const value=values[key]??"";const fitted=digitalAnswerLayout(value,f.box,f.size,measure);return <g key={key} className="cursor-text" onClick={()=>setSelected(key)}><title>{f.label}</title>{value&&f.placeholder&&<><rect x={x} y={y} width={x1-x} height={y1-y} className="digital-paper"/><line x1={x} x2={x1} y1={y1} y2={y1} className="digital-rule" strokeWidth=".5" strokeDasharray="1 2"/></>}<rect x={x} y={y} width={Math.max(1,x1-x)} height={Math.max(1,y1-y)} className={selected===key?'digital-selection digital-selected':'digital-selection digital-blank'}/><text x={fitted.x} y={fitted.baseline} fontFamily={ANSWER_FONT} fontSize={fitted.size} className="digital-ink">{fitted.lines.map((line,n)=><tspan key={n} x={x} dy={n?fitted.size*1.15:0}>{line}</tspan>)}</text></g>;})}
      </svg></FittedDocument>)}</div>
    </div>
    <details className="shrink-0"><summary className="cursor-pointer text-sm font-medium">Monthly statutory records · {month}</summary><div className="max-h-[25dvh] overflow-auto pt-2"><ComplianceMonthlyForms month={month} unitId={client?.id} onEmployee={id=>{setImported(false);setEmployee(id);setValues({});autoValues.current={};setSelected('');}}/></div></details>
    <Input ref={upload} type="file" accept=".json,application/json" className="hidden" aria-label="Import editable form draft" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file||!form)return;try{if(file.size>2_000_000)throw new Error('Choose a draft smaller than 2 MB.');const draft=parseDigitalDraft(await file.text(),form);request.current++;setImported(true);setSourceBusy(false);setProfileFacts({});setParticulars({});setValues(draft);setEmployee("");autoValues.current={};setSelected("");toast.success("Draft imported");}catch(e){toast.error(e instanceof Error?e.message:"Import failed");}}}/>
    <div className="flex shrink-0 flex-wrap justify-end gap-3 pt-3"><Button variant="outline" onClick={close}>Close</Button><Button variant="outline" disabled={!form} onClick={()=>upload.current?.click()}><FileUp className="mr-2 h-4 w-4"/>Import draft</Button><Button variant="outline" disabled={!canExport||!form} onClick={()=>{const draft:DigitalDraft={templateId:template.id,version:1,values};downloadLetter(new Blob([JSON.stringify(draft)],{type:"application/json"}),`${fileName}-editable.json`);}}><Download className="mr-2 h-4 w-4"/>Export editable draft</Button><Button disabled={!canExport||busy||!form} onClick={async()=>{
      if(!form||!paper.current)return;if(overflowItems.length){toast.error('Shorten overflowing fields before exporting.');return;}setBusy(true);
      const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.className='digital-print-frame';document.body.appendChild(frame);
      try{
        const doc=frame.contentDocument;const win=frame.contentWindow;if(!doc||!win)throw new Error('Export window unavailable.');
        const svgs=Array.from(paper.current.querySelectorAll('svg.compliance-digital-sheet')).map(svg=>{const copy=svg.cloneNode(true) as SVGSVGElement;copy.querySelectorAll('.digital-selection').forEach(n=>n.remove());copy.querySelectorAll('.digital-paper').forEach(n=>n.setAttribute('fill','white'));copy.querySelectorAll('.digital-rule').forEach(n=>n.setAttribute('stroke','black'));copy.querySelectorAll('.digital-ink').forEach(n=>n.setAttribute('fill','black'));return copy.outerHTML;});
        doc.open();doc.write(digitalPrintHtml(svgs,form.pages,template.title));doc.close();await doc.fonts.ready;win.focus();win.print();
      }catch(e){toast.error(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);setTimeout(()=>frame.remove(),60000);}
    }}><Printer className="mr-2 h-4 w-4"/>{busy?'Preparing…':'Export PDF'}</Button></div>
  </DialogContent></Dialog>;
}