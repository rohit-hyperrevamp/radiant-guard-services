import { computeUnit } from "./engine"; import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeUnit("ad2a9124-59ec-48e5-9763-0722f441e700","2026-09-01","2026-09-30",G);
for(const x of r.rows) console.log(x.c.employee_code, x.isPrimary, x.designationName, x.totals.tDays, !!x.wages, !!x.resource, x.wages?.earnedGross, JSON.stringify(x.wages?.deductions?.filter((d:any)=>/prof|^pt/i.test(d.name))));
process.exit(0);
