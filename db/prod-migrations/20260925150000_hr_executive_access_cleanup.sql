-- Restrict HR Executives to mapped clients and read-only operational records.
UPDATE public.role_permissions
SET can_view = false, can_edit = false, can_delete = false, can_approve = false
WHERE role_key = 'hr_executive'
  AND (module_key = 'compliance'
    OR (module_key = 'organizations' AND sub_module_key <> 'unit_manager'));

UPDATE public.role_permissions
SET can_view = true, can_edit = true, can_delete = false, can_approve = false
WHERE role_key = 'hr_executive' AND module_key = 'organizations' AND sub_module_key = 'unit_manager';

CREATE OR REPLACE FUNCTION public.contract_register_directory()
RETURNS TABLE(unit_id uuid, unit_code text, unit_name text, customer_id uuid, customer_name text, unit_state text, unit_city text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT u.id, u.code, u.name, u.customer_id, coalesce(c.name, '—'),
    coalesce(u.billing_state, ''), coalesce(u.billing_city, '')
  FROM public.client_contracts cc
  JOIN public.units u ON u.id = cc.unit_id
  LEFT JOIN public.customers c ON c.id = u.customer_id
  WHERE auth.uid() IS NOT NULL
    AND (public.is_admin_user() OR public.current_user_has_permission('contracts', '', 'view'))
    AND (coalesce(public.current_user_role_key(), '') <> 'hr_executive'
      OR u.id IN (SELECT unnest(public.current_user_unit_ids())));
$function$;

-- The charter RPC must enforce mapped-unit scope itself; client-side filtering
-- is a second layer and not an authorization boundary.
CREATE OR REPLACE FUNCTION public.get_attendance_charter_units()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _role text := public.current_user_role_key();
  _cand uuid := public.current_user_candidate_id();
  _scoped boolean := coalesce(_role,'') IN ('field_officer','hr_executive');
  _payload jsonb;
BEGIN
  WITH nb AS (
    SELECT unnest(ARRAY['field_officer','branch_manager','hr','hr_executive','leadership','transport','inventory',
      'admin','super_admin','user','accounts','operations','operations_manager','area_manager','regional_manager']) AS k
  ), cand AS (
    SELECT c.id,c.full_name,c.designation_id,c.role_key,c.unit_id FROM candidates c
    WHERE c.is_enabled AND c.status='active' AND coalesce(c.non_billable,false)=false
      AND lower(coalesce(c.role_key,'')) NOT IN (SELECT k FROM nb)
  ), contracts AS (
    SELECT unit_id,array_remove(array_agg(contract_code ORDER BY contract_code),NULL) codes,max(end_date) contract_end
    FROM client_contracts WHERE status='active' AND unit_id IS NOT NULL GROUP BY unit_id
  ), allowed_units AS (
    SELECT unit_id FROM field_officer_scope WHERE _role='field_officer' AND candidate_id=_cand
    UNION SELECT id FROM units WHERE _role='hr_executive' AND hr_executive_id=_cand
  ), links AS (
    SELECT cu.unit_id,c.id,c.full_name,c.designation_id FROM candidate_units cu JOIN cand c ON c.id=cu.candidate_id
    UNION SELECT c.unit_id,c.id,c.full_name,c.designation_id FROM cand c WHERE c.unit_id IS NOT NULL
    UNION SELECT u.id,c.id,c.full_name,c.designation_id FROM employee_scope_assignments a JOIN cand c ON c.id=a.candidate_id
      JOIN units u ON ((a.scope_type='unit' AND u.id::text=a.scope_id) OR (a.scope_type='branch' AND u.branch_id::text=a.scope_id)
        OR (a.scope_type='customer' AND u.customer_id::text=a.scope_id) OR (a.scope_type='state' AND u.billing_state=a.scope_id))
  ), unit_ids AS (SELECT unit_id FROM contracts UNION SELECT unit_id FROM links WHERE unit_id IS NOT NULL),
  rows AS (
    SELECT u.id,u.code,u.name,coalesce(u.location,'') location,u.branch_id,coalesce(u.customer_id::text,'') customer_id,
      coalesce(cst.name,'—') customer_name,coalesce(cst.code,'') customer_code,u.billing_state,u.billing_city,
      coalesce(ct.codes,ARRAY[]::text[]) contract_codes,ct.contract_end,coalesce(g.guards,'[]'::jsonb) security_guards,
      coalesce(g.cnt,0) active_employee_count
    FROM units u JOIN unit_ids ui ON ui.unit_id=u.id LEFT JOIN customers cst ON cst.id=u.customer_id LEFT JOIN contracts ct ON ct.unit_id=u.id
    LEFT JOIN (SELECT l.unit_id,jsonb_agg(jsonb_build_object('id',l.id,'name',coalesce(nullif(l.full_name,''),'—')) ORDER BY l.full_name) guards,count(*) cnt
      FROM (SELECT DISTINCT unit_id,id,full_name FROM links WHERE unit_id IS NOT NULL) l GROUP BY l.unit_id) g ON g.unit_id=u.id
    WHERE (NOT _scoped) OR u.id IN (SELECT unit_id FROM allowed_units)
  )
  SELECT jsonb_build_object('units',coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.customer_name,coalesce(nullif(r.name,''),r.code)),'[]'::jsonb))
  INTO _payload FROM rows r;
  RETURN _payload;
END
$function$;

ALTER POLICY "Scoped read units" ON public.units USING (
  (coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR
  (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND ((SELECT public.is_admin_user()) OR (SELECT public.current_user_is_inventory_manager())
    OR coalesce((SELECT public.current_user_role_key()),'')=ANY(ARRAY['hr','leadership','operations_manager','vp_operations'])
    OR id IN (SELECT unnest((SELECT public.current_user_unit_ids()))) OR NOT (SELECT public.current_user_has_branch_scope())
    OR branch_id IS NULL OR branch_id::text IN (SELECT public.current_user_branch_scope_ids())))
);
ALTER POLICY "Authenticated update units" ON public.units
  USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' OR id IN (SELECT unnest((SELECT public.current_user_unit_ids()))))
  WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' OR id IN (SELECT unnest((SELECT public.current_user_unit_ids()))));
ALTER POLICY "Authenticated write units" ON public.units WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated delete units" ON public.units USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');

ALTER POLICY "Authenticated write client_contracts" ON public.client_contracts WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated update client_contracts" ON public.client_contracts USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive') WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated delete client_contracts" ON public.client_contracts USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated read contract_resources" ON public.contract_resources USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' OR contract_id IN (SELECT id FROM public.client_contracts));
ALTER POLICY "Authenticated write contract_resources" ON public.contract_resources WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated update contract_resources" ON public.contract_resources USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive') WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated delete contract_resources" ON public.contract_resources USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');

ALTER POLICY "Scoped read attendance_sheets" ON public.attendance_sheets USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND ((SELECT public.is_admin_user()) OR NOT (SELECT public.current_user_has_branch_scope()) OR public.is_unit_in_current_user_branch(unit_id))));
ALTER POLICY "Authenticated write attendance_sheets" ON public.attendance_sheets WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated update attendance_sheets" ON public.attendance_sheets USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive') WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated delete attendance_sheets" ON public.attendance_sheets USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');

ALTER POLICY "Scoped read attendance_entries" ON public.attendance_entries USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id))));
ALTER POLICY "Scoped insert attendance_entries" ON public.attendance_entries WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id)));
ALTER POLICY "Scoped update attendance_entries" ON public.attendance_entries USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id))) WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id)));
ALTER POLICY "Scoped delete attendance_entries" ON public.attendance_entries USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id)));

ALTER POLICY "Scoped read payroll_runs" ON public.payroll_runs USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND ((SELECT public.is_admin_user()) OR NOT (SELECT public.current_user_has_branch_scope()) OR public.is_unit_in_current_user_branch(unit_id))));
ALTER POLICY "Scoped read payroll_run_snapshots" ON public.payroll_run_snapshots USING ((coalesce((SELECT public.current_user_role_key()),'')='hr_executive' AND unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids())))) OR (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive' AND (public.is_admin_user() OR NOT public.current_user_has_branch_scope() OR public.is_unit_in_current_user_branch(unit_id))));
ALTER POLICY "Authenticated write payroll_run_snapshots" ON public.payroll_run_snapshots WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated update payroll_run_snapshots" ON public.payroll_run_snapshots USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive') WITH CHECK (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
ALTER POLICY "Authenticated delete payroll_run_snapshots" ON public.payroll_run_snapshots USING (coalesce((SELECT public.current_user_role_key()),'')<>'hr_executive');
