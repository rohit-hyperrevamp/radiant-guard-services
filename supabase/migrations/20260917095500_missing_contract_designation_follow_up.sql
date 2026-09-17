CREATE OR REPLACE FUNCTION public.get_missing_contract_designations()
RETURNS TABLE (
  candidate_id uuid,
  full_name text,
  employee_code text,
  candidate_code text,
  unit_id uuid,
  unit_name text,
  unit_code text,
  customer_name text,
  designation_id uuid,
  designation_name text,
  contract_id uuid,
  missing_since date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer AS (
    SELECT
      public.current_user_role_key() AS role_key,
      public.current_user_candidate_id() AS candidate_id,
      auth.uid() AS user_id
  ),
  current_contract AS (
    SELECT DISTINCT ON (cc.unit_id)
      cc.unit_id,
      cc.id AS contract_id
    FROM public.client_contracts cc
    WHERE cc.record_type = 'client'
      AND cc.status = 'active'
      AND cc.start_date <= CURRENT_DATE
      AND COALESCE(cc.expiry_date, cc.end_date, 'infinity'::date) >= CURRENT_DATE
    ORDER BY cc.unit_id, cc.start_date DESC, cc.created_at DESC
  )
  SELECT
    c.id,
    c.full_name,
    NULLIF(c.employee_code, ''),
    NULLIF(c.candidate_code, ''),
    cu.unit_id,
    u.name,
    u.code,
    COALESCE(cust.name, 'Organization pending'),
    cu.designation_id,
    d.name,
    cc.contract_id,
    cu.created_at::date
  FROM public.candidate_units cu
  JOIN public.candidates c ON c.id = cu.candidate_id
  JOIN public.units u ON u.id = cu.unit_id AND u.is_billable IS DISTINCT FROM false
  LEFT JOIN public.customers cust ON cust.id = u.customer_id
  JOIN public.designations d ON d.id = cu.designation_id
  LEFT JOIN current_contract cc ON cc.unit_id = cu.unit_id
  CROSS JOIN viewer v
  WHERE c.is_enabled = true
    AND c.status IN ('active', 'approved', 'pending')
    AND cu.designation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.contract_resources cr
      WHERE cr.contract_id = cc.contract_id
        AND cr.designation_id = cu.designation_id
    )
    AND (
      public.is_admin_user()
      OR v.role_key IN ('finance', 'accounts')
      OR public.current_user_has_permission('contracts', '', 'view')
      OR (
        v.role_key = 'field_officer'
        AND (c.created_by = v.user_id OR c.reports_to = v.candidate_id)
      )
    )
  ORDER BY cu.created_at ASC, c.full_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_missing_contract_designations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_missing_contract_designations() TO authenticated;

UPDATE public.role_permissions
SET can_view = true, can_edit = true
WHERE role_key = 'finance'
  AND module_key = 'contracts'
  AND sub_module_key IN ('', 'client_contracts');
