import { computeUnit } from "./engine";
import { computeInvoice } from "./inveng";
import { supabase, db } from "./shim2";
import { readFileSync, writeFileSync } from "fs";
const codes=JSON.parse(readFileSync("/tmp/codes.json","utf8"));
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const runs=await db`select r.unit_id, r.period_start::text s, r.period_end::text e, u.code from payroll_runs r join units u on u.id=r.unit_id where r.period_start between '2026-08-15' and '2026-09-01' and u.code = any(${codes})`;
console.log("runs",runs.length);
const out:any={}; let i=0;
async function w(){while(i<runs.length){const r=runs[i++];const o:any={};
 try{const p:any=await computeUnit(r.unit_id,r.s,r.e,G);const rows=p.rows.filter((x:any)=>x.wages&&(x.totals.tDays>0||x.totals.otDays>0));o.net=Math.round(rows.reduce((s:number,x:any)=>s+x.wages.netPay,0)*100)/100;o.gross=Math.round(rows.reduce((s:number,x:any)=>s+x.wages.earnedGross,0)*100)/100;o.emps=rows.length;o.empNet=Object.fromEntries(rows.map((x:any)=>[x.c?.employee_code??x.employeeCode,Math.round(x.wages.netPay*100)/100]));}catch(e:any){o.perr=String(e?.message??e).slice(0,150)}
 try{const v:any=await computeInvoice(r.unit_id,r.s,r.e,G);o.inv=v.taxable+(v.extras??[]).reduce((s:number,x:any)=>s+(Number(x.amount)||0),0);o.invTaxable=v.taxable}catch(e:any){o.ierr=String(e?.message??e).slice(0,150)}
 (out[r.code] ||= []).push(o);}}
await Promise.all(Array.from({length:8},w));
writeFileSync("/tmp/recent.json",JSON.stringify(out));console.log("done",Object.keys(out).length);process.exit(0);
