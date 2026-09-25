-- Control Center roles: head (same visibility as VP Operations, can map field
-- officers to units) and staff (view-only). Radar is their dashboard.
begin;

insert into public.roles(key,name,description,is_system,sort_order) values
 ('control_center_head','Head - Control Center','Heads the control center; sees all operations and Radar, maps field officers to units.',false,47),
 ('control_center','Control Center','Control center staff; view-only Radar and operations.',false,48)
on conflict (key) do nothing;

insert into public.role_permissions(role_key,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
select 'control_center_head', module_key, sub_module_key, can_view, can_edit, can_delete, can_approve
from public.role_permissions where role_key='vp_operations'
on conflict (role_key,module_key,sub_module_key) do nothing;

insert into public.role_permissions(role_key,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
select 'control_center', module_key, sub_module_key, can_view, false, false, false
from public.role_permissions where role_key='vp_operations'
on conflict (role_key,module_key,sub_module_key) do nothing;

insert into public.designations(name)
select 'Head - Control Center'
where not exists (select 1 from public.designations where name='Head - Control Center');

CREATE OR REPLACE FUNCTION public.current_user_has_branch_scope()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN COALESCE(public.current_user_role_key(), '') = ANY (ARRAY['admin','super_admin','hr','leadership','operations_manager','vp_operations','control_center_head','control_center'])
      THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.employee_scope_assignments esa
      JOIN public.candidates c ON c.id = esa.candidate_id
      WHERE esa.scope_type = 'branch' AND c.mobile = public.current_user_mobile()
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_can_view_self_attendance(_candidate_id uuid, _unit_id uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT
      (SELECT public.current_user_candidate_id()) AS candidate_id,
      (SELECT public.current_user_role_key()) AS role_key,
      (SELECT public.current_user_unit_ids()) AS unit_ids,
      (SELECT public.is_admin_user()) AS is_admin
  )
  SELECT EXISTS (
    SELECT 1 FROM me
    WHERE _candidate_id = me.candidate_id
      OR me.is_admin
      OR COALESCE(me.role_key, '') = ANY (ARRAY[
        'hr', 'leadership', 'admin', 'super_admin', 'branch_manager',
        'operations', 'operations_manager', 'vp_operations',
        'control_center_head', 'control_center'
      ])
      OR EXISTS (SELECT 1 FROM public.candidate_reporting_managers crm
                 WHERE crm.candidate_id = _candidate_id AND crm.manager_id = me.candidate_id)
      OR (
        COALESCE(me.role_key, '') = 'field_officer'
        AND (
          (_unit_id IS NOT NULL AND _unit_id = ANY (me.unit_ids))
          OR EXISTS (SELECT 1 FROM public.candidate_units cu
                     WHERE cu.candidate_id = _candidate_id AND cu.unit_id = ANY (me.unit_ids))
          OR EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = _candidate_id
              AND c.role_key IN ('guard', 'security_guard')
              AND (c.unit_id = ANY (me.unit_ids)
                   OR EXISTS (SELECT 1 FROM public.candidate_reporting_managers crm
                              WHERE crm.candidate_id = c.id AND crm.manager_id = me.candidate_id))
          )
        )
      )
  );
$function$;

ALTER POLICY "Scoped read units" ON public.units
USING (((COALESCE(( SELECT current_user_role_key()), ''::text) = 'hr_executive'::text) AND (id IN ( SELECT unnest(( SELECT current_user_unit_ids()))))) OR ((COALESCE(( SELECT current_user_role_key()), ''::text) <> 'hr_executive'::text) AND (( SELECT is_admin_user()) OR ( SELECT current_user_is_inventory_manager()) OR (COALESCE(( SELECT current_user_role_key()), ''::text) = ANY (ARRAY['hr','leadership','operations_manager','vp_operations','control_center_head','control_center'])) OR (id IN ( SELECT unnest(( SELECT current_user_unit_ids())))) OR (NOT ( SELECT current_user_has_branch_scope())) OR (branch_id IS NULL) OR ((branch_id)::text IN ( SELECT current_user_branch_scope_ids())))));

ALTER POLICY "Field sense viewers read operations people" ON public.candidates
USING ((status = ANY (ARRAY['approved','active'])) AND (role_key = ANY (ARRAY['field_officer','operations','operations_manager','vp_operations','branch_manager','control_center_head','control_center'])) AND ( SELECT current_user_has_permission('field_sense'::text, ''::text, 'view'::text)));

ALTER POLICY "Radar managers update all visits" ON public.field_visits
USING (is_admin_user() OR (( SELECT current_user_role_key()) = ANY (ARRAY['hr','leadership','operations_manager','vp_operations','control_center_head'])));

-- Shiv Shankar Kumar (49381): Head of Control Center, reports to Col. Umed Singh (31993).
update public.candidates set
  role_key = 'control_center_head',
  department_id = 'c11178d5-df3c-4a76-a65c-d752da2a9204',
  designation_id = (select id from public.designations where name='Head - Control Center' limit 1),
  reports_to = 'cbfd83bd-9bbd-4f29-8f22-6b0f78ba3156',
  unit_id = coalesce(unit_id, '92541381-14d3-4be6-ae8c-078b79c2e0f1')
where employee_code = '49381';

insert into public.candidate_reporting_managers(candidate_id, manager_id, is_primary)
select id, 'cbfd83bd-9bbd-4f29-8f22-6b0f78ba3156', true from public.candidates where employee_code='49381'
on conflict do nothing;

commit;
