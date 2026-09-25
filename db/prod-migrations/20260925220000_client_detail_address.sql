-- Client Detail address (site location), separate from billing address.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS client_state text,
  ADD COLUMN IF NOT EXISTS client_city text,
  ADD COLUMN IF NOT EXISTS client_pincode text;

-- One-time backfill from billing address.
UPDATE public.units SET
  client_address = coalesce(nullif(client_address,''), nullif(trim(concat_ws(', ', nullif(trim(billing_address1),''), nullif(trim(billing_address2),''))),'')),
  client_state   = coalesce(nullif(client_state,''), billing_state),
  client_city    = coalesce(nullif(client_city,''), billing_city),
  client_pincode = coalesce(nullif(client_pincode,''), billing_pincode);

CREATE OR REPLACE FUNCTION public.contract_register_directory()
 RETURNS TABLE(unit_id uuid, unit_code text, unit_name text, customer_id uuid, customer_name text, unit_state text, unit_city text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT u.id, u.code, u.name, u.customer_id, coalesce(c.name, '—'),
    coalesce(nullif(u.client_state,''), u.billing_state, ''), coalesce(nullif(u.client_city,''), u.billing_city, '')
  FROM public.client_contracts cc
  JOIN public.units u ON u.id = cc.unit_id
  LEFT JOIN public.customers c ON c.id = u.customer_id
  WHERE auth.uid() IS NOT NULL
    AND (public.is_admin_user() OR public.current_user_has_permission('contracts', '', 'view'))
    AND (coalesce(public.current_user_role_key(), '') <> 'hr_executive'
      OR u.id IN (SELECT unnest(public.current_user_unit_ids())));
$function$;

CREATE OR REPLACE FUNCTION public.get_attendance_charter_units()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
      coalesce(cst.name,'—') customer_name,coalesce(cst.code,'') customer_code,u.billing_state,u.billing_city,coalesce(nullif(u.client_state,''),u.billing_state) client_state,coalesce(nullif(u.client_city,''),u.billing_city) client_city,
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
$function$

;
