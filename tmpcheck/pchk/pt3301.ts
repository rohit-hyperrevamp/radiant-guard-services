import { computeUnit } from "./engine2"; import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeUnit("f3b31d61-5138-4e63-8d82-efcefd0a6b1f","2026-09-01","2026-09-30",G);
for(const x of r.rows) console.log(x.c.employee_code, x.c.gender, x.isPrimary, x.designationName, x.totals?.pDays, x.wages?.earnedGross, JSON.stringify(x.wages?.deductions?.map((d:any)=>[d.name,d.amount])), JSON.stringify(x.ptResolved));
process.exit(0);
