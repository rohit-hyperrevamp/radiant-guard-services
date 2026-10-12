import { supabase } from "./shim";
import { unknownFormulaVariables } from "@/lib/payroll-calc";
import { readFileSync, writeFileSync } from "fs";
const props = JSON.parse(readFileSync("/tmp/esi/props.json", "utf8")); const sim = JSON.parse(readFileSync("/tmp/esi/sim.json", "utf8"));
const updates: any[] = props.filter((p: any) => { const r = sim[p.rid]; return r && r.afterBad < r.beforeBad && r.broke === 0; }).map((p: any) => ({ ...p, why: "pages" }));
async function all(q: () => any) { const out: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const contracts = await all(() => supabase.from("client_contracts").select("id, contract_code, units(code)").eq("status", "active"));
const cmap = new Map(contracts.map((c: any) => [c.id, c]));
const res = (await all(() => supabase.from("contract_resources").select("id, contract_id, components, deductions, employer_contributions"))).filter((r: any) => cmap.has(r.contract_id));
const REPL: Record<string, string[]> = { d_a: ["da"], leave_with_wages: ["leave_pay"], conveyance_allowance: ["cca"], special_allowance: ["da"] };
const taken = new Set(updates.map((u) => u.rid + u.side + u.idx));
for (const r of res) {
  const comps = (r.components ?? []).map((c: any) => String(c.name ?? ""));
  for (const side of ["deductions", "employer_contributions"]) (r[side] ?? []).forEach((e: any, idx: number) => {
    if (taken.has(r.id + side + idx)) return;
    let f = String(e?.formulaExpression ?? ""); if (!f.trim() || f.trim().startsWith("{")) return;
    const unk = unknownFormulaVariables(f, comps); let changed = false;
    for (const v of unk) {
      const to = (REPL[v] ?? []).find((t) => !unknownFormulaVariables(t, comps).length && !new RegExp(`\\b${t}\\b`).test(f));
      if (!to) continue; f = f.replace(new RegExp(`\\b${v}\\b`, "g"), to); changed = true;
    }
    if (changed) updates.push({ rid: r.id, side, idx, name: e.name, old: e.formulaExpression, nf: f, unit: cmap.get(r.contract_id).units?.code, con: cmap.get(r.contract_id).contract_code, why: "unknown-var" });
  });
}
writeFileSync("/tmp/esi/updates.json", JSON.stringify(updates, null, 1));
for (const u of updates) console.log(u.why, u.unit, u.side.slice(0, 3), u.name.slice(0, 30), "|", u.old, "=>", u.nf);
process.exit(0);
