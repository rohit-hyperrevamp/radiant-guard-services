import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G:any={publicHolidays:await fetchEnabledPublicHolidays(),ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const p:any=await computeUnit("b9e0ea97-dbc5-46ed-989c-3c0cf6e81f92","2026-09-01","2026-09-30",G);
const x=p.rows.find((x:any)=>x.wages&&x.totals.tDays>0);
console.log(x.wages.earnedGross, x.wages.totalEmployerContributions, JSON.stringify(x.wages.employerContributions.map((e:any)=>[e.name,e.amount])));
console.log(JSON.stringify(x.resource.employerContributions.map((e:any)=>[e.name,e.amount,e.billingOnly??e.billing_only??e.category])));
process.exit(0);
