import { useDeferredValue, useState } from 'react';
import { Users, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDepartmentTeam } from '@/lib/department-team';
import { indiaDate } from '@/lib/work-location';
import { useCurrentPermissions } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollingText } from '@/components/ScrollingText';
import { TileNumber } from '@/components/TileNumber';

const labels = { all: 'Team members', present: 'Present today', absent: 'Absent / not marked' };
type Filter = keyof typeof labels;
const clock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—';
export function DepartmentTeamCard() {
  const { canWidget } = useCurrentPermissions(); const summary = useDepartmentTeam();
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState(''); const deferred = useDeferredValue(search); const [page, setPage] = useState(0);
  const list = useDepartmentTeam(deferred, filter, page, indiaDate(), open);
  if (!canWidget('my_team') || (!summary.error && !summary.data?.isHead)) return null;
  const totals = { all: summary.data?.total, present: summary.data?.present, absent: summary.data?.absent };
  return <section aria-label="My Team" className="my-4 min-w-0 space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-primary" />My Team</h2><span className="text-xs text-muted-foreground">{summary.data?.departments.join(', ')} · {indiaDate()}</span></header>
    {summary.error ? <p role="alert" className="text-sm text-destructive">My Team attendance could not load.</p> : <div className="grid grid-cols-3 gap-3">{(Object.keys(labels) as Filter[]).map(f => {
      const Icon = f === 'all' ? Users : f === 'present' ? UserCheck : UserX;
      return <Button key={f} variant="outline" data-panel="true" className="h-auto min-w-0 flex-col items-start gap-2 p-3 text-left sm:p-4" onClick={() => { setFilter(f); setSearch(''); setPage(0); setOpen(true); }}>
        <Icon className="h-4 w-4 text-primary" /><ScrollingText text={labels[f]} className="w-full text-xs sm:text-sm" /><TileNumber className="text-2xl font-semibold">{totals[f] ?? '…'}</TileNumber>
      </Button>;
    })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl"><DialogHeader><DialogTitle>My Team — {labels[filter]}</DialogTitle><DialogDescription>{summary.data?.departments.join(', ')} · {indiaDate()}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Filter[]).map(f => <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setPage(0); }}>{f === 'all' ? 'All' : f === 'present' ? 'Present' : 'Absent / not marked'} ({totals[f] ?? '…'})</Button>)}</div>
      <Input aria-label="Search my team" placeholder="Search employee name or EMP ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">{list.data?.rows.map(p => <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><ScrollingText text={p.full_name} className="text-sm font-medium" /><ScrollingText text={`EMP ${p.employee_code ?? 'Not recorded'} · ${p.designation ?? p.department}`} className="text-xs text-muted-foreground" /><span className="text-xs text-muted-foreground">In {clock(p.check_in_at)} · Out {clock(p.check_out_at)}</span></div><Badge variant={p.present ? 'default' : 'outline'}>{p.present ? 'Present' : 'Not marked'}</Badge></div>)}{list.isLoading && <p className="py-4 text-sm text-muted-foreground">Loading team…</p>}{list.error && <p role="alert" className="py-4 text-sm text-destructive">Could not load team members.</p>}{list.data?.filteredTotal === 0 && <p className="py-4 text-sm text-muted-foreground">No team members match this selection.</p>}</div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{list.data?.filteredTotal ?? 0} members · Page {page + 1}</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous team page" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Next team page" disabled={!list.data || (page + 1) * 25 >= list.data.filteredTotal} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </DialogContent></Dialog>
  </section>;
}