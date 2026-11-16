-- Atomic operational mapping only; payroll homes and guard postings are untouched.
CREATE POLICY "Operational managers receive unit scope mappings"
ON public.employee_scope_assignments FOR INSERT TO authenticated
WITH CHECK (scope_type='unit' AND public.current_user_can_manage_unit_scope_assignments()
  AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id=candidate_id
    AND c.role_key='operations_manager' AND c.status IN ('active','approved') AND COALESCE(c.is_enabled,true)));
CREATE OR REPLACE FUNCTION public.bulk_assign_operational_units(
  _unit_ids uuid[], _candidate_id uuid, _kind text, _mode text
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  target_role text;
  ids uuid[];
  visible_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.guard_absence_access_allowed()
    OR NOT public.current_user_can_manage_unit_scope_assignments() THEN
    RAISE EXCEPTION 'You do not have permission to change unit assignments';
  END IF;
  IF _kind IS NULL OR _mode IS NULL OR _kind NOT IN ('field_officer','operations_manager') OR _mode NOT IN ('add','replace') THEN
    RAISE EXCEPTION 'Invalid assignment choice';
  END IF;
  SELECT array_agg(DISTINCT id) INTO ids FROM unnest(_unit_ids) AS t(id) WHERE id IS NOT NULL;
  IF COALESCE(cardinality(ids),0) = 0 THEN RAISE EXCEPTION 'Select at least one site'; END IF;
  SELECT role_key INTO target_role FROM public.candidates
    WHERE id = _candidate_id AND status IN ('active','approved') AND COALESCE(is_enabled,true);
  IF target_role IS DISTINCT FROM _kind THEN RAISE EXCEPTION 'Select an active employee for the chosen assignment type'; END IF;
  -- Lock in stable order; invoker RLS applies to every read and write.
  PERFORM id FROM public.units WHERE id = ANY(ids) AND status = 'active' ORDER BY id FOR UPDATE;
  SELECT count(*) INTO visible_count FROM public.units WHERE id = ANY(ids) AND status = 'active';
  IF visible_count <> cardinality(ids) THEN RAISE EXCEPTION 'Some selected sites are inactive or no longer accessible'; END IF;

  IF _mode = 'replace' THEN
    DELETE FROM public.employee_scope_assignments a USING public.candidates c
      WHERE a.candidate_id=c.id AND a.scope_type='unit' AND a.scope_id=ANY(SELECT id::text FROM unnest(ids) t(id))
        AND c.role_key=_kind AND c.id<>_candidate_id;
    IF _kind = 'field_officer' THEN
      DELETE FROM public.candidate_units l USING public.candidates c
        WHERE l.candidate_id=c.id AND l.unit_id=ANY(ids) AND c.role_key='field_officer' AND c.id<>_candidate_id;
    ELSE
      UPDATE public.units SET operations_manager_id=_candidate_id WHERE id=ANY(ids);
      GET DIAGNOSTICS visible_count = ROW_COUNT;
      IF visible_count <> cardinality(ids) THEN RAISE EXCEPTION 'Some sites could not be reassigned'; END IF;
    END IF;
  END IF;

  INSERT INTO public.employee_scope_assignments(candidate_id,scope_type,scope_id,scope_label)
    SELECT _candidate_id,'unit',u.id::text,concat_ws(' — ',u.code,u.name) FROM public.units u WHERE u.id=ANY(ids)
    ON CONFLICT(candidate_id,scope_type,scope_id) DO NOTHING;
  IF _mode='replace' AND EXISTS (SELECT 1 FROM public.employee_scope_assignments a JOIN public.candidates c ON c.id=a.candidate_id
    WHERE a.scope_type='unit' AND a.scope_id=ANY(SELECT id::text FROM unnest(ids) t(id)) AND c.role_key=_kind AND c.id<>_candidate_id) THEN
    RAISE EXCEPTION 'Existing assignments could not be removed; nothing has been changed';
  END IF;
  IF _mode='replace' AND _kind='field_officer' AND EXISTS (SELECT 1 FROM public.candidate_units l JOIN public.candidates c ON c.id=l.candidate_id
    WHERE l.unit_id=ANY(ids) AND c.role_key='field_officer' AND c.id<>_candidate_id) THEN
    RAISE EXCEPTION 'Existing officer postings could not be removed; nothing has been changed';
  END IF;
  IF (SELECT count(*) FROM public.employee_scope_assignments WHERE candidate_id=_candidate_id
    AND scope_type='unit' AND scope_id=ANY(SELECT id::text FROM unnest(ids) t(id))) <> cardinality(ids) THEN
    RAISE EXCEPTION 'Not all assignments could be saved';
  END IF;
  RETURN cardinality(ids);
END;
$$;
REVOKE ALL ON FUNCTION public.bulk_assign_operational_units(uuid[],uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_assign_operational_units(uuid[],uuid,text,text) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';