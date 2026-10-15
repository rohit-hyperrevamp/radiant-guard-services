import { computeUnit } from "./engine3";
import { supabase } from "../pchk/shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeUnit("0413d038-e508-4aac-8f9e-c129e705affd","2026-08-21","2026-09-20",G);
for(const x of r.rows) console.log(x.employeeCode,x.designation,x.isPrimary,x.totals.pDays,x.totals.otDays,x.wages?.earnedGross,JSON.stringify(x.wages?.additions));
process.exit(0);
