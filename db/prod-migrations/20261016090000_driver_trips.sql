-- Driver trip assignments: transport managers assign a driver a vehicle and
-- destination; the driver acknowledges on the mobile app.
CREATE TABLE IF NOT EXISTS public.driver_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  from_location text NOT NULL DEFAULT '',
  to_location text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending | acknowledged | completed | cancelled
  acknowledged_at timestamptz,
  completed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.driver_trips TO authenticated;
GRANT ALL ON public.driver_trips TO service_role;

ALTER TABLE public.driver_trips ENABLE ROW LEVEL SECURITY;

-- Driver sees only their own trips; anyone with Vehicles view sees all.
CREATE POLICY driver_trips_select ON public.driver_trips
  FOR SELECT TO authenticated
  USING (
    driver_id = (SELECT public.current_user_candidate_id())
    OR public.current_user_has_permission('vehicles', '', 'view')
    OR public.current_user_has_permission('vehicles', '', 'edit')
  );

-- Only fleet managers (Vehicles edit) assign trips.
CREATE POLICY driver_trips_insert ON public.driver_trips
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('vehicles', '', 'edit'));

-- Driver acknowledges/completes their own trip; managers can edit any.
CREATE POLICY driver_trips_update ON public.driver_trips
  FOR UPDATE TO authenticated
  USING (
    driver_id = (SELECT public.current_user_candidate_id())
    OR public.current_user_has_permission('vehicles', '', 'edit')
  )
  WITH CHECK (
    driver_id = (SELECT public.current_user_candidate_id())
    OR public.current_user_has_permission('vehicles', '', 'edit')
  );

-- Notify the driver when a trip is assigned.
CREATE OR REPLACE FUNCTION public.notify_driver_trip_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _vehicle text;
BEGIN
  _user_id := public.get_user_id_by_candidate(NEW.driver_id);
  IF _user_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(vehicle_number, '') INTO _vehicle FROM public.vehicles WHERE id = NEW.vehicle_id;
  INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id, link)
  VALUES (
    _user_id,
    'New trip assigned',
    trim(both ' ' from concat(
      COALESCE(NULLIF(NEW.from_location, ''), 'Office'),
      ' → ',
      COALESCE(NULLIF(NEW.to_location, ''), 'Destination'),
      CASE WHEN _vehicle <> '' THEN ' · ' || _vehicle ELSE '' END,
      ' · ', to_char(NEW.trip_date, 'DD Mon')
    )),
    'driver_trip',
    'driver_trip',
    NEW.id,
    '/admin'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_trips_notify ON public.driver_trips;
CREATE TRIGGER driver_trips_notify
  AFTER INSERT ON public.driver_trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_trip_assigned();
