import type { DigitalForm, DigitalField } from './compliance-digital';

/** Source-reviewed repairs; generic extraction must not decide which legal blanks to merge. */
export function reviewedDigitalLayout(form:DigitalForm):DigitalForm {
  if(form.id==='compliance-16') {
    // The supplied consent sheet leaves almost no name space on its first line.
    // Keep every source word, but move this one label pair to two separate lines.
    const fields:DigitalField[]=[
      {id:'review-name',label:'Employee name',box:[132,186.3,508,200],size:10,factKey:'name'},
      {id:'review-address',label:'Residential address',box:[203,199,508,212],size:9,factKey:'address'},
      {id:'review-designation',label:'Designation',box:[359,211.6,453,225],size:9,factKey:'designation',placeholder:true},
      {id:'review-employer',label:'Employer name',box:[72.1,224.25,155,238],size:9,factKey:'employerName',placeholder:true},
      {id:'review-joining',label:'Date of joining',box:[141,236.9,508,250],size:9,factKey:'joining'},
      {id:'review-chairperson',label:'Committee chairperson',box:[214,325.45,351,339],size:9,placeholder:true},
      {id:'review-period-from',label:'Consent period from',box:[354,372.05,406,386],size:9,placeholder:true},
      {id:'review-period-to',label:'Consent period to',box:[422,372.05,456,386],size:9,placeholder:true},
      {id:'review-date',label:'Consent date',box:[136,397.35,260,411],size:9},
    ];
    return {...form,pages:form.pages.map((p,i)=>i?p:{...p,texts:p.texts.map(t=>t.text==='residing at   '?{...t,box:[144.1,199,198.418,211.177],origin:[144.1,t.origin[1]+12.7],sourceMarkup:undefined}:t),fields:[...p.fields,...fields]})};
  }
  if(form.id==='compliance-30') {
    const merged:Record<string,string[]>={'field-0':['field-1','field-2'],'field-3':['field-4','field-5'],'field-6':['field-7','field-8'],'field-9':['field-10','field-11'],'field-12':['field-13','field-14'],'field-15':['field-16','field-17']};
    const facts:Record<string,string>={'field-0':'name','field-3':'father','field-6':'designation','field-9':'uan','field-12':'bankAccount','field-15':'month','field-30':'employerName','field-31':'employerAddress','field-32':'month'};
    const labels:Record<string,string>={'field-0':'Employee name','field-3':'Father / mother / spouse name','field-6':'Designation','field-9':'UAN','field-12':'Bank account number','field-15':'Wage month','field-30':'Establishment name','field-31':'Establishment address','field-32':'Month'};
    return {...form,draftAliases:Object.fromEntries(Object.entries(merged).flatMap(([target,ids])=>ids.map(id=>[`0:${id}`,`0:${target}`]))),pages:form.pages.map((p,i)=>i? p : {...p,fields:p.fields.map(f=>{
      const siblings=merged[f.id]?.map(id=>p.fields.find(other=>other.id===id)).filter((other):other is DigitalField=>!!other)??[];
      return {...f,...(siblings.length?{box:[f.box[0],f.box[1],Math.max(f.box[2],...siblings.map(s=>s.box[2])),f.box[3]] as DigitalField['box']}:{}),...(facts[f.id]?{factKey:facts[f.id],label:labels[f.id]}:{})};
    }).filter(f=>!Object.values(merged).flat().includes(f.id)).concat([
      {id:'review-employee-pf',label:'Posted employee PF deduction',box:[294,460.8,322.5,469.8],size:7,factKey:'employeePf'},
      {id:'review-employee-esic',label:'Posted employee ESI deduction',box:[345,460.8,391.7,469.8],size:7,factKey:'employeeEsic'},
    ])})};
  }
  if(form.id==='compliance-36') {
    const fields:DigitalField[]=[
      {id:'review-name',label:'Employee name',box:[260,168.84,511,183],size:10,factKey:'name',placeholder:true},
      {id:'review-father',label:'Father name',box:[74,210.24,424,224],size:10,factKey:'father',placeholder:true},
      {id:'review-dob',label:'Date of birth',box:[148,320.64,530,336],size:10,factKey:'dob'},
      {id:'review-birthplace',label:'Place of birth',box:[157,362.04,530,381],size:10},
      {id:'review-education',label:'Educational qualifications',box:[220,403.44,530,423],size:10},
      {id:'review-profession',label:'Profession',box:[142,444.78,530,465],size:10,factKey:'designation'},
      {id:'review-present-address',label:'Present address',box:[174,486.18,530,513],size:10},
      {id:'review-permanent-address',label:'Permanent address',box:[189,527.58,530,557],size:10,factKey:'address'},
    ];
    return {...form,pages:form.pages.map((p,i)=>i?p:{...p,fields:[...p.fields, ...fields]})};
  }
  return form;
}