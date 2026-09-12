CREATE OR REPLACE FUNCTION public.current_user_unit_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT id, unit_id FROM public.candidates WHERE mobile = public.current_user_mobile() LIMIT 1
  )
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT u FROM (
        SELECT unit_id AS u FROM me WHERE unit_id IS NOT NULL
        UNION
        SELECT cu.unit_id FROM public.candidate_units cu JOIN me ON cu.candidate_id = me.id WHERE cu.unit_id IS NOT NULL
        UNION
        SELECT esa.scope_id::uuid
        FROM public.employee_scope_assignments esa
        JOIN me ON esa.candidate_id = me.id
        WHERE esa.scope_type = 'unit'
          AND esa.scope_id ~* '^[0-9a-f-]{36}$'
      ) s
    ),
    ARRAY[]::uuid[]
  );
$function$;