-- Return an exact creator-management decision to the UI; task_action remains the enforcement point.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_own_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT (select auth.uid()) IS NOT NULL AND (select guard_absence_access_allowed()) AND coalesce((select current_user_explicit_permission('tasks','manage','edit')),true);
$$;
REVOKE ALL ON FUNCTION public.current_user_can_manage_own_tasks() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_own_tasks() TO authenticated;
NOTIFY pgrst,'reload schema';
