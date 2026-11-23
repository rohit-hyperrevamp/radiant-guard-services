import type { FieldVisit } from './field-visits';
export type AssignedVisitSite = {unit_id:string;unit_name:string;unit_code:string|null;customer_name:string|null};
export type DetailedVisit = FieldVisit & {unit_name:string;unit_code:string|null;customer_name:string|null};
export type VisitHistory = {rosterSource:'saved'|'current';assigned:AssignedVisitSite[];visits:DetailedVisit[]};
export function visitCoverage(history: VisitHistory) {
 const completed=new Set(history.visits.filter(v=>v.check_out_at).map(v=>v.unit_id));
 const inProgress=new Set(history.visits.filter(v=>!v.check_out_at).map(v=>v.unit_id));
 const assigned=[...new Map(history.assigned.map(s=>[s.unit_id,s])).values()];
 return {completedSites:completed.size,assignedSites:assigned.length,pending:assigned.filter(s=>!completed.has(s.unit_id)),inProgress,completedVisits:history.visits.filter(v=>v.check_out_at)};
}