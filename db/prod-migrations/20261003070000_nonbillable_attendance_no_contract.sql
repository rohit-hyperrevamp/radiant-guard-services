-- Non-billable (Radiant own office) sites need no contract for attendance.
-- Rule: units.is_billable = false. Their non-billable staff appear on the muster.
UPDATE public.units SET is_billable=false WHERE code IN ('UN1','CLI1472','CLI3154');

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
    WHERE c.is_enabled AND c.status='active'
      AND ((coalesce(c.non_billable,false)=false AND lower(coalesce(c.role_key,'')) NOT IN (SELECT k FROM nb))
        OR EXISTS (SELECT 1 FROM units hu WHERE hu.id=c.unit_id AND hu.is_billable=false))
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
        OR (a.scope_type='customer' AND u.customer_id::text=a.scope_id) OR (a.scope_type='state' AND coalesce(nullif(u.client_state,''),u.billing_state)=a.scope_id))
  ), unit_ids AS (SELECT unit_id FROM contracts UNION SELECT unit_id FROM links WHERE unit_id IS NOT NULL),
  rows AS (
    SELECT u.id,u.code,u.name,coalesce(u.location,'') location,u.branch_id,coalesce(u.customer_id::text,'') customer_id,
      coalesce(cst.name,'—') customer_name,coalesce(cst.code,'') customer_code,u.billing_state,u.billing_city,coalesce(nullif(u.client_state,''),u.billing_state) client_state,coalesce(nullif(u.client_city,''),u.billing_city) client_city,
      coalesce(ct.codes,ARRAY[]::text[]) contract_codes,ct.contract_end,coalesce(g.guards,'[]'::jsonb) security_guards,
      coalesce(g.cnt,0) active_employee_count
    FROM units u JOIN unit_ids ui ON ui.unit_id=u.id LEFT JOIN customers cst ON cst.id=u.customer_id LEFT JOIN contracts ct ON ct.unit_id=u.id
    LEFT JOIN (SELECT l.unit_id,jsonb_agg(jsonb_build_object('id',l.id,'name',coalesce(nullif(l.full_name,''),'—')) ORDER BY l.full_name) guards,count(*) cnt
      FROM (SELECT DISTINCT unit_id,id,full_name FROM links WHERE unit_id IS NOT NULL) l GROUP BY l.unit_id) g ON g.unit_id=u.id
    WHERE ((NOT _scoped) OR u.id IN (SELECT unit_id FROM allowed_units))
      -- No active contract → no attendance. UN1 (Radiant home office) is the
      -- non-billable Field Officer payroll base and is exempt.
      AND (ct.unit_id IS NOT NULL OR u.is_billable = false)
  )
  SELECT jsonb_build_object('units',coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.customer_name,coalesce(nullif(r.name,''),r.code)),'[]'::jsonb))
  INTO _payload FROM rows r;
  RETURN _payload;
END
$function$;

-- Self punches without a site default to the person's home site so they reach the sheet.
CREATE OR REPLACE FUNCTION public.self_punch_default_unit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.unit_id IS NULL THEN SELECT c.unit_id INTO NEW.unit_id FROM public.candidates c WHERE c.id=NEW.candidate_id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_self_punch_default_unit ON public.self_attendance_punches;
CREATE TRIGGER a_self_punch_default_unit BEFORE INSERT OR UPDATE ON public.self_attendance_punches FOR EACH ROW EXECUTE FUNCTION public.self_punch_default_unit();

-- Backfill Sep 1 .. yesterday: attach home site, which fires the sync to attendance_entries.
ALTER TABLE public.self_attendance_punches DISABLE TRIGGER enforce_attendance_location_rule_trigger;
UPDATE public.self_attendance_punches p SET unit_id=c.unit_id
FROM public.candidates c WHERE c.id=p.candidate_id AND p.unit_id IS NULL AND c.unit_id IS NOT NULL
  AND p.punch_date >= '2026-09-01';
-- Re-sync punches whose entry is missing.
UPDATE public.self_attendance_punches p SET updated_at=now()
WHERE p.punch_date BETWEEN '2026-09-01' AND current_date-1 AND p.unit_id IS NOT NULL AND p.check_in_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.attendance_entries ae WHERE ae.candidate_id=p.candidate_id AND ae.unit_id=p.unit_id AND ae.entry_date=p.punch_date);
ALTER TABLE public.self_attendance_punches ENABLE TRIGGER enforce_attendance_location_rule_trigger;
