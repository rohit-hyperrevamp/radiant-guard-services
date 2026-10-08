-- One-call manager/team scope. The browser used to rebuild this with dozens of
-- chained requests (reporting tree walk + 200-id chunks over 829 team sites),
-- so scoped users waited seconds and screens showed 0 while it ran or when a
-- chunk failed silently.
CREATE OR REPLACE FUNCTION public.current_user_ops_scope()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT public.current_user_candidate_id() AS id, coalesce(public.current_user_role_key(), '') AS role_key
  ), units AS (
    SELECT unnest(public.current_user_unit_ids()) AS id
  ), has_team AS (
    SELECT EXISTS (SELECT 1 FROM public.employee_scope_assignments esa, me
                   WHERE esa.candidate_id = me.id AND esa.scope_type = 'team') AS v
  ), tree AS (
    WITH RECURSIVE t(id, depth) AS (
      SELECT id, 0 FROM me WHERE id IS NOT NULL AND (SELECT role_key FROM me) <> 'accounts'
      UNION
      SELECT x.id, t.depth + 1 FROM t
      CROSS JOIN LATERAL (
        SELECT c.id FROM public.candidates c WHERE c.reports_to = t.id
        UNION SELECT crm.candidate_id FROM public.candidate_reporting_managers crm WHERE crm.manager_id = t.id
      ) x WHERE t.depth < 8
    ) SELECT id FROM t
  ), fos AS (
    SELECT c.id FROM public.candidates c
    WHERE c.role_key = 'field_officer' AND c.status IN ('active','approved') AND c.is_enabled IS DISTINCT FROM false
      AND (c.id IN (SELECT id FROM tree WHERE id <> (SELECT id FROM me))
        OR ((SELECT v FROM has_team) AND c.id IN (SELECT cu.candidate_id FROM public.candidate_units cu WHERE cu.unit_id IN (SELECT id FROM units))))
  )
  SELECT jsonb_build_object(
    'unit_ids', coalesce((SELECT jsonb_agg(id) FROM units), '[]'::jsonb),
    'customer_ids', coalesce((SELECT jsonb_agg(DISTINCT u.customer_id) FROM public.units u WHERE u.id IN (SELECT id FROM units) AND u.customer_id IS NOT NULL), '[]'::jsonb),
    'field_officer_ids', coalesce((SELECT jsonb_agg(id) FROM fos), '[]'::jsonb),
    'has_team', (SELECT v FROM has_team)
  )
  WHERE auth.uid() IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.current_user_ops_scope() FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_ops_scope() TO authenticated;
NOTIFY pgrst, 'reload schema';
