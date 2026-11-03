import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './formula-engine';

describe('CLI2093 employer ESIC full-gross choice', () => {
  it('calculates ₹670 on ₹20,616.88 gross without excluding ₹1,500 conveyance or ₹300 washing', () => {
    const sql = readFileSync('db/prod-migrations/20261103094600_correct_er_esi_gross_choice.sql', 'utf8');
    const expression = sql.match(/formula_expression = '([^']+)'/)?.[1];
    if (!expression) throw new Error('Missing corrected Gross formula');
    expect(evaluateExpression(expression, {
      gross: 20616.88, conveyance_allowance: 1500, washing_allowance: 300,
    })).toBe(670);
  });

  it('keeps the separately selected allowance-exclusion formula at ₹611 on the same wages', () => {
    expect(Math.ceil(evaluateExpression('(gross - conveyance_allowance - washing_allowance) * 0.0325', {
      gross: 20616.88, conveyance_allowance: 1500, washing_allowance: 300,
    }))).toBe(611);
  });
});