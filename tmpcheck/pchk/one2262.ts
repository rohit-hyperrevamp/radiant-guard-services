const prod = "https://yimpxawqoarprhtxapie.supabase.co";
process.env.SUPABASE_URL = prod;
process.env.VITE_SUPABASE_URL = prod;
const prodKey = (await import("@/lib/server-env")).PRODUCTION_SUPABASE.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_PUBLISHABLE_KEY = prodKey;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = prodKey;
const { computeInvoice } = await import("./inveng");
import { supabase } from "./shim";
import { appendFileSync, existsSync, readFileSync } from "fs";
const G:any={publicHolidays:(await supabase.from("public_holidays").select("*").eq("enabled",true)).data,ptSlabs:(await supabase.from("professional_tax_slabs").select("*")).data,pincodeRanges:(await supabase.from("pincode_ranges").select("*")).data,lwfRows:(await supabase.from("labour_welfare_funds").select("*")).data};
const lines=[{u:"30c498af-a6d9-4f5e-8c17-82ea885964ae",code:"CLI2262",sap:""}];
const OUT="/tmp/one2262.jsonl";
const done=new Set(existsSync(OUT)?readFileSync(OUT,"utf8").split("\n").filter(Boolean).map((l:string)=>JSON.parse(l).u):[]);
const todo=lines.filter(r=>!done.has(r.u)); console.log("todo",todo.length);
let i=0,n=0;
async function w(){ while(i<todo.length){ const r=todo[i++]; try{ const v:any=await computeInvoice(r.u,"2026-08-21","2026-09-20",G); appendFileSync(OUT,JSON.stringify({u:r.u,code:r.code,sap:r.sap,taxable:v.taxable,rows:JSON.stringify(v).slice(0,3000),extras:(v.extras??[]).map((x:any)=>({name:x.name,amount:x.amount}))})+"\n"); }catch(e:any){appendFileSync(OUT,JSON.stringify({u:r.u,code:r.code,sap:r.sap,error:String(e?.message??e).slice(0,200)})+"\n");}
 if(++n%25===0) console.log(n,"/",todo.length); } }
await Promise.all(Array.from({length:8},w)); console.log("done"); process.exit(0);
