import { describe,expect,it } from 'vitest';
import { employeeAutofillFacts,factForLabel,autoFillDigital,monthlyStatutoryRows,contextualAutofillFacts,mergeAutofillValues } from './compliance-autofill';
import type { DigitalForm } from './compliance-digital';
import type { MonthDed,MonthContrib } from './compliance-month';
import { readFileSync } from 'node:fs';
import { reviewedDigitalLayout } from './compliance-reviewed-layout';
describe('compliance factual autofill',()=>{
  it('reviewed wage-slip fields fill a single name, month and identifiers, not repeated columns',()=>{
    const form=reviewedDigitalLayout(JSON.parse(readFileSync('public/compliance-digital/compliance-30.json','utf8')));
    expect(autoFillDigital(form,{name:'Test Employee',father:'Test Father',month:'November 2026',uan:'100001',bankAccount:'200002',designation:'Guard',employeePf:'1800',employeeEsic:'150',employerEsic:'650'})).toMatchObject({'0:field-0':'Test Employee','0:field-3':'Test Father','0:field-6':'Guard','0:field-9':'100001','0:field-12':'200002','0:field-15':'November 2026','0:review-employee-pf':'1800','0:review-employee-esic':'150'});
    expect(form.pages[0].fields.find(f=>f.id==='field-0')?.box).toEqual([273.4,319.6,460.8,328.6]);
    expect(form.pages[0].fields.some(f=>f.id==='field-1')).toBe(false);
  });
  it('changes automatically filled context but preserves manually entered answers',()=>{
    expect(mergeAutofillValues({name:'Employee',month:'September 2026',client:'Manual Client',amount:'500'}, {name:'Employee',month:'September 2026',client:'Original Client'}, {name:'Employee',month:'October 2026',client:'Next Client'})).toEqual({name:'Employee',month:'October 2026',client:'Manual Client',amount:'500'});
    expect(mergeAutofillValues({amount:'150'},{amount:'150'},{})).toEqual({});
  });
  it('reviewed first register row fills only one selected employee, never all repeated rows',()=>{
    const form:DigitalForm=JSON.parse(readFileSync('public/compliance-digital/compliance-06.json','utf8'));
    const values=autoFillDigital(form,{name:'Test Employee',father:'Test Father',designation:'Security Guard'});
    expect(values).toEqual({'0:field-1':'Test Employee','0:field-2':'Test Father','0:field-4':'Security Guard'});
    expect(values['0:field-9']).toBeUndefined();expect(values['0:field-6']).toBeUndefined();
  });
  it('selected month and client provide applicable facts without replacing the legal employer',()=>{
    const facts=contextualAutofillFacts('2026-11',{name:'Test Client',code:'CLI100',address:'Site address'},[],[],'employee');
    expect(facts).toMatchObject({month:'November 2026',clientName:'Test Client',clientCode:'CLI100',clientAddress:'Site address'});
    expect(facts.employerName).toBeUndefined();expect(factForLabel('Month and year')).toBe('month');expect(factForLabel('Client name')).toBe('clientName');
    expect(factForLabel('Accounting year ending')).toBeNull();expect(factForLabel('Signature date')).toBeNull();
  });
  it('monthly amounts are scoped to the selected employee, month and original client site',()=>{
    const ded=(id:string,unit_id:string,candidate_id:string,month:string,amount:number):MonthDed=>({id,unit_id,candidate_id,deduction_date:`${month}-30`,deduction_name:'ESIC',amount,computed_amount:null,status:'completed',source_kind:null,source_ref:null});
    const rows=[ded('a','site-a','employee','2026-09',150),ded('b','site-b','employee','2026-09',200),ded('c','site-a','another','2026-09',500),ded('d','site-a','employee','2026-10',900)];
    expect(contextualAutofillFacts('2026-09',null,rows,[],'employee','site-a').employeeEsic).toBe('150');
    expect(contextualAutofillFacts('2026-09',null,rows,[],'employee','site-b').employeeEsic).toBe('200');
    expect(contextualAutofillFacts('2026-11',null,rows,[],'employee','site-a').employeeEsic).toBeUndefined();
  });
  it('Bonus Register fills the selected employee, father, designation and establishment without inventing financial entries',()=>{
    const form:DigitalForm=JSON.parse(readFileSync('public/compliance-digital/compliance-05.json','utf8'));
    const facts=employeeAutofillFacts({full_name:'Test Guard',designation:'Security Guard',other_info:{father_name:'Test Father'}},{company_name:'Radiant Guard Services'});
    const values=autoFillDigital(form,facts);
    expect(values).toEqual({'0:employee-name':'Test Guard','0:father-name':'Test Father','0:designation':'Security Guard','0:establishment':'Radiant Guard Services'});
    expect(values['0:bonus-payable']).toBeUndefined();expect(values['0:signature']).toBeUndefined();
    const next=autoFillDigital(form,employeeAutofillFacts({full_name:'Second Guard'},{company_name:'Radiant Guard Services'}));
    expect(next['0:employee-name']).toBe('Second Guard');expect(next['0:father-name']).toBeUndefined();
  });
  it('copies employee and employer facts, leaving unavailable identifiers blank',()=>{
    const f=employeeAutofillFacts({full_name:'Review Employee',date_of_birth:'1990-09-10',compliance:{esic_number:'123456',uan:'987654'},bank_account_number:'111',bank_ifsc:'ABCD001'},{company_name:'Radiant'});
    expect(f.name).toBe('Review Employee');expect(f.dob).toBe('10/09/1990');expect(f.esic).toBe('123456');expect(f.uan).toBe('987654');expect(f.bankAccount).toBe('111');expect(f.ifsc).toBe('ABCD001');expect(f.pan).toBe('');
  });
  it('never infers signatures, accident facts, principal employer or previous membership',()=>{
    for(const label of ['Signature of employee','Date of accident','Principal employer name','Previous PF number'])expect(factForLabel(label)).toBeNull();
  });
  it('fills a labelled adjacent field without modifying printed text',()=>{
    const form:DigitalForm={id:'test',version:1,pages:[{width:600,height:800,scanReview:false,paths:[],texts:[{id:'label',text:'Name of employee',box:[10,10,100,25],origin:[10,20],size:10,family:'serif',bold:false,italic:false,color:0}],fields:[{id:'name',box:[110,10,300,25],size:10,label:'Blank'}]}]};
    expect(autoFillDigital(form,{name:'Test Employee'})).toEqual({'0:name':'Test Employee'});
  });
  it('September posted sums preserve computed values and separate employee/employer, excluding pending records',()=>{
    const ded=(id:string,amount:number,computed_amount:number|null,status:string):MonthDed=>({id,candidate_id:'employee',unit_id:'site',deduction_name:'ESIC',deduction_date:'2026-09-30',amount,computed_amount,status,source_kind:null,source_ref:null});
    const c:MonthContrib={id:'er',candidate_id:'employee',unit_id:'site',amount:670,contribution_name:'Employer ESIC',contribution_date:'2026-09-30',status:'completed',source_kind:null,source_ref:null,payroll_run_id:null};
    expect(monthlyStatutoryRows([ded('a',100,150,'completed'),ded('b',99,0,'paid'),ded('c',500,null,'pending')],[c])[0]).toMatchObject({employeeEsic:150,employerEsic:670,employeePf:0,pt:0});
  });
});