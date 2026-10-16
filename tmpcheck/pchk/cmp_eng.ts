import { computeUnit } from "./engine";
import { computeInvoice } from "./inveng";
import { supabase } from "./shim";
import { appendFileSync, existsSync, readFileSync } from "fs";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G:any={publicHolidays:await fetchEnabledPublicHolidays(),ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs:any[]=[]; for(let f=0;;f+=1000){const {data}=await supabase.from("payroll_runs").select("unit_id, period_start, period_end").in("period_start",["2026-08-21","2026-09-01","2026-08-26"]).range(f,f+999); runs.push(...(data??[])); if(!data||data.length<1000)break;}
const OUT="/tmp/pnl/eng.jsonl"; const done0=new Set(existsSync(OUT)?readFileSync(OUT,"utf8").split("\n").filter(Boolean).map((l:string)=>JSON.parse(l).u):[]);
const todo=runs.filter(r=>!done0.has(r.unit_id)); console.log("todo",todo.length);
let i=0,n=0;
async function w(){ while(i<todo.length){ const run=todo[i++]; try{
 const p:any=await computeUnit(run.unit_id,run.period_start,run.period_end,G);
 const rows=p.rows.filter((x:any)=>x.wages&&x.totals.tDays>0);
 const gross=rows.reduce((s:number,x:any)=>s+x.wages.earnedGross,0), er=rows.reduce((s:number,x:any)=>s+(x.wages.totalEmployerContributions||0),0);
 const adds=rows.reduce((s:number,x:any)=>s+(x.wages.additions??[]).reduce((a:number,b:any)=>a+(Number(b.amount)||0),0),0);
 const inv:any=await computeInvoice(run.unit_id,run.period_start,run.period_end,G);
 const ex=(inv.extras??[]).filter((e:any)=>e.enabled&&(!e.period_start||(e.period_start===run.period_start&&e.period_end===run.period_end))).reduce((s:number,e:any)=>s+(Number(e.quantity)||0)*(Number(e.rate)||0),0);
 appendFileSync(OUT, JSON.stringify({u:run.unit_id,s:run.period_start,e:run.period_end,code:p.unit?.code,gross,er,adds,inv:inv.taxable+ex,lines:rows.map((x:any)=>({c:x.c.id,d:x.did,t:x.totals,g:x.wages.earnedGross,er:x.wages.totalEmployerContributions}))})+"\n"); }catch(e:any){appendFileSync(OUT,JSON.stringify({u:run.unit_id,error:String(e?.message??e).slice(0,200)})+"\n");}
 if(++n%100===0) console.log(n,"/",todo.length); } }
await Promise.all(Array.from({length:10},w)); console.log("done"); process.exit(0);
