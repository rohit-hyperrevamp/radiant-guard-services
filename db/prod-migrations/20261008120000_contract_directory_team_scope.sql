-- People with a "team" (manager's team) scope see only contracts of their team's sites.
CREATE OR REPLACE FUNCTION public.contract_register_directory()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT (auth.uid() IS NOT NULL) AS signed_in,
           (public.is_admin_user() OR public.current_user_has_permission('contracts', '', 'view')) AS can_view,
           coalesce(public.current_user_role_key(), '') = 'hr_executive' AS hr_exec,
           (NOT public.is_admin_user() AND EXISTS (
              SELECT 1 FROM public.employee_scope_assignments esa
              WHERE esa.candidate_id = public.current_user_candidate_id() AND esa.scope_type = 'team')) AS team_only
  ), my_units AS (
    SELECT unnest(public.current_user_unit_ids()) AS id WHERE (SELECT hr_exec OR team_only FROM me)
  )
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.unit_code), '[]'::jsonb)
  FROM (
    SELECT DISTINCT u.id AS unit_id, u.code AS unit_code, u.name AS unit_name,
      u.customer_id, coalesce(c.name, '—') AS customer_name,
      coalesce(nullif(u.client_state,''), u.billing_state, '') AS unit_state,
      coalesce(nullif(u.client_city,''), u.billing_city, '') AS unit_city
    FROM public.client_contracts cc
    JOIN public.units u ON u.id = cc.unit_id
    LEFT JOIN public.customers c ON c.id = u.customer_id
    CROSS JOIN me
    WHERE me.signed_in AND me.can_view
      AND (NOT (me.hr_exec OR me.team_only) OR u.id IN (SELECT id FROM my_units))
  ) d;
$function$;
