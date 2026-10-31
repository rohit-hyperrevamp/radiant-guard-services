-- Attendance quick-create helpers (Super Admin only):
--  * quick_lookup_attendance_employee: find existing people by exact ID or name words,
--    including inactive ones, so the sheet can say "already exists (active/inactive)".
--  * quick_reactivate_attendance_employee: bring an inactive person back with new dates.
CREATE OR REPLACE FUNCTION public.quick_lookup_attendance_employee(
  _employee_code text,
  _full_name text
) RETURNS TABLE (
  id uuid,
  employee_code text,
  full_name text,
  status text,
  is_enabled boolean,
  offboarded_at timestamptz,
  preferred_joining_date date,
  designation_id uuid,
  unit_name text,
  match_kind text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text := btrim(coalesce(_employee_code, ''));
  _words text[] := array_remove(regexp_split_to_array(lower(btrim(coalesce(_full_name, ''))), '\s+'), '');
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can look up employees here';
  END IF;
  RETURN QUERY
  SELECT c.id, c.employee_code, c.full_name, c.status::text, c.is_enabled, c.offboarded_at,
         c.preferred_joining_date, c.designation_id, u.name::text,
         CASE WHEN _code <> '' AND c.employee_code = _code THEN 'id' ELSE 'name' END
    FROM public.candidates c
    LEFT JOIN public.units u ON u.id = c.unit_id
   WHERE (_code <> '' AND c.employee_code = _code)
      OR (coalesce(array_length(_words, 1), 0) > 0
          AND length(array_to_string(_words, '')) >= 3
          AND NOT EXISTS (
            SELECT 1 FROM unnest(_words) w WHERE lower(coalesce(c.full_name, '')) NOT LIKE '%' || w || '%'
          ))
   ORDER BY (_code <> '' AND c.employee_code = _code) DESC, c.full_name
   LIMIT 6;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_lookup_attendance_employee(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_lookup_attendance_employee(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quick_reactivate_attendance_employee(
  _candidate_id uuid,
  _start_date date,
  _end_date date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev record;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can reactivate employees from attendance';
  END IF;
  IF _start_date IS NULL THEN RAISE EXCEPTION 'Start date is required'; END IF;
  IF extract(year FROM _start_date) < 2000 OR extract(year FROM _start_date) > 2100 THEN
    RAISE EXCEPTION 'Start date year % looks wrong — please check the year', extract(year FROM _start_date)::int;
  END IF;
  IF _end_date IS NOT NULL AND _end_date < _start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;
  SELECT status, is_enabled, offboarded_at, preferred_joining_date INTO _prev
    FROM public.candidates WHERE id = _candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  UPDATE public.candidates c
     SET status = 'active',
         is_enabled = true,
         offboarded_at = CASE WHEN _end_date IS NULL THEN NULL
                              ELSE (_end_date::timestamp AT TIME ZONE 'Asia/Kolkata') END,
         preferred_joining_date = _start_date,
         onboarding_details = coalesce(c.onboarding_details, '{}'::jsonb) || jsonb_build_object(
           'reactivation_history',
           coalesce(c.onboarding_details -> 'reactivation_history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'at', now(), 'by', auth.uid(), 'source', 'attendance',
             'prev_status', _prev.status, 'prev_enabled', _prev.is_enabled,
             'prev_offboarded_at', _prev.offboarded_at,
             'prev_joining_date', _prev.preferred_joining_date,
             'new_start', _start_date, 'new_end', _end_date)))
   WHERE c.id = _candidate_id;

  RETURN _candidate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_reactivate_attendance_employee(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_reactivate_attendance_employee(uuid, date, date) TO authenticated, service_role;
