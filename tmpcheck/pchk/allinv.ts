import { computeInvoice } from "./inveng";
import { supabase } from "./shim";
import { appendFileSync, existsSync, readFileSync } from "fs";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs:any[]=[]; for(let f=0;;f+=1000){const {data}=await supabase.from("payroll_runs").select("unit_id, period_start, period_end, payroll_status").gte("period_start","2026-08-15").lte("period_start","2026-09-01").range(f,f+999); runs.push(...(data??[])); if(!data||data.length<1000)break;}
const OUT=process.env.OUT||"/tmp/pchk/inv2.jsonl"; const only=process.env.ONLY?new Set(process.env.ONLY.split(",")):null;
const done0=new Set(existsSync(OUT)?readFileSync(OUT,"utf8").split("\n").filter(Boolean).map((l:string)=>JSON.parse(l).u):[]);
const todo=runs.filter(r=>!done0.has(r.unit_id)&&(!only||only.has(r.unit_id))); console.log("todo",todo.length);
let i=0,n=0;
async function w(){ while(i<todo.length){ const run=todo[i++]; try{ const r:any=await computeInvoice(run.unit_id,run.period_start,run.period_end,G); appendFileSync(OUT, JSON.stringify({u:run.unit_id,s:run.period_start,e:run.period_end,...r})+"\n"); }catch(e:any){appendFileSync(OUT,JSON.stringify({u:run.unit_id,s:run.period_start,error:String(e?.message??e).slice(0,200)})+"\n");}
 if(++n%50===0) console.log(n,"/",todo.length); } }
await Promise.all(Array.from({length:4},w)); console.log("done"); process.exit(0);
