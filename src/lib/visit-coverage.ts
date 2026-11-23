import type { FieldVisit } from './field-visits';
import { matchesSearch } from './search-match';
export type AssignedVisitSite = {unit_id:string;unit_name:string;unit_code:string|null;customer_name:string|null};
export type DetailedVisit = FieldVisit & {unit_name:string;unit_code:string|null;customer_name:string|null};
export type VisitHistory = {rosterSource:'saved'|'current';assigned:AssignedVisitSite[];visits:DetailedVisit[]};
export function visitCoverage(history: VisitHistory) {
 const completed=new Set(history.visits.filter(v=>v.check_out_at).map(v=>v.unit_id));
 const inProgress=new Set(history.visits.filter(v=>!v.check_out_at).map(v=>v.unit_id));
 const assigned=[...new Map(history.assigned.map(s=>[s.unit_id,s])).values()];
 return {completedSites:completed.size,assignedSites:assigned.length,pending:assigned.filter(s=>!completed.has(s.unit_id)),inProgress,completedVisits:history.visits.filter(v=>v.check_out_at)};
}
export function visitHistorySelection(history: VisitHistory, tab: string, search: string) {
 const coverage = visitCoverage(history);
 const sites = coverage.pending.filter(s => matchesSearch(search, [s.customer_name, s.unit_name, s.unit_code]));
 const visits = (tab === 'all' ? history.visits : coverage.completedVisits).filter(v => matchesSearch(search, [v.customer_name, v.unit_name, v.unit_code, v.client_name]));
 return { sites, visits, total: tab === 'pending' ? sites.length : visits.length };
}