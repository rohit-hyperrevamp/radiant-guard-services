import { supabase } from "./shim";
import { hydrateFormulasFromMaster } from "@/lib/contract-hydrate";
import { computeWages, applyEsiToWageComputation, applyEpfBreakdownToWageComputation, unknownFormulaVariables } from "@/lib/payroll-calc";
import { slugifyVar } from "@/lib/formula-engine";
import { writeFileSync } from "fs";
async function all(q: () => any) { const out: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const contracts = await all(() => supabase.from("client_contracts").select("id, contract_code, unit_id, start_date, record_type, units(code, epf_cap_enabled)").eq("status", "active"));
const cmap = new Map(contracts.map((c: any) => [c.id, c]));
const res = (await all(() => supabase.from("contract_resources").select("id, contract_id, designation_id, components, benefits, deductions, employer_contributions, payroll_day_base_id"))).filter((r: any) => cmap.has(r.contract_id));
const desig = new Map((await all(() => supabase.from("designations").select("id, name"))).map((d: any) => [d.id, d.name]));
const SHAPE = /^\s*(min\(\s*)?\(?\s*([a-z0-9_ +]+?)\s*\)?\s*(?:,\s*([\d.]+)\s*\))?\s*\*\s*([\d.]+)\s*$/;
function labelVars(name: string, comps: string[]): string[] | null {
  const m = String(name).match(/\(([^()]*)\)\s*$/); if (!m) return null;
  const part = m[1].split(",")[0].trim(); if (/cap/i.test(part) || part.includes("-") || !part.includes("+") && !/^[A-Za-z ._]+$/.test(part)) return null;
  const out: string[] = [];
  for (const raw of part.split("+").map((s) => s.trim()).filter(Boolean)) {
    let v = /^(ed|extra duty|ot|overtime)$/i.test(raw) ? "ed_amount" : slugifyVar(raw.replace(/\./g, ""));
    if (unknownFormulaVariables(v, comps).length) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out.length ? out : null;
}
const props: any[] = [];
for (const r of res) {
  const comps = (r.components ?? []).map((c: any) => String(c.name ?? ""));
  for (const side of ["deductions", "employer_contributions"]) (r[side] ?? []).forEach((e: any, idx: number) => {
    if (!/\b(e?pf|esic?)\b/i.test(e?.name ?? "")) return;
    const f = String(e.formulaExpression ?? "").trim(); if (!f) return;
    const m = f.match(SHAPE); if (!m) return;
    const cur = m[2].split("+").map((s) => s.trim()).filter(Boolean);
    const want = labelVars(e.name, comps); if (!want) return;
    const key = (v: string) => { if (!unknownFormulaVariables(v, []).length) return v; const i = comps.findIndex((c) => !unknownFormulaVariables(v, [c]).length); return i >= 0 ? "c" + i : "?" + v; };
    const curKnown = cur.filter((v) => !unknownFormulaVariables(v, comps).length);
    const curKeys = new Set(curKnown.map(key));
    const adds = want.filter((v) => !curKeys.has(key(v)));
    if (!adds.length && curKnown.length === cur.length) return;
    const vars = [...curKnown, ...adds];
    const nf = m[1] ? `min(${vars.join(" + ")}, ${m[3] ?? ""}) * ${m[4]}` : `(${vars.join(" + ")}) * ${m[4]}`;
    if (m[1] && !m[3]) return;
    props.push({ rid: r.id, side, idx, name: e.name, old: f, nf, unit: cmap.get(r.contract_id).units?.code, con: cmap.get(r.contract_id).contract_code, des: desig.get(r.designation_id) });
  });
}
console.log("proposals", props.length);
writeFileSync("/tmp/esi/props.json", JSON.stringify(props));
// simulate against Pages Aug slips
const slips = await all(() => supabase.from("pages_payslip_archive").select("unit_id, employee_code, designation_name, duty, ot, gross, deductions").eq("period_year", 2026).eq("period_month", 8).eq("ot", 0));
const pdbs = await all(() => supabase.from("payroll_day_bases").select("id, method, fixed_days, weekly_off_day, included_weekdays"));
const pdb = new Map(pdbs.map((p: any) => [p.id, { method: p.method, fixedDays: p.fixed_days, weeklyOffDay: p.weekly_off_day, includedWeekdays: p.included_weekdays }]));
const propRids = new Set(props.map((p) => p.rid));
const byUnit = new Map<string, any>(); for (const c of contracts.filter((c: any) => c.record_type === "client").sort((a: any, b: any) => (a.start_date < b.start_date ? 1 : -1))) if (!byUnit.has(c.unit_id)) byUnit.set(c.unit_id, c);
const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const dates: Date[] = []; for (let d = 1; d <= 31; d++) dates.push(new Date(2026, 7, d));
const sim = async (r: any, s: any, patched: boolean) => {
  const clone = JSON.parse(JSON.stringify(r));
  if (patched) for (const p of props.filter((p) => p.rid === r.id)) clone[p.side][p.idx].formulaExpression = p.nf;
  const [h] = await hydrateFormulasFromMaster([{ designationId: r.designation_id, components: clone.components ?? [], benefits: clone.benefits ?? [], deductions: clone.deductions ?? [], employerContributions: clone.employer_contributions ?? [], payrollDayBase: r.payroll_day_base_id ? pdb.get(r.payroll_day_base_id) ?? null : null } as any]);
  const epfCapEnabled = cmap.get(r.contract_id).units?.epf_cap_enabled ?? true;
  let w: any = computeWages({ candidateId: "x", pDays: Number(s.duty), otDays: 0, otHours: 0, phDays: 0, otherPaidDays: 0, tDays: Number(s.duty) } as any, h, 31, { periodDates: dates, dayBases: [], epfCapEnabled } as any);
  w = applyEsiToWageComputation(w); w = applyEpfBreakdownToWageComputation(w, { epfCapEnabled });
  return { gross: w.earnedGross, esi: w.deductions.find((d: any) => /\besic?\b/i.test(d.name))?.amount ?? 0, pf: w.deductions.find((d: any) => /\be?pf\b/i.test(d.name))?.amount ?? 0 };
};
const perRole: any = {};
for (const s of slips) {
  const c = byUnit.get(s.unit_id); if (!c) continue;
  const rs = res.filter((r: any) => r.contract_id === c.id && norm(desig.get(r.designation_id)) === norm(s.designation_name));
  if (rs.length !== 1 || !propRids.has(rs[0].id) || !(Number(s.duty) > 0)) continue;
  const a = await sim(rs[0], s, false); if (Math.abs(a.gross - Number(s.gross)) > 2) continue;
  const b = await sim(rs[0], s, true);
  const pE = (s.deductions ?? []).find((d: any) => /^esi/i.test(d.name))?.amount ?? 0;
  const pP = (s.deductions ?? []).find((d: any) => /^e?pf/i.test(d.name))?.amount ?? 0;
  const k = rs[0].id; perRole[k] ??= { beforeBad: 0, afterBad: 0, n: 0, broke: 0 };
  const bb = (Math.abs(a.esi - pE) > 1 ? 1 : 0) + (Math.abs(a.pf - pP) > 1 ? 1 : 0);
  const ab = (Math.abs(b.esi - pE) > 1 ? 1 : 0) + (Math.abs(b.pf - pP) > 1 ? 1 : 0);
  perRole[k].n++; perRole[k].beforeBad += bb; perRole[k].afterBad += ab; if (ab > bb) perRole[k].broke++;
}
writeFileSync("/tmp/esi/sim.json", JSON.stringify(perRole));
const v = Object.values(perRole) as any[];
console.log("roles with evidence", v.length, "beforeBad", v.reduce((s, x) => s + x.beforeBad, 0), "afterBad", v.reduce((s, x) => s + x.afterBad, 0), "rolesBroke", v.filter((x) => x.broke).length);
process.exit(0);
