-- 'team' scope: scope_id = manager candidate id. Holder sees every billable unit
-- handled (account / operations / HR manager) by that manager or anyone reporting to them.
ALTER TABLE public.employee_scope_assignments DROP CONSTRAINT employee_scope_assignments_scope_type_check;
ALTER TABLE public.employee_scope_assignments ADD CONSTRAINT employee_scope_assignments_scope_type_check
  CHECK (scope_type = ANY (ARRAY['state','customer','branch','unit','team']));

CREATE OR REPLACE FUNCTION public.team_unit_ids(_manager_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH team AS (
    SELECT _manager_id AS id
    UNION SELECT c.id FROM public.candidates c WHERE c.reports_to = _manager_id AND c.status IN ('active','approved')
    UNION SELECT crm.candidate_id FROM public.candidate_reporting_managers crm WHERE crm.manager_id = _manager_id
  )
  SELECT u.id FROM public.units u
  WHERE u.is_billable IS TRUE AND (
    u.account_manager_id IN (SELECT id FROM team) OR u.operations_manager_id IN (SELECT id FROM team)
    OR u.hr_executive_id IN (SELECT id FROM team)
    OR u.id IN (SELECT cu.unit_id FROM public.candidate_units cu WHERE cu.candidate_id IN (SELECT id FROM team)));
$$;
GRANT EXECUTE ON FUNCTION public.team_unit_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_unit_ids()
 RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, unit_id, role_key FROM public.candidates
    WHERE mobile = public.current_user_mobile() LIMIT 1
  ), mapped AS (
    SELECT unit_id AS id FROM me WHERE unit_id IS NOT NULL AND me.role_key IS DISTINCT FROM 'hr_executive' AND me.role_key IS DISTINCT FROM 'accounts'
    UNION SELECT cu.unit_id FROM public.candidate_units cu JOIN me ON cu.candidate_id = me.id WHERE cu.unit_id IS NOT NULL
    UNION SELECT esa.scope_id::uuid FROM public.employee_scope_assignments esa JOIN me ON esa.candidate_id = me.id
      WHERE esa.scope_type = 'unit' AND esa.scope_id ~* '^[0-9a-f-]{36}$'
    UNION SELECT u.id FROM public.employee_scope_assignments esa JOIN me ON esa.candidate_id = me.id
      JOIN public.units u ON u.customer_id::text = esa.scope_id WHERE esa.scope_type = 'customer' AND u.is_billable IS TRUE
    UNION SELECT t FROM public.employee_scope_assignments esa JOIN me ON esa.candidate_id = me.id
      CROSS JOIN LATERAL public.team_unit_ids(esa.scope_id::uuid) t
      WHERE esa.scope_type = 'team' AND esa.scope_id ~* '^[0-9a-f-]{36}$'
    UNION SELECT u.id FROM public.units u JOIN me ON u.hr_executive_id = me.id
    UNION SELECT u.id FROM public.units u JOIN me ON u.account_manager_id = me.id
  )
  SELECT COALESCE(ARRAY(SELECT DISTINCT m.id FROM mapped m JOIN public.units u ON u.id = m.id WHERE u.is_billable IS TRUE), ARRAY[]::uuid[]);
$function$;

-- Pandurang Patil's operations team: Pandurang + Rani Kumari, Ankita Sannake, Parmeshwar Padole, Akshay Subhash Mane
DELETE FROM public.employee_scope_assignments
 WHERE scope_type = 'branch' AND candidate_id IN ('bcb812f8-5c89-46c5-821e-91a55871476c','dd627ef0-d2e6-46bb-9411-53050e1bc7fe','fb3bf584-f976-46d1-a139-c65088963c1c');
INSERT INTO public.employee_scope_assignments (candidate_id, scope_type, scope_id, scope_label)
SELECT x::uuid, 'team', 'bcb812f8-5c89-46c5-821e-91a55871476c', 'Pandurang Patil team'
FROM unnest(ARRAY['bcb812f8-5c89-46c5-821e-91a55871476c','dd627ef0-d2e6-46bb-9411-53050e1bc7fe','9a5f388b-1e91-4dd3-abf4-e4109233f8bc','fb3bf584-f976-46d1-a139-c65088963c1c','0783607b-8766-4d66-8681-8a2e64f75aa6']) x
ON CONFLICT DO NOTHING;
