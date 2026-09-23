-- Add billing_city to get_attendance_charter_units() so Invoice/Payroll/Attendance
-- charters can offer State and City dropdown filters (invoices are state-specific).
CREATE OR REPLACE FUNCTION public.get_attendance_charter_units()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role text := public.current_user_role_key();
  _cand uuid := public.current_user_candidate_id();
  _fo boolean := coalesce(_role,'') = 'field_officer';
  _payload jsonb;
BEGIN
  WITH nb AS (
    SELECT unnest(ARRAY['field_officer','branch_manager','hr','leadership','transport','inventory',
                        'admin','super_admin','user','accounts','operations','operations_manager',
                        'area_manager','regional_manager']) AS k
  ),
  cand AS (
    SELECT c.id, c.full_name, c.designation_id, c.role_key, c.unit_id
    FROM candidates c
    WHERE c.is_enabled AND c.status = 'active' AND coalesce(c.non_billable,false) = false
      AND lower(coalesce(c.role_key,'')) NOT IN (SELECT k FROM nb)
  ),
  contracts AS (
    SELECT unit_id,
           array_remove(array_agg(contract_code ORDER BY contract_code), NULL) AS codes,
           max(end_date) AS contract_end
    FROM client_contracts
    WHERE status = 'active' AND unit_id IS NOT NULL
    GROUP BY unit_id
  ),
  fo_units AS (
    SELECT unit_id FROM field_officer_scope WHERE candidate_id = _cand
  ),
  links AS (
    SELECT cu.unit_id, c.id, c.full_name, c.designation_id
    FROM candidate_units cu JOIN cand c ON c.id = cu.candidate_id
    UNION
    SELECT c.unit_id, c.id, c.full_name, c.designation_id FROM cand c WHERE c.unit_id IS NOT NULL
    UNION
    SELECT u.id, c.id, c.full_name, c.designation_id
    FROM employee_scope_assignments a
    JOIN cand c ON c.id = a.candidate_id
    JOIN units u ON (
      (a.scope_type = 'unit' AND u.id::text = a.scope_id)
      OR (a.scope_type = 'branch' AND u.branch_id::text = a.scope_id)
      OR (a.scope_type = 'customer' AND u.customer_id::text = a.scope_id)
      OR (a.scope_type = 'state' AND u.billing_state = a.scope_id)
    )
  ),
  unit_ids AS (
    SELECT unit_id FROM contracts
    UNION SELECT unit_id FROM links WHERE unit_id IS NOT NULL
  ),
  rows AS (
    SELECT u.id, u.code, u.name, coalesce(u.location,'') AS location, u.branch_id,
           coalesce(u.customer_id::text,'') AS customer_id,
           coalesce(cst.name,'—') AS customer_name,
           coalesce(cst.code,'') AS customer_code,
           u.billing_state,
           u.billing_city,
           coalesce(ct.codes, ARRAY[]::text[]) AS contract_codes,
           ct.contract_end,
           coalesce(g.guards, '[]'::jsonb) AS security_guards,
           coalesce(g.cnt, 0) AS active_employee_count
    FROM units u
    JOIN unit_ids ui ON ui.unit_id = u.id
    LEFT JOIN customers cst ON cst.id = u.customer_id
    LEFT JOIN contracts ct ON ct.unit_id = u.id
    LEFT JOIN (
      SELECT l.unit_id,
             jsonb_agg(jsonb_build_object('id', l.id, 'name', coalesce(nullif(l.full_name,''),'—'))
                       ORDER BY l.full_name) AS guards,
             count(*) AS cnt
      FROM (SELECT DISTINCT unit_id, id, full_name FROM links WHERE unit_id IS NOT NULL) l
      GROUP BY l.unit_id
    ) g ON g.unit_id = u.id
    WHERE (NOT _fo) OR u.id IN (SELECT unit_id FROM fo_units)
  )
  SELECT jsonb_build_object(
    'units', coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.customer_name, coalesce(nullif(r.name,''), r.code)), '[]'::jsonb)
  ) INTO _payload FROM rows r;

  RETURN _payload;
END
$function$;
