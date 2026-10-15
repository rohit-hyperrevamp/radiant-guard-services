-- People with a secondary billable posting (e.g. a Field Officer also posted as
-- Security Guard) get the union of their main access and the access of the
-- posting's designation / the Guard role. Grants add up; nothing is removed.
CREATE OR REPLACE FUNCTION public.current_user_effective_permissions()
 RETURNS TABLE(module_key text, sub_module_key text, can_view boolean, can_edit boolean, can_delete boolean, can_approve boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT c.id, c.role_key, c.department_id, c.designation_id
    FROM auth.users u
    JOIN public.candidates c ON u.email = 'phone-' || c.mobile || '@radiantguard.local'
    WHERE u.id = auth.uid()
    LIMIT 1
  ),
  lvl AS (
    SELECT o.*, CASE
      WHEN o.scope_type = 'employee' AND o.scope_id = me.id THEN 1
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id = me.department_id THEN 2
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id IS NULL THEN 3
      WHEN o.scope_type = 'department' AND o.scope_id = me.department_id THEN 4
    END AS lv
    FROM public.access_overrides o, me
  ),
  best AS (SELECT l.module_key, min(l.lv) AS lv FROM lvl l WHERE l.lv IS NOT NULL GROUP BY l.module_key),
  main_perms AS (
    SELECT l.module_key, l.sub_module_key, l.can_view, l.can_edit, l.can_delete, l.can_approve
      FROM lvl l JOIN best b ON b.module_key = l.module_key AND b.lv = l.lv
    UNION ALL
    SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
      FROM public.role_permissions rp JOIN me ON rp.role_key = me.role_key
     WHERE NOT EXISTS (SELECT 1 FROM best b WHERE b.module_key = rp.module_key)
  ),
  -- Secondary billable postings: designations other than the main one.
  sec AS (
    SELECT DISTINCT cu.designation_id
      FROM public.candidate_units cu
      JOIN me ON me.id = cu.candidate_id
      JOIN public.designations d ON d.id = cu.designation_id AND d.billable
     WHERE NOT cu.is_reliever
       AND cu.designation_id IS DISTINCT FROM me.designation_id
  ),
  sec_override AS (
    SELECT o.* FROM public.access_overrides o JOIN sec s ON o.scope_type = 'designation' AND o.scope_id = s.designation_id AND o.department_id IS NULL
  ),
  sec_perms AS (
    SELECT o.module_key, o.sub_module_key, o.can_view, o.can_edit, o.can_delete, o.can_approve FROM sec_override o
    UNION ALL
    SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
      FROM public.role_permissions rp, me
     WHERE EXISTS (SELECT 1 FROM sec) AND me.role_key <> 'guard' AND rp.role_key = 'guard'
       AND NOT EXISTS (SELECT 1 FROM sec_override o WHERE o.module_key = rp.module_key)
  ),
  allp AS (SELECT * FROM main_perms UNION ALL SELECT * FROM sec_perms)
  SELECT module_key, sub_module_key, bool_or(can_view), bool_or(can_edit), bool_or(can_delete), bool_or(can_approve)
    FROM allp GROUP BY module_key, sub_module_key;
$function$;
