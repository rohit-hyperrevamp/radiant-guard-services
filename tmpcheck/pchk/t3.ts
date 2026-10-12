import { computeUnit } from "./engine2";
import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const [u,s,e]="1a41ddf9-585f-4ef4-8a99-18726e7ab9b9 2026-09-01 2026-09-30".split(" ");
const r:any=await computeUnit(u,s,e,G);
for(const x of r.filter((x:any)=>x.employeeCode==="33430")) console.log(x.designation,x.isPrimary,x.wages.earnedGross,JSON.stringify(x.pt),x.wages.deductions.map((d:any)=>d.name+":"+d.amount), x.resource?.deductions?.map((d:any)=>d.name));
process.exit(0);
