-- Explicitly remove database-wide default grants; only trusted workers publish money.
REVOKE ALL ON public.finance_period_totals FROM anon,authenticated;
GRANT SELECT ON public.finance_period_totals TO authenticated;
GRANT INSERT(unit_id,period_start,period_end) ON public.finance_period_totals TO authenticated;
REVOKE ALL ON public.finance_refresh_config FROM anon,authenticated;
GRANT ALL ON public.finance_period_totals, public.finance_refresh_config TO service_role;
UPDATE public.finance_refresh_config SET enabled=true WHERE id;