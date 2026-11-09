-- Latest requested statuses; reusable for production readback.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.units WHERE code IN ('CLI4473','CLI3098') AND status='inactive') <> 2 THEN
    RAISE EXCEPTION 'CLI4473 and CLI3098 must both be inactive';
  END IF;
  IF (SELECT count(*) FROM public.units WHERE code IN ('CLI4660','CLI4683') AND status='active') <> 2 THEN
    RAISE EXCEPTION 'CLI4660 and CLI4683 must both be active';
  END IF;
END $$;