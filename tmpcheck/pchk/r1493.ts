import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("*")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("*")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("*")).data };
const r: any = await computeUnit("ce8e8c18-f741-4518-a436-515613c831f0", "2026-09-01", "2026-09-30", G);
for (const x of r.rows.filter((x: any) => x.totals.tDays > 0 && x.wages)) {
  const w=x.wages;
  console.log(x.c.employee_code, x.c.full_name, x.designationName, JSON.stringify(x.totals));
  console.log("  comps", w.components.map((c:any)=>c.name+"="+c.amount).join(", "), "gross", w.earnedGross);
  console.log("  ded", w.deductions.map((c:any)=>c.name.slice(0,12)+"="+c.amount).join(", "));
  console.log("  er", w.employerContributions.map((c:any)=>c.name.slice(0,12)+"="+c.amount).join(", "));
  console.log("  adds", JSON.stringify(w.additions??[]));
}
process.exit(0);
