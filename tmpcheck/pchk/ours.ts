import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { appendFileSync, existsSync, readFileSync } from "fs";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs:any[]=[]; for(let f=0;;f+=1000){const {data}=await supabase.from("payroll_runs").select("unit_id, period_start, period_end, payroll_status").gte("period_start","2026-08-15").lte("period_start","2026-09-01").range(f,f+999); runs.push(...(data??[])); if(!data||data.length<1000)break;}
const OUT="/tmp/pchk/ours.jsonl"; const done0=new Set(existsSync(OUT)?readFileSync(OUT,"utf8").split("\n").filter(Boolean).map((l:string)=>JSON.parse(l).u):[]);
const todo=runs.filter(r=>!done0.has(r.unit_id)); console.log("todo",todo.length);
let i=0,n=0;
async function w(){ while(i<todo.length){ const run=todo[i++]; try{ const res:any=await computeUnit(run.unit_id,run.period_start,run.period_end,G);
 const rows=res.rows.filter((x:any)=>x.wages&&x.totals.tDays>0).map((x:any)=>({emp:x.c.employee_code,name:x.c.full_name,des:x.designationName,p:x.totals.pDays,ot:x.totals.otDays,ph:x.totals.phDays,gross:x.wages.earnedGross,ded:x.wages.totalDeductions,net:x.wages.netPay,comps:x.wages.components.map((c:any)=>[c.name,c.amount]),deds:x.wages.deductions.map((d:any)=>[d.name,d.amount])}));
 appendFileSync(OUT, JSON.stringify({u:run.unit_id,s:run.period_start,e:run.period_end,code:res.unit?.code,rows})+"\n"); }catch(e:any){appendFileSync(OUT,JSON.stringify({u:run.unit_id,error:String(e?.message??e).slice(0,200)})+"\n");}
 if(++n%100===0) console.log(n,"/",todo.length); } }
await Promise.all(Array.from({length:8},w)); console.log("done"); process.exit(0);
