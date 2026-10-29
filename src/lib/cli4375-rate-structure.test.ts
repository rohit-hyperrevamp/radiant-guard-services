import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateFormula, parseFormulaConfig } from './formula-engine';
const rows = JSON.parse(readFileSync('db/cli4375-rate-fixture.json', 'utf8'));
describe('CLI4375 supplied rates', () => {
  for (const [name, gross, ctc, billing] of [
    ['Security Officer', 27380.90, 34797.88, 43846.59],
    ['Security Supervisor', 23230.90, 30831.88, 38849.27],
    ['Security Guard', 22540.90, 29951.46, 37739.92],
    ['Lady Security Guard', 22540.90, 29951.46, 32347.58],
  ] as const) {
    it(`${name} reproduces supplied formula lines`, () => {
      const r = rows.find((x: any) => x.designation_name === name);
      expect(r.gross).toBe(gross);
      const ctx: Record<string, number> = { gross, basic: r.components[0].amount, da:3900, conveyance_allowance:1800, washing_allowance:1000, total_ctc:ctc };
      const reliever = r.employer_contributions.find((x: any) => x.name.startsWith('Reliever'))?.amount ?? 0;
      ctx.billing_rate = ctc + reliever;
      for (const x of r.employer_contributions) {
        const result = evaluateFormula(parseFormulaConfig(x.formulaMode,x.formulaExpression),ctx);
        expect(result.error).toBeUndefined();
        expect(Math.round(result.amount*100)/100).toBe(x.amount);
      }
      expect(Math.round((gross+r.employer_contributions.reduce((s:number,x:any)=>s+x.amount,0))*100)/100).toBe(billing);
      if (name === 'Lady Security Guard') expect(reliever).toBe(0);
    });
  }
});
