-- Attendance belongs to the person's unit role, not to a single designation.
-- Primary guards may have attendance rows under any designation present on the
-- active contract. Relievers remain Extra-Duty-only.
CREATE OR REPLACE FUNCTION public.enforce_reliever_extra_duty_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reliever boolean := false;
BEGIN
  SELECT COALESCE(cu.is_reliever, false)
    INTO v_reliever
  FROM public.candidate_units cu
  WHERE cu.candidate_id = NEW.candidate_id
    AND cu.unit_id = NEW.unit_id
  ORDER BY cu.is_primary DESC, cu.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT NOT (c.unit_id = NEW.unit_id)
      INTO v_reliever
    FROM public.candidates c
    WHERE c.id = NEW.candidate_id;
  END IF;

  IF COALESCE(v_reliever, false) AND NEW.code <> '' THEN
    RAISE EXCEPTION 'Reliever attendance at this unit must be recorded as Extra Duty';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_reliever_extra_duty_only() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_reliever_extra_duty_only() TO service_role;
