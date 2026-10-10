import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("*")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("*")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("*")).data };
const r: any = await computeUnit("234681db-920e-4768-a928-394ce621ac05", "2026-08-26", "2026-09-25", G);
for (const x of r.rows.filter((x: any) => x.totals.tDays > 0 && x.wages)) {
  const esi = x.wages.deductions.find((d: any) => /esi/i.test(d.name))?.amount;
  const adds = (x.wages.additions ?? []).map((a: any) => a.name + ":" + a.amount).join(",");
  console.log(x.c.employee_code, x.c.full_name, x.designationName, x.totals.pDays, x.wages.earnedGross, "ESI", esi, adds);
}
process.exit(0);
