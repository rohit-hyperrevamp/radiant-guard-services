import { computeUnit } from "./engine";
import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
for (const u of ["db4be192-4265-4173-b2a8-8245dd288c8e","71947258-19f7-4ba7-bbe4-7d26c2961bc6","798e9560-b38a-4446-a1e9-1b15f0703fef","716ae369-5bb5-43d9-8a6f-5b579daa79bb"]){
 const {data:r}=await supabase.from("payroll_runs").select("period_start,period_end").eq("unit_id",u).gte("period_start","2026-08-15").lte("period_start","2026-09-01").limit(1);
 if(!r?.length){console.log(u,"no run");continue;}
 const res:any=await computeUnit(u,r[0].period_start,r[0].period_end,G);
 for(const x of res.rows.filter((x:any)=>x.wages&&x.totals.tDays>0).slice(0,6)){
  const w=x.wages; console.log(res.unit?.code,x.c.employee_code,x.designationName,"P",x.totals.pDays,"OT",x.totals.otDays,"gross",w.earnedGross);
  console.log("  comps",JSON.stringify(w.components.map((c:any)=>[c.name,c.amount])));
  console.log("  esi",JSON.stringify(w.deductions.filter((d:any)=>/esi/i.test(d.name)).map((d:any)=>[d.name,d.amount])), "ot",w.otAmount);
 }}
process.exit(0);
