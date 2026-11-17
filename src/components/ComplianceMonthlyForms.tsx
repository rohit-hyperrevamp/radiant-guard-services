import { useQuery } from '@tanstack/react-query';
import { complianceMonthQuery, complianceDirectory } from '@/lib/compliance-month';
import { monthlyStatutoryRows } from '@/lib/compliance-autofill';
import { useCurrentPermissions } from '@/lib/rbac';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { Button } from '@/components/ui/button';
import { complianceMoney } from '@/lib/statutory-heads';

export function ComplianceMonthlyForms({month,onEmployee}:{month:string;onEmployee:(id:string)=>void}) {
  const permissions=useCurrentPermissions();const session=useHasSupabaseSession();
  const allowed=session&&!permissions.isLoading&&permissions.can('compliance','view')&&permissions.can('employees','view');
  const ledger=useQuery({...complianceMonthQuery(month,'posted'),enabled:allowed});
  const directory=useQuery({queryKey:['compliance-form-month-directory',month],enabled:allowed&&!!ledger.data,queryFn:()=>complianceDirectory([...(ledger.data?.deds??[]),...(ledger.data?.contribs??[])])});
  if(!allowed)return null;
  const rows=monthlyStatutoryRows(ledger.data?.deds??[],ledger.data?.contribs??[]);
  return <section className="space-y-3"><h3 className="text-sm font-semibold">Posted statutory records · {month}</h3>
    {(ledger.isFetching||directory.isFetching)&&<p role="status" className="text-sm text-muted-foreground">Loading monthly records…</p>}
    {(ledger.isError||directory.isError)&&<p role="alert" className="text-sm text-destructive">Monthly records could not be loaded.</p>}
    {!ledger.isFetching&&!ledger.isError&&!rows.length&&<p className="text-sm text-muted-foreground">No posted statutory records for this month.</p>}
    {!!rows.length&&<div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Employee</th><th className="p-2">ESIC employee</th><th className="p-2">ESIC employer</th><th className="p-2">PF employee</th><th className="p-2">PF employer</th><th className="p-2">PT</th></tr></thead><tbody>{rows.map(r=><tr key={r.candidateId} className="border-t border-border"><td className="p-2"><Button variant="link" disabled={!directory.data?.people.has(r.candidateId)} onClick={()=>onEmployee(r.candidateId)}>{directory.data?.people.get(r.candidateId)?.employee_code} · {directory.data?.people.get(r.candidateId)?.full_name??'Loading employee…'}</Button></td>{[r.employeeEsic,r.employerEsic,r.employeePf,r.employerPf,r.pt].map((v,i)=><td key={i} className="p-2 whitespace-nowrap">{complianceMoney(v)}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}