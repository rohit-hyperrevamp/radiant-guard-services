-- Billable postings the signed-in person holds besides their main designation
-- (e.g. a Field Officer also posted as Security Guard). Drives the combined view.
CREATE OR REPLACE FUNCTION public.current_user_secondary_postings()
RETURNS TABLE(unit_id uuid, unit_code text, unit_name text, designation_id uuid, designation_name text, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT cu.unit_id, u.code, u.name, cu.designation_id, d.name, cu.sort_order
    FROM public.candidate_units cu
    JOIN public.candidates c ON c.id = cu.candidate_id AND c.id = public.current_user_candidate_id()
    JOIN public.designations d ON d.id = cu.designation_id AND d.billable
    JOIN public.units u ON u.id = cu.unit_id
   WHERE NOT cu.is_reliever
     AND cu.designation_id IS DISTINCT FROM c.designation_id
   ORDER BY cu.sort_order, u.code;
$function$;
REVOKE ALL ON FUNCTION public.current_user_secondary_postings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_secondary_postings() TO authenticated, service_role;
