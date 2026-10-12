import { supabase } from "./shim";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { computeWages, applyEsiToWageComputation, applyEpfBreakdownToWageComputation } from "@/lib/payroll-calc";
import { writeFileSync } from "fs";
async function all(q: () => any) { const out: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const slips = await all(() => supabase.from("pages_payslip_archive").select("unit_id, employee_code, employee_name, designation_name, duty, ot, gross, earnings, deductions").eq("period_year", 2026).eq("period_month", 8).eq("ot", 0));
const contracts = await all(() => supabase.from("client_contracts").select("id, contract_code, unit_id, start_date").eq("status", "active").eq("record_type", "client"));
const units = await all(() => supabase.from("units").select("id, code, epf_cap_enabled"));
const unitCode = new Map(units.map((u: any) => [u.id, u]));
const byUnit = new Map<string, any>(); for (const c of contracts.sort((a: any, b: any) => (a.start_date < b.start_date ? 1 : -1))) if (!byUnit.has(c.unit_id)) byUnit.set(c.unit_id, c);
const res = await all(() => supabase.from("contract_resources").select("contract_id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id"));
const desig = new Map((await all(() => supabase.from("designations").select("id, name"))).map((d: any) => [d.id, d.name]));
const pdbs = await all(() => supabase.from("payroll_day_bases").select("id, method, fixed_days, weekly_off_day, included_weekdays"));
const pdb = new Map(pdbs.map((p: any) => [p.id, { method: p.method, fixedDays: p.fixed_days, weeklyOffDay: p.weekly_off_day, includedWeekdays: p.included_weekdays }]));
const resByContract = new Map<string, any[]>(); for (const r of res) { const a = resByContract.get(r.contract_id) ?? []; a.push(r); resByContract.set(r.contract_id, a); }
const dates: Date[] = []; for (let d = 1; d <= 31; d++) dates.push(new Date(2026, 7, d));
const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const out: any[] = []; let checked = 0;
const hydCache = new Map<string, any>();
for (const s of slips) {
  const c = byUnit.get(s.unit_id); if (!c) continue;
  const rs = (resByContract.get(c.id) ?? []).filter((r) => norm(desig.get(r.designation_id)) === norm(s.designation_name));
  if (rs.length !== 1) continue;
  const r = rs[0];
  let h = hydCache.get(r.contract_id + r.designation_id);
  if (!h) {
    [h] = await hydrateFormulasFromMaster([{ designationId: r.designation_id, components: r.components ?? [], benefits: r.benefits ?? [], deductions: r.deductions ?? [], employerContributions: r.employer_contributions ?? [], payrollDayBase: r.payroll_day_base_id ? pdb.get(r.payroll_day_base_id) ?? null : null } as any]);
    hydCache.set(r.contract_id + r.designation_id, h);
  }
  const pEsi = (s.deductions ?? []).find((d: any) => /^esi/i.test(d.name))?.amount ?? 0;
  const pPf = (s.deductions ?? []).find((d: any) => /^e?pf/i.test(d.name))?.amount ?? 0;
  const duty = Number(s.duty) || 0; if (duty <= 0) continue;
  const totals = { candidateId: "x", pDays: duty, otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0, tDays: duty };
  const epfCapEnabled = unitCode.get(s.unit_id)?.epf_cap_enabled ?? true;
  let w: any = computeWages(totals as any, h, 31, { periodDates: dates, dayBases: [], epfCapEnabled } as any);
  w = applyEsiToWageComputation(w); w = applyEpfBreakdownToWageComputation(w, { epfCapEnabled });
  const oEsi = w.deductions.find((d: any) => /\besic?\b/i.test(d.name))?.amount ?? 0;
  const oPf = w.deductions.find((d: any) => /\be?pf\b/i.test(d.name))?.amount ?? 0;
  checked++;
  const grossOk = Math.abs(w.earnedGross - Number(s.gross)) <= 2;
  out.push({ unit: unitCode.get(s.unit_id)?.code, con: c.contract_code, des: s.designation_name, emp: s.employee_code, duty, pGross: Number(s.gross), oGross: w.earnedGross, grossOk, pEsi, oEsi, pPf, oPf, earnings: s.earnings, esiF: (h.deductions.find((d: any) => /\besic?\b/i.test(d.name)) ?? {}).formulaExpression ?? null, pfF: (h.deductions.find((d: any) => /\be?pf\b/i.test(d.name)) ?? {}).formulaExpression ?? null });
}
writeFileSync("/tmp/esi/scan.json", JSON.stringify(out));
const g = out.filter((x) => x.grossOk);
console.log("checked", checked, "grossOk", g.length, "esiMismatch", g.filter((x) => Math.abs(x.pEsi - x.oEsi) > 1).length, "pfMismatch", g.filter((x) => Math.abs(x.pPf - x.oPf) > 1).length);
process.exit(0);
