import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { appendFileSync, writeFileSync } from "fs";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs:any[]=[]; for(let f=0;;f+=1000){const {data}=await supabase.from("payroll_runs").select("unit_id, period_start, period_end, payroll_status").gte("period_start","2026-08-15").lte("period_start","2026-09-01").range(f,f+999); runs.push(...(data??[])); if(!data||data.length<1000)break;}
const OUT="/tmp/pchk/esi.jsonl"; const doneU=new Set(require("fs").readFileSync(OUT,"utf8").split("\n").filter(Boolean).map((l:string)=>JSON.parse(l).u+"|"+(JSON.parse(l).s??""))); const todo=runs.filter(r=>!doneU.has(r.unit_id+"|"+r.period_start)); runs.length=0; runs.push(...todo); console.log("todo",runs.length);
let i=0,done=0;
async function w(){ while(i<runs.length){ const run=runs[i++]; try{ const res:any=await computeUnit(run.unit_id,run.period_start,run.period_end,G);
 for(const x of res.rows){ const wg=x.wages; if(!wg||!(x.totals.tDays>0)) continue;
  const ee=wg.deductions.find((d:any)=>/\besic?\b/i.test(d.name)); const er=wg.employerContributions.find((d:any)=>/\besic?\b/i.test(d.name));
  appendFileSync(OUT, JSON.stringify({u:run.unit_id,s:run.period_start,st:run.payroll_status,emp:x.c.employee_code,name:x.c.full_name,des:x.designationName,gross:wg.earnedGross,comps:wg.components.map((c:any)=>[c.name,c.amount]),adds:wg.additions??[],ee:ee?[ee.name,ee.amount,ee.formulaExpression??null,ee.roundMode??null]:null,er:er?[er.name,er.amount,er.roundMode??null]:null})+"\n"); } }catch(e:any){appendFileSync(OUT,JSON.stringify({u:run.unit_id,error:String(e?.message??e).slice(0,200)})+"\n");}
 if(++done%200===0) console.log(done,"/",runs.length); } }
await Promise.all(Array.from({length:8},w)); console.log("done",runs.length); process.exit(0);
