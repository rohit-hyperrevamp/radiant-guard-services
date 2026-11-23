import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { matchesSearch } from '@/lib/search-match';
import { selectAllMatching } from '@/lib/task-workflow';
type Option = { id: string; name: string };
function Selection({ options, value, onChange, label, loading = false }: { options: Option[]; value: string[]; onChange: (ids: string[]) => void; label: string; loading?: boolean }) {
  const [search, setSearch] = useState(''); const deferred = useDeferredValue(search);
  const [limit, setLimit] = useState(80);
  const filtered = useMemo(() => options.filter(o => matchesSearch(deferred, [o.name])), [options, deferred]);
  const selected = new Set(value);
  return <div className="space-y-2"><div className="text-xs text-muted-foreground">{label}</div><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-between" disabled={loading}>{loading ? 'Loading…' : `${value.length} selected`}<ChevronDown className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-[min(28rem,calc(100vw-2rem))] space-y-3" align="start">
    <Input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e => { setSearch(e.target.value); setLimit(80); }} />
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{filtered.length} matching · {value.length} selected</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!filtered.length} onClick={() => onChange(selectAllMatching(value, filtered.map(o => o.id)))}>Select all</Button><Button size="sm" variant="ghost" onClick={() => onChange([])}>Clear</Button></div></div>
    <div className="max-h-64 space-y-1 overflow-y-auto">{filtered.slice(0, limit).map(o => <label key={o.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"><Checkbox checked={selected.has(o.id)} onCheckedChange={checked => onChange(checked ? [...value, o.id] : value.filter(id => id !== o.id))} /><span className="min-w-0 break-words text-sm">{o.name}</span></label>)}{!filtered.length && <p className="p-3 text-sm text-muted-foreground">No matches</p>}{filtered.length > limit && <Button variant="ghost" className="w-full" onClick={() => setLimit(limit + 80)}>Show more</Button>}</div>
  </PopoverContent></Popover></div>;
}
export function TaskRecipients({ departments, departmentIds, onDepartmentsChange, employeeIds, onEmployeesChange }: { departments: Option[]; departmentIds: string[]; onDepartmentsChange: (ids: string[]) => void; employeeIds: string[]; onEmployeesChange: (ids: string[]) => void }) {
  const key = [...departmentIds].sort().join(',');
  const q = useQuery({ queryKey: ['task-recipient-directory', key], staleTime: 60_000, queryFn: async () => {
    const result: { id: string; full_name: string; employee_code: string | null; department_id: string | null }[] = [];
    for (let page = 0; ; page++) { const { data, error } = await supabase.rpc('task_recipient_directory' as never, { _departments: departmentIds, _page: page } as never); if (error) throw error; const batch = (data ?? []) as unknown as typeof result; result.push(...batch); if (batch.length < 500) break; }
    return result;
  }});
  const options = useMemo(() => (q.data ?? []).map(p => ({ id: p.id, name: `${p.full_name} · ${p.employee_code ?? 'No ID'}` })), [q.data]);
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Selection label="Departments" options={departments} value={departmentIds} onChange={ids => { onDepartmentsChange(ids); onEmployeesChange([]); }} /><Selection label="Employees" options={options} value={employeeIds} onChange={onEmployeesChange} loading={q.isFetching} /></div>{q.error && <p className="text-sm text-destructive">Could not load employees: {q.error.message}</p>}<div className="text-sm text-muted-foreground">{departmentIds.length || 'All'} departments · {employeeIds.length} recipients</div></div>;
}