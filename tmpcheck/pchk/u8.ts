import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("*")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("*")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("*")).data };
const codes = ["CLI300","CLI3895","CLI1472","CLI1616","CLI3154","CLI4199","CLI3111","CLI4096"];
const { data: us } = await supabase.from("units").select("id,code").in("code", codes);
const out: any[] = [];
for (const u of us ?? []) {
  try {
    const r: any = await computeUnit(u.id, "2026-09-01", "2026-09-30", G);
    for (const x of r.rows.filter((x: any) => x.totals.tDays > 0 && x.wages)) out.push({ unit: u.code, emp: String(x.c.employee_code), net: x.wages.netPay ?? x.wages.net ?? null, gross: x.wages.earnedGross, p: x.totals.pDays });
  } catch (e: any) { console.log(u.code, "ERR", e.message); }
}
await Bun.write("/tmp/cfix/ours8.json", JSON.stringify(out));
console.log(out.length, out[0]);
process.exit(0);
