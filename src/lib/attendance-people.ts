import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useCurrentUserRole } from '@/lib/use-current-user-role';
import { useCurrentPermissions } from '@/lib/rbac';
export type AttendancePerson = { id:string; full_name:string; employee_code:string|null; department:string|null; designation:string|null; check_in_unit:string|null; check_in_at:string|null; check_out_at:string|null; check_in_lat:number|null; check_in_lng:number|null; check_in_accuracy:number|null; check_in_place:string|null; present_today:boolean };
export type AttendancePeople = { total:number; present:number; checkedIn:number; onDuty:number; filteredTotal:number; rows:AttendancePerson[] };
export { checkInMapUrl } from './attendance-people-utils';
export function useAttendancePeople(search='',filter='all',page=0) {
 const session=useHasSupabaseSession(); const {candidateId}=useCurrentUserRole(); const {can,canWidget,isSuperAdmin}=useCurrentPermissions();
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return useQuery({queryKey:['dashboard-attendance-people',candidateId,date,search,filter,page],enabled:session&&(isSuperAdmin||can('dashboard'))&&canWidget('attendance_today'),staleTime:30_000,refetchInterval:60_000,queryFn:async()=>{
 const {data,error}=await supabase.rpc('dashboard_attendance_people' as never,{_date:date,_search:search,_filter:filter,_page:page} as never); if(error) throw error; return data as unknown as AttendancePeople;
 }});
}
