-- An explicit attendance correction replaces the source of an earlier automatic
-- conversion. Internal rule restoration/conversion must retain its metadata.
CREATE OR REPLACE FUNCTION public.attendance_edits_replace_rule_originals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.attendance_rules_running', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.ot_hours IS DISTINCT FROM OLD.ot_hours
     OR NEW.ed_from_cap IS DISTINCT FROM OLD.ed_from_cap THEN
    NEW.rule_applied := false;
    NEW.rule_orig_code := NULL;
    NEW.rule_orig_ot := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER attendance_edits_replace_rule_originals
BEFORE UPDATE OF code, ot_hours, ed_from_cap ON public.attendance_entries
FOR EACH ROW EXECUTE FUNCTION public.attendance_edits_replace_rule_originals();