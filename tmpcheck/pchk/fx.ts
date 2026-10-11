import { computeUnit } from "./engine";
import { supabase } from "./shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
import { appendFileSync, writeFileSync, readFileSync } from "fs";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("*")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("*")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("*")).data };
const runs = JSON.parse(readFileSync("/tmp/fx/runs.json", "utf8"));
const OUT = process.env.OUT!; writeFileSync(OUT, "");
const r2 = (n: number) => Math.round(n * 100) / 100;
let i = 0, done = 0;
async function w() { while (i < runs.length) { const run = runs[i++]; try { const res: any = await computeUnit(run.unit_id, run.ps, run.pe, G);
  for (const x of res.rows) { const t = x.totals, wg = x.wages; if (!(t.tDays > 0)) continue;
    appendFileSync(OUT, JSON.stringify({ cli: run.cli, emp: x.c.employee_code, p: t.pDays, ot: t.otDays, gross: wg ? r2(wg.earnedGross) : null, ded: wg ? r2(wg.totalDeductions) : null, net: wg ? r2(wg.netPay) : null,
      comps: wg?.components.map((c: any) => [c.name, r2(c.amount)]), deds: wg?.deductions.map((c: any) => [c.name, r2(c.amount), c.formulaExpression ?? null]) }) + "\n"); } }
  catch (e: any) { appendFileSync(OUT, JSON.stringify({ cli: run.cli, error: String(e?.message ?? e).slice(0, 200) }) + "\n"); }
  if (++done % 100 === 0) console.log(done); } }
await Promise.all(Array.from({ length: 8 }, w)); console.log("done", runs.length); process.exit(0);
