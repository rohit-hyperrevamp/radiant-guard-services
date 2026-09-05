import { execFileSync } from "node:child_process";
import { refreshBillingAddOns, isBillingAddOn } from "@/lib/contract-billing-addons";

const url = process.env.RADIANT_PROD_DB_URL!;
const q = (sql: string) =>
  JSON.parse(execFileSync("psql", [url, "-At", "-c", `select coalesce(json_agg(t),'[]') from (${sql}) t`], { maxBuffer: 1 << 28 }).toString());

const rows = q(`select r.id, r.contract_id, c.contract_code, r.components, r.benefits, r.employer_contributions from contract_resources r join client_contracts c on c.id=r.contract_id`);
const masters = [
  ...q(`select id, formula_mode, formula_expression from allowance_types`),
  ...q(`select id, formula_mode, formula_expression from cost_components`),
];
const mById = new Map(masters.map((m: any) => [String(m.id), m]));

const overlay = (l: any) => {
  const id = l?.allowanceId ?? l?.costComponentId;
  const m = id ? mById.get(String(id)) : null;
  return m ? { ...l, formulaMode: m.formula_mode, formulaExpression: m.formula_expression } : l;
};

const updates: string[] = [];
for (const r of rows as any[]) {
  const res = {
    components: (r.components ?? []).map(overlay),
    benefits: (r.benefits ?? []).map(overlay),
    employerContributions: (r.employer_contributions ?? []).map(overlay),
  };
  const fresh = refreshBillingAddOns(res);
  const merge = (orig: any[], next: any[]) =>
    (orig ?? []).map((l, i) => (isBillingAddOn(l) ? { ...l, amount: next[i].amount } : l));
  const nb = merge(r.benefits ?? [], fresh.benefits ?? []);
  const ne = merge(r.employer_contributions ?? [], fresh.employerContributions ?? []);
  const changed = JSON.stringify(nb) !== JSON.stringify(r.benefits ?? []) || JSON.stringify(ne) !== JSON.stringify(r.employer_contributions ?? []);
  if (!changed) continue;
  for (const [o, n] of [[r.benefits ?? [], nb], [r.employer_contributions ?? [], ne]] as any[][]) {
    o.forEach((l: any, i: number) => {
      if (isBillingAddOn(l) && Number(l.amount) !== Number(n[i].amount))
        console.log(`${r.contract_code} ${l.name}: ${l.amount} -> ${n[i].amount}`);
    });
  }
  const esc = (o: unknown) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
  updates.push(`update contract_resources set benefits=${esc(nb)}, employer_contributions=${esc(ne)} where id='${r.id}';`);
}
console.log(`\n${updates.length} rows to update`);
if (process.argv.includes("--apply") && updates.length) {
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-c", `begin; ${updates.join("\n")} commit;`], { stdio: "inherit", maxBuffer: 1 << 28 });
  console.log("applied");
}
