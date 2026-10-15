import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("*")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("*")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("*")).data };
const r: any = await computeUnit("0f7c605c-4fcc-446e-9b10-39145868a843", "2026-08-21", "2026-09-20", G);
for (const x of r.rows.filter((x: any) => x.wages || true)) {
  const esi = x.wages.deductions.filter((d: any) => /esi/i.test(d.name)).map((d:any)=>d.name+"="+d.amount).join("|"); const er=(x.wages.employerContributions??[]).filter((d: any) => /esi/i.test(d.name)).map((d:any)=>d.name+"="+d.amount).join("|");
  const adds = (x.wages.additions ?? []).map((a: any) => a.name + ":" + a.amount).join(",");
  console.log(x.c.employee_code, x.c.full_name, x.designationName, x.totals.pDays, x.wages.earnedGross, "ESI", esi, er, "ED", x.totals.otDays, adds);
}
process.exit(0);
