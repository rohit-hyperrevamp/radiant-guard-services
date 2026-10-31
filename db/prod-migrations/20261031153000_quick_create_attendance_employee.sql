-- Super Admin only: create a minimal employee (ID + name + start/end date)
-- straight from the attendance sheet. Personal details are filled in later
-- from the Employees page.
CREATE OR REPLACE FUNCTION public.quick_create_attendance_employee(
  _employee_code text,
  _full_name text,
  _start_date date,
  _end_date date,
  _unit_id uuid,
  _designation_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text := btrim(coalesce(_employee_code, ''));
  _name text := btrim(coalesce(_full_name, ''));
  _id uuid;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can create employees from attendance';
  END IF;
  IF _code = '' THEN RAISE EXCEPTION 'Employee ID is required'; END IF;
  IF _name = '' THEN RAISE EXCEPTION 'Employee name is required'; END IF;
  IF _start_date IS NULL THEN RAISE EXCEPTION 'Start date is required'; END IF;
  IF _end_date IS NOT NULL AND _end_date < _start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE employee_code = _code) THEN
    RAISE EXCEPTION 'Employee ID % already exists — search for it instead', _code;
  END IF;

  INSERT INTO public.candidates (
    employee_code, full_name, preferred_joining_date, offboarded_at,
    unit_id, designation_id, status, role_key, is_enabled, approved_at,
    onboarding_details
  ) VALUES (
    _code, _name, _start_date,
    CASE WHEN _end_date IS NULL THEN NULL ELSE (_end_date::timestamp AT TIME ZONE 'Asia/Kolkata') END,
    _unit_id, _designation_id, 'active', 'guard', true, now(),
    jsonb_build_object('quick_created_from_attendance', true, 'quick_created_by', auth.uid())
  ) RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_create_attendance_employee(text, text, date, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_create_attendance_employee(text, text, date, date, uuid, uuid) TO authenticated, service_role;
