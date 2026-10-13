import { supabase } from "./shim";
import { evaluateFormula, slugifyVar } from "@/lib/formula-engine";
import { unknownFormulaVariables } from "@/lib/payroll-calc";
const fs = require("fs");
const unk = JSON.parse(fs.readFileSync("/tmp/esi/unk.json", "utf8"));
const MAP: Record<string, RegExp> = { cca: /conveyance/i, leave_pay: /leave with wages/i };
const rids = Array.from(new Set(unk.map((o: any) => o.rid)));
const report: any[] = []; const WRITE = process.argv[2] === "write";
for (const rid of rids) {
  const { data: r } = await supabase.from("contract_resources").select("id, components, benefits, deductions, employer_contributions").eq("id", rid).single();
  if (!r) continue;
  const comps = (r.components ?? []) as any[]; const names = comps.map((c) => String(c.name ?? ""));
  const ctx: any = {};
  for (const x of [...comps, ...((r.benefits ?? []) as any[])]) { const k = slugifyVar(x.name); ctx[k] = (ctx[k] ?? 0) + (Number(x.amount) || 0); }
  let changed = false;
  for (const side of ["deductions", "employer_contributions", "benefits", "components"]) {
    const lines = (r as any)[side] as any[]; if (!Array.isArray(lines)) continue;
    for (const ln of lines) {
      const f = ln?.formulaExpression; if (!f) continue;
      const miss = unknownFormulaVariables(f, names); let nf = f;
      for (const m of miss) { const target = MAP[m] && names.find((n) => MAP[m].test(n)); if (target) nf = nf.replace(new RegExp(`\\b${m}\\b`, "gi"), slugifyVar(target)); }
      if (nf === f) continue;
      const cfg = { mode: "advanced", expression: f } as any;
      const oldE = evaluateFormula(cfg, ctx).amount, newE = evaluateFormula({ ...cfg, expression: nf }, ctx).amount;
      const stored = Number(ln.amount) || 0;
      const rnd = (v: number) => ln.roundOff ? Math.round(v) : (ln.roundMode === "up" ? Math.ceil(v) : Math.round(v * 100) / 100);
      const consistent = Math.abs(rnd(oldE) - stored) < 0.02 || Math.abs(oldE - stored) < 0.02;
      report.push({ rid, side, line: ln.name, old: f, new: nf, stored, newAmt: consistent ? rnd(newE) : null, consistent });
      ln.formulaExpression = nf; if (consistent) ln.amount = rnd(newE); changed = true;
    }
  }
  if (changed && WRITE) { const { error } = await supabase.from("contract_resources").update({ deductions: r.deductions, employer_contributions: r.employer_contributions, benefits: r.benefits, components: r.components }).eq("id", rid); if (error) console.log(rid, error.message); }
}
fs.writeFileSync("/tmp/fx/report.json", JSON.stringify(report));
console.log("lines", report.length, "consistent", report.filter((x) => x.consistent).length);
for (const x of report.filter((x) => !x.consistent).slice(0, 8)) console.log(x.line, x.stored, x.old);
process.exit(0);
