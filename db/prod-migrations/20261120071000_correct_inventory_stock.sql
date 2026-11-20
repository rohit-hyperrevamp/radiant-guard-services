-- Correct a balance by an audited compensating movement, never deleting history.
CREATE OR REPLACE FUNCTION public.correct_inventory_stock(_balance_id uuid, _expected_qty numeric, _new_qty numeric, _reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE b public.inv_stock_balances; _action text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to correct stock'; END IF;
  IF _new_qty IS NULL OR _new_qty < 0 OR _new_qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid non-negative quantity'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'Enter a correction reason'; END IF;
  _action := CASE WHEN _new_qty = 0 THEN 'delete' ELSE 'edit' END;
  IF NOT (coalesce(public.current_user_role_key(),'') IN ('admin','super_admin') OR
    coalesce(public.current_user_explicit_permission('inventory','stock_report',_action), public.current_user_module_access('inventory',_action), false)) THEN
    RAISE EXCEPTION 'You do not have permission to correct this stock';
  END IF;
  SELECT * INTO b FROM public.inv_stock_balances WHERE id = _balance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock line is no longer available'; END IF;
  IF b.qty IS DISTINCT FROM _expected_qty THEN RAISE EXCEPTION 'Stock changed since you opened it. Refresh and try again'; END IF;
  IF b.qty = _new_qty THEN RAISE EXCEPTION 'Quantity has not changed'; END IF;
  INSERT INTO public.inv_stock_movements (movement_type,location_type,location_id,item_id,size_value,qty_change,reference_type,reference_id,notes,created_by)
  VALUES ('STOCK_CORRECTION',b.location_type,b.location_id,b.item_id,b.size_value,_new_qty-b.qty,'stock_correction',b.id,
    format('Quantity %s → %s: %s', b.qty, _new_qty, trim(_reason)),auth.uid());
  RETURN _new_qty;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_inventory_stock(uuid,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_inventory_stock(uuid,numeric,numeric,text) TO authenticated;