import { computeUnit } from "./engine2";
import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeUnit("0335b21e-3f88-4acb-9f69-438baf4984a6","2026-09-01","2026-09-30",G);
for(const x of r.slice(0,5)) console.log(Object.keys(x).join(","), x.employeeCode, x.wages?.earnedGross, x.wages?.netPay);
process.exit(0);
