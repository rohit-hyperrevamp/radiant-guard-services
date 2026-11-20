-- Rollback-only: no real products or inventory history are changed.
BEGIN;
DO $$
DECLARE
  used_id uuid;
  unused_id uuid := gen_random_uuid();
  before_count bigint;
BEGIN
  SELECT item_id INTO used_id FROM public.inv_stock_movements LIMIT 1;
  IF used_id IS NULL THEN RAISE EXCEPTION 'Expected a product with production stock history'; END IF;
  SELECT count(*) INTO before_count FROM public.inv_stock_movements WHERE item_id = used_id;
  BEGIN
    DELETE FROM public.inv_items WHERE id = used_id;
    RAISE EXCEPTION 'Linked product unexpectedly deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.inv_items WHERE id = used_id)
    OR (SELECT count(*) FROM public.inv_stock_movements WHERE item_id = used_id) <> before_count THEN
    RAISE EXCEPTION 'Product history was changed';
  END IF;
  INSERT INTO public.inv_items(id,item_code,name) VALUES
    (unused_id,'DELETE-TEST-' || unused_id::text,'Rollback-only deletion test');
  DELETE FROM public.inv_items WHERE id = unused_id;
  IF EXISTS (SELECT 1 FROM public.inv_items WHERE id = unused_id) THEN
    RAISE EXCEPTION 'Unused product was not deleted';
  END IF;
END $$;
ROLLBACK;