import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './formula-engine';

describe('employer Leave 8.33% of Basic + DA', () => {
  const sql = readFileSync('db/prod-migrations/20261103110000_er_leave_basic_da_833.sql', 'utf8');
  const expression = sql.match(/'advanced', '([^']+)'/)?.[1];

  it('evaluates 8.33% of Basic + DA with no cap', () => {
    expect(evaluateExpression('(basic + da) * 0.0833', {
      basic: 15000, da: 5000,
    })).toBeCloseTo(1666, 4);
  });

  it('stores the no-cap 8.33% Basic + DA expression in the migration', () => {
    expect(expression).toBe('(basic + da) * 0.0833');
    expect(sql).toContain("'ER_LEAVE_BASIC_DA_833'");
    expect(sql).toContain("'employer'");
  });
});
