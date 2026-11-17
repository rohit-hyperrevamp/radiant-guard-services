import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmployeePicker } from '@/components/EmployeePicker';
import { MonthYearPicker } from '@/components/MonthYearPicker';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages } from '@/lib/supabase-batch';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useCurrentPermissions } from '@/lib/rbac';
import { matchesSearch } from '@/lib/search-match';

export type FormClient = { id: string; name: string; code: string; shipping_address1?: string | null; shipping_address2?: string | null };
export function ComplianceFormControls({ employee, onEmployee, month, onMonth, client, onClient }: {
  employee: string; onEmployee: (id: string) => void; month: string; onMonth: (month: string) => void;
  client: FormClient | null; onClient: (client: FormClient | null) => void;
}) {
  const session = useHasSupabaseSession();
  const permissions = useCurrentPermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const words = useDeferredValue(search);
  const allowed = session && permissions.can('organizations', 'view');
  const units = useQuery({
    queryKey: ['compliance-form-active-clients'], enabled: allowed && open,
    queryFn: () => fetchAllPages<FormClient>((a,b) => supabase.from('units').select('id,name,code,shipping_address1,shipping_address2').eq('status','active').order('id').range(a,b)),
    staleTime: 60_000,
  });
  const rows = (units.data ?? []).filter(u => matchesSearch(words,[u.name,u.code]));
  return <div className="grid shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
    <div className="min-w-0 space-y-2"><Label>Employee</Label><EmployeePicker value={employee} onChange={onEmployee}/></div>
    <div className="min-w-0 space-y-2"><Label>Client / site</Label><Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" disabled={!allowed} className="h-10 w-full justify-between font-normal"><span className="truncate">{client ? `${client.code} · ${client.name}` : 'Select client / site'}</span><ChevronDown className="ml-2 h-4 w-4 shrink-0"/></Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-2"><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client name or ID"/><div className="mt-2 max-h-64 overflow-y-auto"><Button variant="ghost" className="w-full justify-start" onClick={()=>{onClient(null);setOpen(false);}}>All sites</Button>{units.isFetching&&<p role="status" className="p-2 text-sm text-muted-foreground">Loading clients…</p>}{units.isError&&<p role="alert" className="p-2 text-sm text-destructive">Clients could not be loaded.</p>}{rows.map(u=><Button key={u.id} variant="ghost" className="h-auto w-full justify-start gap-2 whitespace-normal text-left" onClick={()=>{onClient(u);setOpen(false);}}>{client?.id===u.id&&<Check className="h-4 w-4 shrink-0"/>}{u.code} · {u.name}</Button>)}</div></PopoverContent>
    </Popover></div>
    <div className="min-w-0 space-y-2"><Label>Month</Label><MonthYearPicker value={month} onChange={onMonth} className="flex w-full max-w-full sm:w-auto [&_[role=combobox]]:min-w-[90px]"/></div>
  </div>;
}