import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { readFileSync, writeFileSync } from "fs";
const codes=(process.env.CODES??"").split(",").filter(Boolean);
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const {data:units}=await supabase.from("units").select("id,code").in("code",codes);
const ids=(units??[]).map((u:any)=>u.id);
const {data:runs}=await supabase.from("payroll_runs").select("unit_id,period_start,period_end").in("unit_id",ids).gte("period_start","2026-08-15").lte("period_start","2026-09-01");
const OUT="/tmp/pchk/ours.jsonl";
const keep=readFileSync(OUT,"utf8").split("\n").filter(Boolean).filter((l:string)=>!ids.includes(JSON.parse(l).u));
for(const run of runs??[]){ try{ const res:any=await computeUnit(run.unit_id,run.period_start,run.period_end,G);
 const rows=res.rows.filter((x:any)=>x.wages&&x.totals.tDays>0).map((x:any)=>({emp:x.c.employee_code,name:x.c.full_name,des:x.designationName,p:x.totals.pDays,ot:x.totals.otDays,ph:x.totals.phDays,gross:x.wages.earnedGross,ded:x.wages.totalDeductions,net:x.wages.netPay,comps:x.wages.components.map((c:any)=>[c.name,c.amount]),deds:x.wages.deductions.map((d:any)=>[d.name,d.amount])}));
 keep.push(JSON.stringify({u:run.unit_id,s:run.period_start,e:run.period_end,code:res.unit?.code,rows})); console.log(res.unit?.code,rows.length);
}catch(e:any){console.log("ERR",run.unit_id,String(e?.message??e).slice(0,200));}}
writeFileSync(OUT,keep.join("\n")+"\n"); process.exit(0);
