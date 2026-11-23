export type TaskProgress = { id: string; assignment_group_id?: string | null; status: string; review_status?: string; assignee_id: string; created_by: string; due_at: string | null; acknowledged_at: string | null };
export const taskFinished = (t: TaskProgress) => t.status === 'cancelled' || (t.status === 'completed' && t.review_status !== 'pending');
export const taskSubmitted = (t: TaskProgress) => t.status === 'completed' && t.review_status === 'pending';
export function taskSummary(list: TaskProgress[], grouped = false, now = Date.now()) {
  const groups = new Map<string, TaskProgress[]>();
  for (const t of list) { const key = grouped ? t.assignment_group_id || t.id : t.id; groups.set(key, [...(groups.get(key) ?? []), t]); }
  const rows = [...groups.values()];
  return { total: rows.length, open: rows.filter(g => g.some(t => !taskFinished(t))).length,
    completed: rows.filter(g => g.every(t => taskFinished(t)) && g.some(t => t.status === 'completed')).length,
    review: rows.filter(g => g.some(taskSubmitted)).length,
    notResponded: rows.filter(g => g.some(t => t.status === 'open' && !t.acknowledged_at)).length,
    overdue: rows.filter(g => g.some(t => !taskFinished(t) && !taskSubmitted(t) && t.due_at && new Date(t.due_at).getTime() < now)).length };
}
export function selectAllMatching(selected: string[], matching: string[]) { return [...new Set([...selected, ...matching])]; }
export function taskDeadline(hours: number, now = new Date()) { return new Date(now.getTime() + hours * 3_600_000); }