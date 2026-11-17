import { digitalKey, type DigitalForm, type DigitalField, type DigitalPage } from './compliance-digital';
import { prefillStatutoryForm, formDate, type EmployeeFormSource } from './statutory-form-data';
import { inLedgerScope, ledgerAmount, statutoryHead } from './statutory-heads';
import type { MonthDed, MonthContrib } from './compliance-month';

export type AutofillFacts = Record<string,string>;
export function employeeAutofillFacts(employee:EmployeeFormSource,employer:EmployeeFormSource):AutofillFacts {
  const facts=prefillStatutoryForm('epf11',employee,employer);
  const pf=prefillStatutoryForm('pf2',employee,employer);
  const esic=prefillStatutoryForm('esic37',employee,employer);
  return {...facts,...pf,...esic,designation:String(employee.designation??''),employeeCode:String(employee.employee_code??''),joining:formDate(employee.preferred_joining_date),employerPf:String(employer.pf_number??''),bankAccount:String(employee.bank_account_number??''),ifsc:String(employee.bank_ifsc??''),employeeNameAddress:[facts.name,facts.address].filter(Boolean).join(', '),employerNameAddress:[facts.employerName,facts.employerAddress].filter(Boolean).join(', ')};
}
export function factForLabel(label:string):string|null {
  const n=label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  // Never infer event dates, signatures, nominees, medical facts or wage bases.
  if (/signature|thumb|nominee|witness|accident|injur|previous|passport|declar|principal employer|contractor|wage rate|\bage\b/.test(n))return null;
  if (/name.*address.*(?:establishment|employer)/.test(n))return 'employerNameAddress';
  if (/name.*(?:employee|worker|workman).*address/.test(n))return 'employeeNameAddress';
  if (/name.*(?:establishment|employer)|company name/.test(n))return 'employerName';
  if (/address.*(?:establishment|employer)|registered address/.test(n))return 'employerAddress';
  if (/employer.*(?:esic|esi).*code/.test(n))return 'employerEsic';
  if (/\buan\b|universal account/.test(n))return 'uan';
  if (/\b(?:esic|esi|insurance)\b.*(?:number|no)|insurance no/.test(n))return 'esic';
  if (/\bpf\b.*(?:number|no)|provident fund.*number/.test(n))return 'pf';
  if (/aadhaar|aadhar/.test(n))return 'aadhaar';
  if (/\bpan\b/.test(n))return 'pan';
  if (/ifsc/.test(n))return 'ifsc';
  if (/bank.*account/.test(n))return 'bankAccount';
  if (/father|husband/.test(n))return 'father';
  if (/date of birth|\bdob\b/.test(n))return 'dob';
  if (/date.*(?:join|entry.*(?:service|employment))/.test(n))return 'joining';
  if (/mobile|phone/.test(n))return 'mobile';
  if (/e mail|email/.test(n))return 'email';
  if (/sex|gender/.test(n))return 'gender';
  if (/marital|married unmarried/.test(n))return 'marital';
  if (/address/.test(n)&&! /establishment|employer/.test(n))return 'address';
  if (/name.*(?:employee|worker|workman)|employee name/.test(n))return 'name';
  if (/employee.*(?:code|number)|serial no.*register/.test(n))return 'employeeCode';
  return null;
}
export function labelForDigitalField(page:DigitalPage,field:DigitalField):string {
  const [x,y,x1,y1]=field.box;
  // Only horizontally adjacent labels: table headers require per-form reviewed mapping.
  const left=page.texts.filter(t=>t.box[2]<=x+2&&t.box[1]<y1&&t.box[3]>y&&x-t.box[2]<260).sort((a,b)=>b.box[2]-a.box[2]);
  if(left.length)return left.slice(0,3).sort((a,b)=>a.box[0]-b.box[0]).map(t=>t.text.trim()).join(' ');
  return field.label;
}
export function autoFillDigital(form:DigitalForm,facts:AutofillFacts):Record<string,string> {
  const values:Record<string,string>={};
  form.pages.forEach((p,i)=>p.fields.forEach(f=>{
    const fact=f.factKey??factForLabel(labelForDigitalField(p,f));
    if(fact&&facts[fact])values[digitalKey(i,f.id)]=facts[fact];
  }));
  return values;
}
export function monthlyStatutoryRows(deds:MonthDed[],contribs:MonthContrib[]) {
  const rows=new Map<string,{candidateId:string;employeeEsic:number;employerEsic:number;employeePf:number;employerPf:number;pt:number}>();
  const get=(id:string)=>{let row=rows.get(id);if(!row){row={candidateId:id,employeeEsic:0,employerEsic:0,employeePf:0,employerPf:0,pt:0};rows.set(id,row);}return row;};
  for(const d of deds){if(!d.candidate_id||!inLedgerScope(d,'posted'))continue;const h=statutoryHead(d.deduction_name);if(h!=='esic'&&h!=='epf'&&h!=='pt')continue;const r=get(d.candidate_id);r[h==='esic'?'employeeEsic':h==='epf'?'employeePf':'pt']+=ledgerAmount(d);}
  for(const c of contribs){if(!c.candidate_id||!inLedgerScope(c,'posted'))continue;const h=statutoryHead(c.contribution_name);if(h!=='esic'&&h!=='epf')continue;const r=get(c.candidate_id);r[h==='esic'?'employerEsic':'employerPf']+=ledgerAmount(c);}
  return [...rows.values()];
}