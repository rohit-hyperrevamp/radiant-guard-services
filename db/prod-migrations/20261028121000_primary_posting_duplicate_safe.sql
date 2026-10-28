CREATE OR REPLACE FUNCTION public.enforce_single_primary_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_primary THEN
    NEW.is_reliever := false;
    UPDATE public.candidate_units
       SET is_primary = false, is_reliever = NOT EXISTS (
         SELECT 1 FROM public.candidate_units sibling
         WHERE sibling.candidate_id = candidate_units.candidate_id
           AND sibling.unit_id = candidate_units.unit_id
           AND sibling.designation_id IS NOT DISTINCT FROM candidate_units.designation_id
           AND sibling.shift_hours IS NOT DISTINCT FROM candidate_units.shift_hours
           AND sibling.id <> candidate_units.id AND sibling.is_reliever
       ), updated_at = now()
     WHERE candidate_id = NEW.candidate_id AND id <> NEW.id AND is_primary
       AND unit_id <> NEW.unit_id;
    UPDATE public.candidate_units
       SET is_primary = false, updated_at = now()
     WHERE candidate_id = NEW.candidate_id AND id <> NEW.id AND is_primary
       AND unit_id = NEW.unit_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.candidate_units x
    WHERE x.candidate_id = NEW.candidate_id AND x.unit_id = NEW.unit_id
      AND x.id <> NEW.id AND x.is_primary
  ) THEN
    -- Existing regular/reliever sibling lines must not collide on demotion.
    NEW.is_reliever := NOT EXISTS (
      SELECT 1 FROM public.candidate_units sibling
      WHERE sibling.candidate_id = NEW.candidate_id AND sibling.unit_id = NEW.unit_id
        AND sibling.designation_id IS NOT DISTINCT FROM NEW.designation_id
        AND sibling.shift_hours IS NOT DISTINCT FROM NEW.shift_hours
        AND sibling.id <> NEW.id AND sibling.is_reliever
    );
  END IF;
  RETURN NEW;
END;
$function$

;
