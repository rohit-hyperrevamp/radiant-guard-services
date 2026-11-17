import { digitalKey, type DigitalForm, type DigitalField, type DigitalPage } from './compliance-digital';
import { prefillStatutoryForm, formDate, type EmployeeFormSource } from './statutory-form-data';
import { inLedgerScope, ledgerAmount, statutoryHead } from './statutory-heads';
import type { MonthDed, MonthContrib } from './compliance-month';
import { complianceFieldMappings } from './compliance-field-mappings';

/** Filled answers use one plain sans face that matches the printed forms; measured and rendered identically. */
export const ANSWER_FONT='Arial, Helvetica, sans-serif';
export type AutofillFacts = Record<string,string>;
export function mergeAutofillValues(values:Record<string,string>, previous:Record<string,string>, next:Record<string,string>) {
  const result={...values};
  for(const [key,value] of Object.entries(previous))if(result[key]===value)delete result[key];
  for(const [key,value] of Object.entries(next))if(result[key]===undefined)result[key]=value;
  return result;
}
export function contextualAutofillFacts(month:string, client:{name:string;code:string;address?:string}|null, deds:MonthDed[], contribs:MonthContrib[], employeeId:string, unitId?:string):AutofillFacts {
  const row = monthlyStatutoryRows(deds.filter(d=>(!unitId||d.unit_id===unitId)&&d.deduction_date.startsWith(`${month}-`)),contribs.filter(c=>(!unitId||c.unit_id===unitId)&&c.contribution_date.startsWith(`${month}-`))).find(r=>r.candidateId===employeeId);
  const monthLabel = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}) : '';
  return {month:monthLabel,year:monthLabel?month.slice(0,4):'',serial:employeeId?'1':'',clientName:client?.name??'',clientCode:client?.code??'',clientAddress:client?.address??'',clientNameAddress:[client?.name,client?.address].filter(Boolean).join(', '),...Object.fromEntries(row ? ['employeeEsic','employerEsic','employeePf','employerPf','pt'].map(key=>[key,String(row[key as keyof typeof row])]) : [])};
}
export function employeeAutofillFacts(employee:EmployeeFormSource,employer:EmployeeFormSource):AutofillFacts {
  const facts=prefillStatutoryForm('epf11',employee,employer);
  const pf=prefillStatutoryForm('pf2',employee,employer);
  const esic=prefillStatutoryForm('esic37',employee,employer);
  const other=(employee.other_info&&typeof employee.other_info==='object'?employee.other_info:{}) as Record<string,unknown>;
  const imported=(other.pages_profile&&typeof other.pages_profile==='object'?other.pages_profile:{}) as Record<string,unknown>;
  const compliance=(employee.compliance&&typeof employee.compliance==='object'?employee.compliance:{}) as Record<string,unknown>;
  const pick=(...v:unknown[])=>v.map(x=>typeof x==='string'||typeof x==='number'?String(x).trim():'').find(Boolean)??'';
  // Employer registration codes use *Code keys: employerPf/employerEsic are reserved for posted monthly amounts.
  const {employerEsic:employerEsicCode='',...esicFacts}=esic;
  const merged:AutofillFacts={...facts,...pf,...esicFacts,employerEsicCode,employerPfCode:String(employer.pf_number??''),
    uan:pick(compliance.uan,other.pages_uan),esic:pick(compliance.esic_number,other.pages_esic_no),pf:pick(compliance.pf_number,compliance.epf_number,other.pages_epf_no),
    designation:String(employee.designation??''),employeeCode:String(employee.employee_code??''),joining:formDate(employee.preferred_joining_date)||formDate(imported.doj)||formDate(other.pages_doj),bankAccount:String(employee.bank_account_number??''),ifsc:String(employee.bank_ifsc??'')};
  delete merged.employerPf;
  return {...merged,employeeNameAddress:[merged.name,merged.address].filter(Boolean).join(', '),employerNameAddress:[merged.employerName,merged.employerAddress].filter(Boolean).join(', ')};
}
/** Completed years on the last day of the selected month; blank without a valid saved birth date. */
export function ageAtMonthEnd(dob:unknown,month:string):string {
  const d=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob??''));const m=/^(\d{4})-(\d{2})$/.exec(month);if(!d||!m)return '';
  const end=new Date(Date.UTC(+m[1],+m[2],0));let age=end.getUTCFullYear()-+d[1];
  if(end.getUTCMonth()+1<+d[2]||(end.getUTCMonth()+1===+d[2]&&end.getUTCDate()<+d[3]))age--;
  return age>=0&&age<120?String(age):'';
}
export function factForLabel(label:string):string|null {
  const n=label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  // Never infer event dates, signatures, nominees, medical facts or wage bases.
  if (/signature|thumb|nominee|witness|accident|injur|previous|passport|declar|principal employer|contractor|wage rate|\bage\b/.test(n))return null;
  if (/^(?:for the |for |wage |salary |return )?month(?: and year)?$/.test(n))return 'month';
  if (/^(?:client|site) name$|^name of (?:the )?(?:client|site)$/.test(n))return 'clientName';
  if (/^(?:client|site) (?:code|id)$/.test(n))return 'clientCode';
  if (/^(?:client|site) address$/.test(n))return 'clientAddress';
  if (/name.*address.*(?:establishment|employer)/.test(n))return 'employerNameAddress';
  if (/name.*(?:employee|worker|workman).*address/.test(n))return 'employeeNameAddress';
  if (/name.*(?:establishment|employer)|company name/.test(n))return 'employerName';
  if (/address.*(?:establishment|employer)|registered address/.test(n))return 'employerAddress';
  if (/employer.*(?:esic|esi).*code/.test(n))return 'employerEsicCode';
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
    const key=digitalKey(i,f.id);
    // Repeated register rows must not all acquire the same employee from nearby headings.
    const fact=f.factKey??complianceFieldMappings[form.id]?.[key]??(f.label.startsWith('Table cell')?null:factForLabel(f.label)??factForLabel(labelForDigitalField(p,f)));
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