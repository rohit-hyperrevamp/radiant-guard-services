ALTER POLICY "Authenticated read client_contracts" ON public.client_contracts
USING (COALESCE((SELECT public.current_user_role_key()), '') <> 'hr_executive'
       OR unit_id IN (SELECT unnest((SELECT public.current_user_unit_ids()))));
ALTER POLICY "Authenticated read customers" ON public.customers
USING (COALESCE((SELECT public.current_user_role_key()), '') <> 'hr_executive'
       OR id IN (SELECT u.customer_id FROM public.units u WHERE u.id IN (SELECT unnest((SELECT public.current_user_unit_ids())))));
