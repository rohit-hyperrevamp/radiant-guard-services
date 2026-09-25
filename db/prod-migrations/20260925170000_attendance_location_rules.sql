-- Attendance location rules (Control Center setting)
--   anywhere      : can punch from any GPS location (Field Officers)
--   assigned_unit : only at a unit they are mapped to (Guards)
--   home_unit     : only at their home/branch office unit (non-billable staff)
-- Units without coordinates learn them from the first on-site punch / client visit.

CREATE TABLE IF NOT EXISTS public.attendance_location_policies (
  role_key text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('anywhere','assigned_unit','home_unit')),
  radius_m integer NOT NULL DEFAULT 300 CHECK (radius_m BETWEEN 25 AND 5000),
  capture_missing_coords boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.attendance_location_overrides (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('anywhere','assigned_unit','home_unit')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_location_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_location_overrides TO authenticated;
GRANT ALL ON public.attendance_location_policies TO service_role;
GRANT ALL ON public.attendance_location_overrides TO service_role;

ALTER TABLE public.attendance_location_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_location_overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS coordinates_source text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS coordinates_captured_at timestamptz;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS coordinates_captured_by uuid;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_attendance_location_rules()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.current_user_role_key() IN ('super_admin','admin','control_center_head','vp_operations'), false)
      OR coalesce(public.is_admin_user(), false);
$$;

DROP POLICY IF EXISTS "Signed-in read attendance location policies" ON public.attendance_location_policies;
CREATE POLICY "Signed-in read attendance location policies" ON public.attendance_location_policies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Managers write attendance location policies" ON public.attendance_location_policies;
CREATE POLICY "Managers write attendance location policies" ON public.attendance_location_policies
  FOR ALL TO authenticated
  USING ((select public.current_user_can_manage_attendance_location_rules()))
  WITH CHECK ((select public.current_user_can_manage_attendance_location_rules()));

DROP POLICY IF EXISTS "Read attendance location overrides" ON public.attendance_location_overrides;
CREATE POLICY "Read attendance location overrides" ON public.attendance_location_overrides
  FOR SELECT TO authenticated
  USING (candidate_id = (select public.current_user_candidate_id())
         OR (select public.current_user_can_manage_attendance_location_rules())
         OR (select public.current_user_role_key()) = 'control_center');
DROP POLICY IF EXISTS "Managers write attendance location overrides" ON public.attendance_location_overrides;
CREATE POLICY "Managers write attendance location overrides" ON public.attendance_location_overrides
  FOR ALL TO authenticated
  USING ((select public.current_user_can_manage_attendance_location_rules()))
  WITH CHECK ((select public.current_user_can_manage_attendance_location_rules()));

INSERT INTO public.attendance_location_policies (role_key, mode)
SELECT r.key,
       CASE WHEN r.key = 'field_officer' THEN 'anywhere'
            WHEN r.key = 'guard' THEN 'assigned_unit'
            ELSE 'home_unit' END
FROM public.roles r
ON CONFLICT (role_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Effective rule for a candidate: personal override > role policy > built-in default.
CREATE OR REPLACE FUNCTION public.attendance_location_rule_for(_candidate_id uuid)
RETURNS TABLE(mode text, radius_m integer, capture_missing_coords boolean, source text)
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
    CASE WHEN EXISTS (SELECT 1 FROM o) THEN 'person' WHEN EXISTS (SELECT 1 FROM p) THEN 'role' ELSE 'default' END;
$$;

-- Units a candidate may punch at under a given mode.
CREATE OR REPLACE FUNCTION public.attendance_location_units_for(_candidate_id uuid, _mode text)
RETURNS TABLE(id uuid, name text, latitude double precision, longitude double precision, is_primary boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name, u.latitude::double precision, u.longitude::double precision, true
  FROM public.candidates c JOIN public.units u ON u.id = c.unit_id
  WHERE c.id = _candidate_id AND _mode IN ('home_unit','assigned_unit')
  UNION
  SELECT u.id, u.name, u.latitude::double precision, u.longitude::double precision, coalesce(cu.is_primary, false)
  FROM public.candidate_units cu JOIN public.units u ON u.id = cu.unit_id
  WHERE cu.candidate_id = _candidate_id AND _mode = 'assigned_unit';
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
    'mode', r.mode, 'radius_m', r.radius_m, 'capture_missing_coords', r.capture_missing_coords, 'source', r.source,
    'units', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'latitude', x.latitude,
                        'longitude', x.longitude, 'isPrimary', x.is_primary))
                       FROM public.attendance_location_units_for(_cid, r.mode) x), '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.my_attendance_location_rule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_attendance_location_rules() TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_unit_coordinates(_unit_id uuid, _lat double precision, _lng double precision, _source text, _by uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _unit_id IS NULL OR _lat IS NULL OR _lng IS NULL THEN RETURN false; END IF;
  UPDATE public.units
     SET latitude = _lat, longitude = _lng, coordinates_source = _source,
         coordinates_captured_at = now(), coordinates_captured_by = _by
   WHERE id = _unit_id AND (latitude IS NULL OR longitude IS NULL);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.capture_unit_coordinates(uuid, double precision, double precision, text, uuid) FROM PUBLIC, anon, authenticated;

-- Server-side gate on self check-in.
CREATE OR REPLACE FUNCTION public.enforce_attendance_location_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  u record;
  _dist double precision;
  _count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.check_in_at IS NOT DISTINCT FROM OLD.check_in_at
     AND NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id THEN
    RETURN NEW;
  END IF;
  -- Only self-punches are gated; admin corrections pass through.
  IF NEW.check_in_at IS NULL OR public.current_user_candidate_id() IS DISTINCT FROM NEW.candidate_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM public.attendance_location_rule_for(NEW.candidate_id);

  IF r.mode = 'anywhere' THEN
    IF NEW.unit_id IS NOT NULL AND r.capture_missing_coords THEN
      PERFORM public.capture_unit_coordinates(NEW.unit_id, NEW.check_in_lat, NEW.check_in_lng, 'self_attendance', auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.check_in_lat IS NULL OR NEW.check_in_lng IS NULL THEN
    RAISE EXCEPTION 'Location is required to mark attendance.' USING ERRCODE = 'P0001';
  END IF;

  IF r.mode = 'home_unit' THEN
    SELECT c.unit_id INTO NEW.unit_id FROM public.candidates c WHERE c.id = NEW.candidate_id;
    IF NEW.unit_id IS NULL THEN
      RAISE EXCEPTION 'No home office is mapped to your profile. Ask your admin to set it.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.unit_id IS NULL THEN
    SELECT count(*) INTO _count FROM public.attendance_location_units_for(NEW.candidate_id, r.mode);
    SELECT x.id INTO NEW.unit_id
      FROM public.attendance_location_units_for(NEW.candidate_id, r.mode) x
     WHERE x.latitude IS NOT NULL AND x.longitude IS NOT NULL
       AND public.geo_distance_m(NEW.check_in_lat, NEW.check_in_lng, x.latitude, x.longitude) <= r.radius_m
     ORDER BY public.geo_distance_m(NEW.check_in_lat, NEW.check_in_lng, x.latitude, x.longitude)
     LIMIT 1;
    IF NEW.unit_id IS NULL AND _count = 1 THEN
      SELECT x.id INTO NEW.unit_id FROM public.attendance_location_units_for(NEW.candidate_id, r.mode) x LIMIT 1;
    END IF;
    IF NEW.unit_id IS NULL THEN
      RAISE EXCEPTION 'Pick the site you are at to mark attendance.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT x.* INTO u FROM public.attendance_location_units_for(NEW.candidate_id, r.mode) x WHERE x.id = NEW.unit_id;
  IF u.id IS NULL THEN
    RAISE EXCEPTION 'You are not mapped to this site, so attendance cannot be marked here.' USING ERRCODE = 'P0001';
  END IF;

  IF u.latitude IS NULL OR u.longitude IS NULL THEN
    IF r.capture_missing_coords THEN
      PERFORM public.capture_unit_coordinates(u.id, NEW.check_in_lat, NEW.check_in_lng, 'self_attendance', auth.uid());
      RETURN NEW;
    END IF;
    RAISE EXCEPTION '% has no location set yet. Ask your admin to set it.', u.name USING ERRCODE = 'P0001';
  END IF;

  _dist := public.geo_distance_m(NEW.check_in_lat, NEW.check_in_lng, u.latitude, u.longitude);
  IF _dist > r.radius_m THEN
    RAISE EXCEPTION 'You are % m from %. Move within % m and try again.', round(_dist), u.name, r.radius_m
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_attendance_location_rule_trigger ON public.self_attendance_punches;
CREATE TRIGGER enforce_attendance_location_rule_trigger
  BEFORE INSERT OR UPDATE OF check_in_at, unit_id ON public.self_attendance_punches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_location_rule();

-- Client visits by Field Officers teach the master the client coordinates.
CREATE OR REPLACE FUNCTION public.capture_unit_coords_from_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL AND NEW.check_in_lat IS NOT NULL AND NEW.check_in_lng IS NOT NULL THEN
    PERFORM public.capture_unit_coordinates(NEW.unit_id, NEW.check_in_lat, NEW.check_in_lng, 'client_visit', auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS capture_unit_coords_from_visit_trigger ON public.field_visits;
CREATE TRIGGER capture_unit_coords_from_visit_trigger
  AFTER INSERT OR UPDATE OF check_in_lat, check_in_lng, unit_id ON public.field_visits
  FOR EACH ROW EXECUTE FUNCTION public.capture_unit_coords_from_visit();
