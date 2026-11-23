import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentUserRole } from '@/lib/use-current-user-role';
import { FieldOfficerFieldSense } from '@/components/FieldOfficerFieldSense';
import { WorkTeamMap } from '@/components/WorkTeamMap';
import { RadarVisitHistory } from '@/components/RadarVisitHistory';
import { AdminFieldOfficerUnitsCard } from '@/components/AdminFieldOfficerUnitsCard';
import { AdminEscalationRequestsCard } from '@/components/AdminEscalationRequestsCard';
import { FieldSenseLeaderboards } from '@/components/FieldSenseLeaderboards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export const Route = createFileRoute('/admin/field-sense/')({
  component: FieldSensePage,
  validateSearch: (search: Record<string, unknown>): {range?:string;start?:string;end?:string;highlight?:string;action?:string} => ({
    range: typeof search['range']==='string'?search['range']:undefined,
    start: typeof search['start']==='string'?search['start']:undefined,
    end: typeof search['end']==='string'?search['end']:undefined,
    highlight: typeof search['highlight']==='string'?search['highlight']:undefined,
    action: typeof search['action']==='string'?search['action']:undefined,
  }),
  head:()=>({meta:[
    {title:'Radar — Work locations & visit history | Radiant'},
    {name:'description',content:'Field Officer and Security Guard attendance locations, daily site coverage and saved visit forms.'},
    {property:'og:title',content:'Radar — Work locations & visit history | Radiant'},
    {property:'og:description',content:'Review field team work locations, assigned site coverage and archived visit forms with evidence.'},
    {property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},
  ]}),
});
function FieldSensePage(){
  const {isFieldOfficer,candidateId,isLoading}=useCurrentUserRole();
  if(isLoading)return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if(isFieldOfficer&&candidateId)return <div className="space-y-4"><PageHeader title="Site Visits" crumbs={[{label:'Admin',to:'/admin/field-dashboard'},{label:'Site Visits'}]} /><FieldOfficerFieldSense candidateId={candidateId}/></div>;
  return <div className="min-w-0 space-y-4"><PageHeader title="Radar" crumbs={[{label:'Admin',to:'/admin/dashboard'},{label:'Radar'}]} /><WorkTeamMap /><Tabs defaultValue="visits"><TabsList className="flex h-auto flex-wrap justify-start gap-2"><TabsTrigger value="visits">Visit forms</TabsTrigger><TabsTrigger value="assignments">Site assignments</TabsTrigger><TabsTrigger value="requests">Requests</TabsTrigger><TabsTrigger value="rankings">Rankings</TabsTrigger></TabsList><TabsContent value="visits"><RadarVisitHistory /></TabsContent><TabsContent value="assignments"><AdminFieldOfficerUnitsCard /></TabsContent><TabsContent value="requests"><AdminEscalationRequestsCard /></TabsContent><TabsContent value="rankings"><FieldSenseLeaderboards /></TabsContent></Tabs></div>;
}
