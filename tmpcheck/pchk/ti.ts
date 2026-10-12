import { computeInvoice } from "./inveng";
import { supabase } from "./shim";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const r:any=await computeInvoice("0335b21e-3f88-4acb-9f69-438baf4984a6","2026-09-01","2026-09-30",G);
console.log(r.billingMode,r.taxable,r.lines.slice(0,3),r.extras.length);process.exit(0);
