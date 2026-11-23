import { describe, expect, it } from 'vitest';
import { selectAllMatching, taskDeadline, taskFinished, taskSummary } from './task-workflow';
const row = (id: string, status: string, review_status = 'not_submitted') => ({ id, status, review_status, assignment_group_id: 'one-task', assignee_id: id, created_by: 'manager', due_at: '2026-11-24T10:00:00Z', acknowledged_at: null });
describe('multi-recipient task progress', () => {
  it('counts one created task for two employees and waits for both reviews', () => { expect(taskSummary([row('a','completed','accepted'), row('b','open')],true).total).toBe(1); expect(taskSummary([row('a','completed','accepted'),row('b','open')],true).completed).toBe(0); });
  it('counts a submitted task as pending review, not finally completed', () => { expect(taskSummary([row('a','completed','pending')]).review).toBe(1); expect(taskFinished(row('a','completed','pending'))).toBe(false); });
  it('makes returned work pending again', () => { expect(taskSummary([row('a','open','returned')]).open).toBe(1); });
  it('selects all matching employees without duplicating existing choices', () => { expect(selectAllMatching(['a'],['a','b','c'])).toEqual(['a','b','c']); });
  it('supports one hour rescheduling', () => { expect(taskDeadline(1,new Date('2026-11-24T10:00:00Z')).toISOString()).toBe('2026-11-24T11:00:00.000Z'); });
  it('supports two hour rescheduling', () => { expect(taskDeadline(2,new Date('2026-11-24T10:00:00Z')).toISOString()).toBe('2026-11-24T12:00:00.000Z'); });
});