import { computeInvoice } from "./inveng";
import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeInvoice("41887f48-31ea-48ef-9005-24c81a21fc93","2026-09-01","2026-09-30",G);
const {lines,...rest}=r; console.log(JSON.stringify(rest).slice(0,1500));
console.log(JSON.stringify((lines??r.rows??[]).slice(0,4)).slice(0,2500));
process.exit(0);
