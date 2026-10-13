import { supabase } from "../pchk/shim";
const IDS: string[] = JSON.parse(require("fs").readFileSync("/tmp/pg/ids.json","utf8"));
const m: any = await import("@/routes/admin.contracts.client-contracts");
const { computeBenefitAmount: cba0, hasConfiguredFormula, formulaReferencesCtc } = m;
let fails = 0; const failIds = new Set<string>();
const computeBenefitAmount = (b: any, ...a: any[]) => { try { return cba0(b, ...a); } catch { fails++; return b.amount; } };
const at = ((await supabase.from("allowance_types").select("id,name,display_name,short_name,enabled")).data ?? [])
  .filter((r: any) => r.enabled !== false).map((r: any) => ({ id: r.id, name: r.name, displayName: r.display_name ?? r.name, shortName: r.short_name ?? "" }));
const rows: any[] = [];
for (let k = 0; k < IDS.length; k += 150) {
  const { data, error } = await supabase.from("contract_resources").select("id,contract_id,components,benefits,deductions,employer_contributions").in("id", IDS.slice(k, k + 150));
  if (error) throw error; rows.push(...data!);
}
const norm = (x: any[]) => (Array.isArray(x) ? x : []).map((b) => ({ ...b, baseComponents: Array.isArray(b.baseComponents) ? b.baseComponents : [] }));
const isAddOn = (b: any) => /management\s*fee|reliever/i.test(b.name ?? "");
const sum = (a: any[]) => a.reduce((s, b) => s + (Number(b.amount) || 0), 0);
const out: any[] = [];
for (const r of rows) {
  const comps = norm(r.components), ben0 = norm(r.benefits), er0 = norm(r.employer_contributions), de0 = norm(r.deductions);
  const calc = (b: any) => b.calcType === "percentage" || hasConfiguredFormula(b);
  const ben = ben0.map((b) => (calc(b) ? { ...b, amount: computeBenefitAmount(b, comps, [], at) } : b));
  const refs = (b: any) => formulaReferencesCtc(b.formulaExpression) || b.baseComponents.some((x: any) => /^(total\s+)?ctc$/i.test(String(x.label).trim()));
  const fp = er0.map((b) => (calc(b) && !refs(b) ? { ...b, amount: computeBenefitAmount(b, comps, ben, at) } : b));
  const base = fp.filter((b) => !refs(b) && !isAddOn(b));
  const er = fp.map((b) => (calc(b) && refs(b) ? { ...b, amount: computeBenefitAmount(b, comps, ben, at, base) } : b));
  const de = de0.map((b) => (calc(b) ? { ...b, amount: computeBenefitAmount(b, comps, ben, at) } : b));
  const before = sum(comps) + sum(ben0) + sum(er0), after = sum(comps) + sum(ben) + sum(er);
  out.push({ id: r.id, before: Math.round(before * 100) / 100, after: Math.round(after * 100) / 100, benefits: ben, employer_contributions: er, deductions: de,
    changed: JSON.stringify(ben) !== JSON.stringify(ben0) || JSON.stringify(er) !== JSON.stringify(er0) || JSON.stringify(de) !== JSON.stringify(de0) });
}
await Bun.write("/tmp/pg/recalc.json", JSON.stringify(out));
console.log("fails", fails); console.log(rows.length, out.filter((o) => Math.abs(o.after - o.before) > 0.01).length, "rate changes on save");
process.exit(0);
