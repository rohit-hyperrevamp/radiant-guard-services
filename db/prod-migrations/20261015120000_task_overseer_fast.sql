CREATE OR REPLACE FUNCTION public.current_user_is_task_overseer()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_user() OR COALESCE(public.current_user_role_key(),'') IN ('super_admin','admin')
    OR COALESCE(public.current_user_explicit_permission('tasks','view_all','view'), EXISTS (
    SELECT 1 FROM public.candidates c LEFT JOIN public.departments d ON d.id = c.department_id
    WHERE c.mobile = (SELECT public.current_user_mobile())
      AND (c.role_key IN ('leadership','super_admin','admin') OR d.name = 'Leadership')));
$function$;
