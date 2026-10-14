import { computeUnit } from "./engine";
import { supabase, db } from "./shim2";
import { readFileSync, writeFileSync } from "fs";
const [a,b]=process.argv.slice(2).map(Number);
const codes=JSON.parse(readFileSync("/tmp/codes_all.json","utf8")).slice(a,b);
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs=await db`select distinct r.unit_id, r.period_start::text s, r.period_end::text e, u.code from payroll_runs r join units u on u.id=r.unit_id where r.period_start between '2026-08-15' and '2026-09-01' and u.code = any(${codes})`;
const out:any[]=[]; let i=0;
async function w(){while(i<runs.length){const r=runs[i++];
 try{const p:any=await computeUnit(r.unit_id,r.s,r.e,G);for(const x of p.rows.filter((x:any)=>x.wages&&(x.totals.tDays>0||x.totals.otDays>0))){const d=x.wages.deductions;const f=(re:RegExp)=>d.filter((y:any)=>re.test(y.name)).reduce((s:number,y:any)=>s+(Number(y.amount)||0),0);out.push({client:r.code,emp:String(x.c?.employee_code??""),gross:x.wages.earnedGross,net:x.wages.netPay,epf:f(/e?pf/i),esi:f(/esi/i),pt:f(/prof|^pt/i),p:x.totals.pDays,ot:x.totals.otDays});}}catch(e:any){out.push({client:r.code,err:String(e?.message??e).slice(0,120)})}}}
await Promise.all(Array.from({length:8},w));
writeFileSync(`/tmp/wr/ours_${a}.json`,JSON.stringify(out));console.log("done",runs.length,out.length);process.exit(0);
