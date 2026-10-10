import { computeUnit } from "./engine";
import { supabase, db } from "/tmp/pchk/shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
import { appendFileSync, writeFileSync } from "fs";
const G: any = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("id, state, region_label, salary_min, salary_max, tax_per_month, gender")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("state, region_label, range_start, range_end, is_excluded")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes")).data };
const runs = await db`select r.unit_id, r.period_start::text s, r.period_end::text e, r.status, u.code, u.name, cu.name cust, (select contract_code from client_contracts c where c.unit_id=r.unit_id and c.record_type='client' and c.status='active' order by start_date desc limit 1) con from payroll_runs r join units u on u.id=r.unit_id left join customers cu on cu.id=u.customer_id where r.period_start between '2026-08-15' and '2026-09-01'`;
const OUT = "/tmp/pchk/out.jsonl"; writeFileSync(OUT, "");
const r2 = (n: number) => Math.round(n * 100) / 100;
let i = 0, done = 0;
async function worker() {
  while (i < runs.length) {
    const run = runs[i++];
    try {
      const res: any = await computeUnit(run.unit_id, run.s, run.e, G);
      for (const x of res.rows) {
        const t = x.totals, w = x.wages;
        if (!(t.tDays > 0 || t.otDays > 0)) continue;
        appendFileSync(OUT, JSON.stringify({
          unit: run.code, unitName: run.name, cust: run.cust, con: run.con, s: run.s, e: run.e, runStatus: run.status,
          emp: x.c.employee_code, name: x.c.full_name, desig: x.designationName, primary: x.isPrimary, hasRes: !!x.resource,
          p: t.pDays, ot: t.otDays, ph: t.phDays, oth: t.otherPaidDays, td: t.tDays,
          baseDays: w?.baseDays, gross: w ? r2(w.earnedGross) : null, ded: w ? r2(w.totalDeductions) : null, net: w ? r2(w.netPay) : null,
          er: w ? r2(w.totalEmployerContributions) : null, perDutyOt: w?.perDutyOtAmount, otAmt: w?.totalOtAmount,
          comps: w?.components.map((c: any) => [c.name, r2(c.amount)]), deds: w?.deductions.map((c: any) => [c.name, r2(c.amount)]),
          adds: (w as any)?.additions?.map((c: any) => [c.name, r2(c.amount)]) ?? [], expAdds: x.isPrimary ? x.adds.map((a: any) => a.name) : [],
          ers: w?.employerContributions.map((c: any) => [c.name, r2(c.amount)]),
          rc: x.resource?.components.map((c: any) => [c.name, Number(c.amount) || 0]), rd: x.resource?.deductions.map((c: any) => c.name),
          pt: x.ptResolved?.amount ?? null,
        }) + "\n");
      }
    } catch (e: any) { appendFileSync(OUT, JSON.stringify({ unit: run.code, unitName: run.name, cust: run.cust, con: run.con, error: String(e?.message ?? e).slice(0, 300) }) + "\n"); }
    if (++done % 100 === 0) console.log(done, "/", runs.length);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log("done", runs.length); process.exit(0);
