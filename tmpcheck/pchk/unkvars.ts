import { supabase } from "./shim";
import { unknownFormulaVariables } from "@/lib/payroll-calc";
async function all(q: () => any) { const out: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; }
const contracts = await all(() => supabase.from("client_contracts").select("id, contract_code, unit_id, units(code)").eq("status", "active"));
const cmap = new Map(contracts.map((c: any) => [c.id, c]));
const res = (await all(() => supabase.from("contract_resources").select("id, contract_id, components, deductions, employer_contributions, designation_id"))).filter((r: any) => cmap.has(r.contract_id));
const out: any[] = [];
for (const r of res) {
  const comps = (Array.isArray(r.components) ? r.components : []).map((c: any) => String(c.name ?? ""));
  for (const side of ["components", "deductions", "employer_contributions"]) for (const e of (Array.isArray(r[side]) ? r[side] : [])) {
    const m = unknownFormulaVariables(e?.formulaExpression, comps);
    if (m.length) out.push({ rid: r.id, side, unit: cmap.get(r.contract_id).units?.code, con: cmap.get(r.contract_id).contract_code, des: r.designation_id, line: e.name, f: e.formulaExpression, missing: m, comps });
  }
}
require("fs").writeFileSync("/tmp/esi/unk.json", JSON.stringify(out));
console.log("roles", res.length, "bad lines", out.length);
const by: any = {}; for (const o of out) for (const m of o.missing) by[m] = (by[m] ?? 0) + 1; console.log(by);
process.exit(0);
