-- Attendance rules: per-role / per-person "face photo required" toggle.
-- Office staff on laptops can be exempted; guards and field officers keep the photo check.

ALTER TABLE public.attendance_location_policies
  ADD COLUMN IF NOT EXISTS require_selfie boolean NOT NULL DEFAULT true;

ALTER TABLE public.attendance_location_overrides
  ADD COLUMN IF NOT EXISTS require_selfie boolean; -- NULL = follow the role policy

-- Guards and field officers always require the photo by default; office roles default to off.
UPDATE public.attendance_location_policies
   SET require_selfie = CASE WHEN role_key IN ('field_officer', 'guard') THEN true ELSE false END
 WHERE require_selfie IS DISTINCT FROM CASE WHEN role_key IN ('field_officer', 'guard') THEN true ELSE false END;

DROP FUNCTION IF EXISTS public.attendance_location_rule_for(uuid);
CREATE OR REPLACE FUNCTION public.attendance_location_rule_for(_candidate_id uuid)
RETURNS TABLE(mode text, radius_m integer, capture_missing_coords boolean, require_selfie boolean, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT id, role_key FROM public.candidates WHERE id = _candidate_id),
  p AS (SELECT p.* FROM public.attendance_location_policies p JOIN c ON p.role_key = c.role_key),
  o AS (SELECT o.* FROM public.attendance_location_overrides o WHERE o.candidate_id = _candidate_id)
  SELECT
    coalesce((SELECT o.mode FROM o), (SELECT p.mode FROM p),
      CASE WHEN (SELECT role_key FROM c) = 'field_officer' THEN 'anywhere'
           WHEN (SELECT role_key FROM c) = 'guard' OR (SELECT role_key FROM c) IS NULL THEN 'assigned_unit'
           ELSE 'home_unit' END),
    coalesce((SELECT p.radius_m FROM p), 300),
    coalesce((SELECT p.capture_missing_coords FROM p), true),
    coalesce((SELECT o.require_selfie FROM o), (SELECT p.require_selfie FROM p),
      CASE WHEN (SELECT role_key FROM c) IN ('field_officer', 'guard') OR (SELECT role_key FROM c) IS NULL THEN true ELSE false END),
    CASE WHEN EXISTS (SELECT 1 FROM o) THEN 'person' WHEN EXISTS (SELECT 1 FROM p) THEN 'role' ELSE 'default' END;
$$;

CREATE OR REPLACE FUNCTION public.my_attendance_location_rule()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cid uuid := public.current_user_candidate_id();
  r record;
BEGIN
  IF _cid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.attendance_location_rule_for(_cid);
  RETURN jsonb_build_object(
    'mode', r.mode, 'radius_m', r.radius_m, 'capture_missing_coords', r.capture_missing_coords,
    'require_selfie', r.require_selfie, 'source', r.source,
    'units', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'latitude', x.latitude,
                        'longitude', x.longitude, 'isPrimary', x.is_primary))
                       FROM public.attendance_location_units_for(_cid, r.mode) x), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.my_attendance_location_rule() TO authenticated;
