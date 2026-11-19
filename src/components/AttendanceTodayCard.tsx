import { Link } from '@tanstack/react-router';
import { useAttendancePeople } from '@/lib/attendance-people';
import { useCurrentPermissions } from '@/lib/rbac';
export function AttendanceTodayCard(){
 const {canWidget}=useCurrentPermissions(); const q=useAttendancePeople(); if(!canWidget('attendance_today')) return null;
 const number=(n:number|undefined)=>q.error?'—':n===undefined?'…':n;
 return <section aria-label="Today's attendance" className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
 ['Present today',q.data?.present,'present'],['Checked in today',q.data?.checkedIn,'checked_in'],['On duty',q.data?.onDuty,'on_duty'],['Not marked present',q.data? q.data.total-q.data.present:undefined,'not_present']
 ].map(([label,value,filter])=><Link key={String(filter)} to="/admin/live-staff" search={{status:String(filter)}} className="min-w-0 rounded-lg border border-border bg-card p-4 hover:bg-muted"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold text-foreground">{number(value as number|undefined)}</div></Link>)}</section>;
}
