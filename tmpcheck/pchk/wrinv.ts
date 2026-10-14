import { computeInvoice } from "./inveng";
import { supabase, db } from "./shim2";
import { readFileSync, writeFileSync } from "fs";
const codes=JSON.parse(readFileSync("/tmp/codes.json","utf8"));
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs=await db`select distinct r.unit_id, r.period_start::text s, r.period_end::text e, u.code from payroll_runs r join units u on u.id=r.unit_id where r.period_start between '2026-08-15' and '2026-09-01' and u.code = any(${codes})`;
const out:any={};
for(const r of runs){try{const v:any=await computeInvoice(r.unit_id,r.s,r.e,G);out[r.code]=(out[r.code]??0)+v.taxable+(v.extras??[]).reduce((s:number,x:any)=>s+(Number(x.amount)||0),0)}catch(e:any){out[r.code+"_err"]=String(e).slice(0,100)}}
writeFileSync("/tmp/wr/inv.json",JSON.stringify(out));console.log(out);process.exit(0);
