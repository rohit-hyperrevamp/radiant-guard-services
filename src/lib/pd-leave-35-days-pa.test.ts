import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateFormula, parseFormulaConfig, serializeFormulaConfig } from './formula-engine';

describe('P.D. Leave employer contribution', () => {
  const sql = readFileSync('db/prod-migrations/20261124164000_pd_leave_35_days_pa.sql', 'utf8');
  const expression = sql.match(/'advanced', '([^']+)'/)?.[1];
  if (!expression) throw new Error('Missing saved P.D. Leave formula');
  const formula = parseFormulaConfig('advanced', expression);

  it('calculates 10.25% of Basic plus DA, excluding other wages', () => {
    expect(evaluateFormula(formula, { basic: 15000, da: 5000, hra: 10000, gross: 50000 }).amount).toBe(2050);
    expect(evaluateFormula(formula, { basic: 10000, da: 2000 }).amount).toBe(1230);
    expect(evaluateFormula(formula, { basic: 0, da: 0, gross: 50000 }).amount).toBe(0);
  });

  it('preserves the formula through save and reload without an annual multiplier or hidden cap', () => {
    if (!formula) throw new Error('Invalid P.D. Leave formula');
    const saved = serializeFormulaConfig(formula);
    const reloaded = parseFormulaConfig(saved.mode, saved.expression);
    expect(evaluateFormula(reloaded, { basic: 80000, da: 20000, fixed_days: 35, days_in_month: 30 }).amount).toBe(10250);
  });
});