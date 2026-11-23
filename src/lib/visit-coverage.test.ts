import { describe, expect, it } from 'vitest';
import { visitCoverage, type VisitHistory } from './visit-coverage';
describe('field visit coverage',()=>{
 it('counts locations once, not repeated visits, and keeps unclosed sites pending',()=>{
  const visits=[{unit_id:'a',check_out_at:'2026-11-24T10:00:00Z'},{unit_id:'a',check_out_at:'2026-11-24T11:00:00Z'},{unit_id:'b',check_out_at:null}];
  const history={rosterSource:'saved',assigned:[{unit_id:'a'},{unit_id:'b'},{unit_id:'c'}],visits} as VisitHistory;
  const result=visitCoverage(history);expect(result.completedSites).toBe(1);expect(result.pending.map(s=>s.unit_id)).toEqual(['b','c']);expect(result.inProgress.has('b')).toBe(true);
 });
});