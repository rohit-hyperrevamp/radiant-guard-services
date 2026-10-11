import { computeUnit } from "./engine"; import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeUnit("3f135710-a3b1-44c5-a12e-c630609a0ec9","2026-09-01","2026-09-30",G);
for(const x of r.rows) console.log(x.c.employee_code, x.isPrimary, x.designationName, x.totals.tDays, !!x.wages, !!x.resource, JSON.stringify(x.ptResolved));
process.exit(0);
