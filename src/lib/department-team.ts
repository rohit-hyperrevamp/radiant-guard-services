import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHasSupabaseSession } from '@/lib/supabase-ready';
import { useAuth } from '@/lib/auth';
import { useCurrentPermissions } from '@/lib/rbac';
import { indiaDate } from '@/lib/work-location';

export type DepartmentTeammate = { id: string; full_name: string; employee_code: string | null; department: string; designation: string | null; present: boolean; check_in_at: string | null; check_out_at: string | null };
export type DepartmentTeam = { isHead: boolean; departments: string[]; total: number; present: number; absent: number; filteredTotal: number; rows: DepartmentTeammate[] };
export function useDepartmentTeam(search = '', filter = 'all', page = 0, date = indiaDate(), enabled = true) {
  const ready = useHasSupabaseSession(); const { user } = useAuth(); const { canWidget, isLoading } = useCurrentPermissions();
  return useQuery({
    queryKey: ['department-team', user?.phone, date, search, filter, page], enabled: enabled && ready && !isLoading && canWidget('my_team'),
    staleTime: 30_000, refetchInterval: date === indiaDate() ? 60_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_department_team' as never, { _date: date, _search: search, _filter: filter, _page: page } as never);
      if (error) throw error;
      return data as unknown as DepartmentTeam;
    },
  });
}