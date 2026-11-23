import { describe, expect, it } from 'vitest';
import { visitCoverage, visitHistorySelection, type VisitHistory } from './visit-coverage';
describe('field visit coverage',()=>{
 it('counts locations once, not repeated visits, and keeps unclosed sites pending',()=>{
  const visits=[{unit_id:'a',check_out_at:'2026-11-24T10:00:00Z'},{unit_id:'a',check_out_at:'2026-11-24T11:00:00Z'},{unit_id:'b',check_out_at:null}];
  const history={rosterSource:'saved',assigned:[{unit_id:'a'},{unit_id:'b'},{unit_id:'c'}],visits} as VisitHistory;
  const result=visitCoverage(history);expect(result.completedSites).toBe(1);expect(result.pending.map(s=>s.unit_id)).toEqual(['b','c']);expect(result.inProgress.has('b')).toBe(true);
 });
 it('keeps each completed visit form with its actual timing, even at a repeated client',()=>{
  const visits=[{id:'morning',unit_id:'a',unit_name:'Client Alpha',unit_code:'CLI1',check_in_at:'2026-11-23T04:00:00Z',check_out_at:'2026-11-23T05:00:00Z'},{id:'evening',unit_id:'a',unit_name:'Client Alpha',unit_code:'CLI1',check_in_at:'2026-11-23T10:00:00Z',check_out_at:'2026-11-23T11:00:00Z'},{id:'open',unit_id:'b',unit_name:'Client Beta',check_out_at:null}];
  const history={rosterSource:'saved',assigned:[],visits} as unknown as VisitHistory;
  const selected=visitHistorySelection(history,'completed','Alpha');expect(selected.visits.map(v=>v.id)).toEqual(['morning','evening']);expect(selected.visits[1]?.check_in_at).toBe('2026-11-23T10:00:00Z');
 });
});