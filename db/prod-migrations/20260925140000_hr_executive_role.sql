-- HR Executive: sees only the clients where they are the mapped HR executive.
INSERT INTO public.roles (key, name, description, is_system, sort_order)
VALUES ('hr_executive', 'HR Executive', 'HR executive scoped to their mapped clients; view-only employees, no compliance', true, 35)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT 'hr_executive', module_key, sub_module_key,
  CASE WHEN module_key IN ('dashboard','employees','attendance','payroll','contracts','organizations','my_attendance','notification_center','profile')
       AND NOT (module_key='organizations' AND sub_module_key IN ('branch_manager','state_manager')) THEN can_view ELSE false END,
  CASE WHEN module_key = 'profile' THEN can_edit ELSE false END,
  false, false
FROM public.role_permissions WHERE role_key = 'hr'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_user_unit_ids()
 RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, unit_id, role_key FROM public.candidates
    WHERE mobile = public.current_user_mobile()
    LIMIT 1
  ), mapped AS (
    SELECT unit_id AS id FROM me WHERE unit_id IS NOT NULL AND me.role_key IS DISTINCT FROM 'hr_executive'
    UNION
    SELECT cu.unit_id FROM public.candidate_units cu JOIN me ON cu.candidate_id = me.id WHERE cu.unit_id IS NOT NULL
    UNION
    SELECT esa.scope_id::uuid FROM public.employee_scope_assignments esa JOIN me ON esa.candidate_id = me.id
    WHERE esa.scope_type = 'unit' AND esa.scope_id ~* '^[0-9a-f-]{36}$'
    UNION
    SELECT u.id FROM public.employee_scope_assignments esa JOIN me ON esa.candidate_id = me.id
    JOIN public.units u ON u.customer_id::text = esa.scope_id
    WHERE esa.scope_type = 'customer' AND u.is_billable IS TRUE
    UNION
    SELECT u.id FROM public.units u JOIN me ON u.hr_executive_id = me.id
  )
  SELECT COALESCE(ARRAY(
    SELECT DISTINCT m.id FROM mapped m JOIN public.units u ON u.id = m.id WHERE u.is_billable IS TRUE
  ), ARRAY[]::uuid[]);
$function$;

ALTER POLICY "Employee viewers read all candidates" ON public.candidates
USING (( SELECT current_user_has_permission('employees'::text, ''::text, 'view'::text)) AND (COALESCE(( SELECT current_user_role_key()), ''::text) <> ALL (ARRAY['field_officer'::text, 'branch_manager'::text, 'hr_executive'::text])));

-- HR executives also need to see people posted to their clients via candidate_units.
CREATE POLICY "HR executives read people at their clients" ON public.candidates FOR SELECT TO authenticated
USING (( SELECT current_user_role_key()) = 'hr_executive' AND id IN (
  SELECT cu.candidate_id FROM public.candidate_units cu WHERE cu.unit_id = ANY (( SELECT current_user_unit_ids()))));

UPDATE public.candidates c SET role_key = 'hr_executive'
WHERE c.role_key = 'hr' AND EXISTS (SELECT 1 FROM public.units u WHERE u.hr_executive_id = c.id);
