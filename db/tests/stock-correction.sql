\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub',a.id::text,true) FROM auth.users a JOIN candidates c ON a.email='phone-'||c.mobile||'@radiantguard.local' WHERE c.role_key='super_admin' LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$
DECLARE b public.inv_stock_balances; before_count integer; n numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'An authorized stock test user is required'; END IF;
  SELECT * INTO b FROM public.inv_stock_balances WHERE qty>1 LIMIT 1;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Stock fixture required'; END IF;
  SELECT count(*) INTO before_count FROM public.inv_stock_movements WHERE location_type=b.location_type AND location_id=b.location_id AND item_id=b.item_id AND size_value=b.size_value;
  n := public.correct_inventory_stock(b.id,b.qty,b.qty+2,'Rollback test correction');
  IF (SELECT qty FROM public.inv_stock_balances WHERE id=b.id) <> b.qty+2 THEN RAISE EXCEPTION 'Incorrect balance after correction'; END IF;
  BEGIN
    PERFORM public.correct_inventory_stock(b.id,b.qty,0,'Stale expected quantity');
    RAISE EXCEPTION 'Stale correction unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Stock changed%' THEN RAISE; END IF;
  END;
  n := public.correct_inventory_stock(b.id,b.qty+2,0,'Rollback test remove stock');
  IF (SELECT qty FROM public.inv_stock_balances WHERE id=b.id) <> 0 THEN RAISE EXCEPTION 'Remove did not zero balance'; END IF;
  IF (SELECT count(*) FROM public.inv_stock_movements WHERE location_type=b.location_type AND location_id=b.location_id AND item_id=b.item_id AND size_value=b.size_value) <> before_count+2 THEN RAISE EXCEPTION 'History was lost'; END IF;
  BEGIN
    PERFORM public.correct_inventory_stock(b.id,0,-1,'Invalid negative quantity');
    RAISE EXCEPTION 'Negative correction unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Enter a valid%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.correct_inventory_stock(b.id,0,1,'Unsigned correction');
    RAISE EXCEPTION 'Unsigned correction unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Sign in%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;