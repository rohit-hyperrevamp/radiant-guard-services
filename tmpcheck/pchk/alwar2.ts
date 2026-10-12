import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { slugifyVar } from "@/lib/formula-engine";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
for (const u of ["db4be192-4265-4173-b2a8-8245dd288c8e","71947258-19f7-4ba7-bbe4-7d26c2961bc6","716ae369-5bb5-43d9-8a6f-5b579daa79bb"]){
 const {data:r}=await supabase.from("payroll_runs").select("period_start,period_end").eq("unit_id",u).gte("period_start","2026-08-15").lte("period_start","2026-09-01").limit(1);
 const res:any=await computeUnit(u,r![0].period_start,r![0].period_end,G);
 let ok=0,bad=0;
 for(const x of res.rows.filter((x:any)=>x.wages&&x.totals.tDays>0)){
  const w=x.wages; const ctx:any={};
  for(const c of w.components) ctx[slugifyVar(c.name)]=(ctx[slugifyVar(c.name)]??0)+c.amount;
  ctx.ed_amount=ctx.extra_duty??0;
  for(const [list,lab] of [[w.deductions,"EE"],[w.employerContributions??[],"ER"]] as any){
   for(const d of list.filter((d:any)=>/esi/i.test(d.name))){
    const m=d.name.match(/\(([^)]*)\)/); if(!m) continue;
    const parts=m[1].split("+").map((s:string)=>s.trim()==="ED"?"ed_amount":slugifyVar(s));
    const pct=lab==="EE"?0.0075:0.0325;
    const exp=Math.ceil(parts.reduce((s:number,p:string)=>s+(ctx[p]??0),0)*pct*100)/100;
    const expUp=Math.ceil(exp-1e-9);
    if(Math.abs(expUp-d.amount)>0.01 && Math.abs(exp-d.amount)>0.01){bad++; console.log(res.unit?.code,x.c.employee_code,x.designationName,lab,"got",d.amount,"exp",expUp,exp,JSON.stringify(w.components.map((c:any)=>[c.name,c.amount])));} else ok++;
   }}
 }
 console.log(res.unit?.code,"ok",ok,"bad",bad);
}
process.exit(0);
