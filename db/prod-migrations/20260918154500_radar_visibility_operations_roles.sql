-- Radar / live field-officer visibility.
--
-- Operations roles (operations, operations_manager, vp_operations) own the
-- Radar screen but were missing from the self-attendance read rule, so the
-- live map returned zero rows for them even while officers were checked in.
-- Also allow any recorded reporting manager of the person to see their punch.

CREATE OR REPLACE FUNCTION public.current_user_can_view_self_attendance(_candidate_id uuid, _unit_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT
      (SELECT public.current_user_candidate_id()) AS candidate_id,
      (SELECT public.current_user_role_key()) AS role_key,
      (SELECT public.current_user_unit_ids()) AS unit_ids,
      (SELECT public.is_admin_user()) AS is_admin
  )
  SELECT EXISTS (
    SELECT 1
    FROM me
    WHERE
      _candidate_id = me.candidate_id
      OR me.is_admin
      OR COALESCE(me.role_key, '') = ANY (ARRAY[
        'hr', 'leadership', 'admin', 'super_admin', 'branch_manager',
        'operations', 'operations_manager', 'vp_operations'
      ])
      OR EXISTS (
        SELECT 1
        FROM public.candidate_reporting_managers crm
        WHERE crm.candidate_id = _candidate_id
          AND crm.manager_id = me.candidate_id
      )
      OR (
        COALESCE(me.role_key, '') = 'field_officer'
        AND (
          (_unit_id IS NOT NULL AND _unit_id = ANY (me.unit_ids))
          OR EXISTS (
            SELECT 1
            FROM public.candidate_units cu
            WHERE cu.candidate_id = _candidate_id
              AND cu.unit_id = ANY (me.unit_ids)
          )
          OR EXISTS (
            SELECT 1
            FROM public.candidates c
            WHERE c.id = _candidate_id
              AND c.role_key IN ('guard', 'security_guard')
              AND (
                c.unit_id = ANY (me.unit_ids)
                OR EXISTS (
                  SELECT 1
                  FROM public.candidate_reporting_managers crm
                  WHERE crm.candidate_id = c.id
                    AND crm.manager_id = me.candidate_id
                )
              )
          )
        )
      )
  );
$function$;
