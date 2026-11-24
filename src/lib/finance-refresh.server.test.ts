import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ calls: [] as string[], compute: vi.fn(), row: { unit_id:'a',period_start:'2026-09-01',period_end:'2026-09-30',generation:1,lease_token:'lease' } }));
vi.mock('@/lib/radiant-admin.server', () => {
  const client = {
    async rpc(this: unknown, fn: string, args?: Record<string, unknown>) {
      if (this !== client) throw new Error('Lost database client receiver');
      mocks.calls.push(fn);
      if (fn === 'claim_finance_totals') return {data:[mocks.row],error:null};
      if (fn === 'publish_finance_totals') {
        expect((args?.['p_rows'] as {calculation_version:number}[])[0]?.calculation_version).toBe(4);
        return {data:1,error:null};
      }
      return {data:null,error:null};
    },
  };
  return {supabaseAdmin:client};
});
vi.mock('@/lib/finance-summary-compute', () => ({computeFinanceSummaries:mocks.compute}));
import { refreshFinanceSummaries } from './finance-refresh.server';
describe('finance background refresh', () => {
  beforeEach(() => {mocks.calls.length=0;mocks.compute.mockReset();});
  it('claims, computes and publishes every period with the bound database client', async () => {
    mocks.compute.mockResolvedValue(new Map([['a',{employer_cost:1800}]]));
    expect(await refreshFinanceSummaries()).toEqual({claimed:1,published:1});
    expect(mocks.calls).toEqual(['claim_finance_totals','publish_finance_totals','continue_finance_refresh']);
  });
  it('never publishes a source failure as a zero client result', async () => {
    mocks.compute.mockRejectedValue(new Error('Source failed'));
    expect(await refreshFinanceSummaries()).toEqual({claimed:1,published:0});
    expect(mocks.calls).toEqual(['claim_finance_totals','fail_finance_totals','continue_finance_refresh']);
  });
});