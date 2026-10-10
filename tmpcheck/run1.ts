import { computeUnit } from "./engine";
import { supabase, db } from "/tmp/pchk/shim";
import { fetchEnabledPublicHolidays } from "@/lib/public-holidays";
const G = { publicHolidays: await fetchEnabledPublicHolidays(), ptSlabs: (await supabase.from("professional_tax_slabs").select("id, state, region_label, salary_min, salary_max, tax_per_month, gender")).data, pincodeRanges: (await supabase.from("pincode_ranges").select("state, region_label, range_start, range_end, is_excluded")).data, lwfRows: (await supabase.from("labour_welfare_funds").select("id, state, deduction_months, frequency, employee_contribution, employer_contribution, enabled, notes")).data };
const [u] = await db`select c.unit_id, r.period_start::text s, r.period_end::text e from client_contracts c join payroll_runs r on r.unit_id=c.unit_id where c.contract_code='CON16020' and r.period_start>='2026-08-20' limit 1`;
const r = await computeUnit(u.unit_id, u.s, u.e, G as any);
for (const x of r.rows.filter((x:any)=>x.totals.tDays>0)) console.log(x.c.employee_code, x.designationName, x.totals.pDays, x.totals.otDays, x.wages?.earnedGross, x.wages?.deductions.map((d:any)=>d.name+":"+d.amount).join(" | "), x.wages?.netPay);
process.exit(0);
