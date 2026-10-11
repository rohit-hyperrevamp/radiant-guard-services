-- Month-by-month pay rates per site and role, derived from archived Pages payslips.
-- Used to show past rates where an old contract has no rate structure.
CREATE OR REPLACE VIEW public.pages_rate_history WITH (security_invoker = true) AS
SELECT
  unit_id,
  period_year,
  period_month,
  coalesce(nullif(designation_name, ''), 'Unspecified') AS designation_name,
  count(*)::int AS payslips,
  sum(duty) AS duties,
  sum(ot) AS extra_duties,
  sum(gross) AS gross,
  sum(net_pay) AS net_pay,
  CASE WHEN sum(duty + ot) > 0 THEN round(sum(gross) / sum(duty + ot), 2) END AS gross_per_duty,
  round(avg(gross) FILTER (WHERE duty >= 26 AND ot = 0), 2) AS full_month_gross
FROM public.pages_payslip_archive
WHERE unit_id IS NOT NULL
GROUP BY unit_id, period_year, period_month, coalesce(nullif(designation_name, ''), 'Unspecified');

GRANT SELECT ON public.pages_rate_history TO authenticated;
GRANT SELECT ON public.pages_rate_history TO service_role;
