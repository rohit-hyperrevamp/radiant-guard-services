import { supabase } from "./shim";
import { computeWages } from "@/lib/payroll-calc";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { refreshBillingAddOns } from "@/lib/contract-billing-addons";
import { resolvePayrollDayCount } from "@/lib/payroll-days";
import { writeFileSync } from "fs";
import { normShift } from "@/lib/shift-resources";
const out:any[]=[];
for (const [s,e] of [["2026-09-01","2026-09-30"],["2026-08-21","2026-09-20"],["2026-08-26","2026-09-25"]]) {
 const { data, error } = await supabase.rpc("dashboard_pnl_inputs", { p_start:s, p_end:e, p_att_end:e });
 if (error) throw error;
 const P:any=data; const pdb=new Map((P.day_bases??[]).map((p:any)=>[p.id,{method:p.method,fixedDays:p.fixed_days,weeklyOffDay:p.weekly_off_day,includedWeekdays:Array.isArray(p.included_weekdays)?p.included_weekdays.map(Number):null}]));
 const toR=(r:any)=>({designationId:r.designation_id??"",components:r.components??[],benefits:r.benefits??[],deductions:r.deductions??[],employerContributions:r.employer_contributions??[],payrollDayBase:r.payroll_day_base_id?pdb.get(r.payroll_day_base_id)??null:null});
 const hyd=(await hydrateFormulasFromMaster(P.resources.map(toR))).map(refreshBillingAddOns as any);
 const H=new Map(); P.resources.forEach((r:any,i:number)=>{const b=`${r.contract_id}|${r.designation_id}`; if(!H.has(b))H.set(b,hyd[i]); H.set(b+'|'+normShift(r.shift_hours),hyd[i]);});
 const dates:string[]=[]; for(let d=new Date(s);d<=new Date(e);d.setDate(d.getDate()+1)) dates.push(d.toISOString().slice(0,10));
 const dobj=dates.map(d=>new Date(d+"T00:00:00"));
 const units=new Map(P.units.map((u:any)=>[u.unit_id,u]));
 const agg=new Map<string,any>();
 for (const p of P.pairs){ const u:any=units.get(p.unit_id); if(!u) continue; const b=`${u.contract_id}|${p.designation_id}`; const res:any=((p.shift===8||p.shift===12)&&H.get(b+'|'+p.shift))||H.get(b); if(!res) continue;
  const t={pDays:+p.p_days||0,otHours:+p.ot_days||0,otDays:+p.ot_days||0,phDays:+p.ph_days||0,otherPaidDays:+p.other_paid_days||0,tDays:(+p.p_days||0)+(+p.ph_days||0)+(+p.ot_days||0)};
  const w:any=computeWages(t as any,res,dates.length,{periodDates:dobj,epfCapEnabled:u.epf_cap_enabled??true,dayBases:[...pdb].map(([id,b]:any)=>({id,...b}))} as any);
  const a=agg.get(p.unit_id)??{g:0,er:0,lines:[]}; a.g+=w.earnedGross; a.er+=w.totalEmployerContributions; a.lines.push({c:p.candidate_id,d:p.designation_id,t,g:w.earnedGross,er:w.totalEmployerContributions}); agg.set(p.unit_id,a);}
 for (const [u,a] of agg) out.push({u,s,code:(units.get(u) as any).unit_code,...a});
}
writeFileSync("/tmp/pnl/dash.json",JSON.stringify(out)); console.log(out.length); process.exit(0);
