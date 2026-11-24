-- Recompute only aggregates affected by this commercial-label correction.
-- Contract lines, payroll snapshots, attendance and final invoices remain untouched.
UPDATE public.finance_period_totals t SET generation=generation+1,retry_after=NULL
WHERE EXISTS (
  SELECT 1 FROM public.client_contracts c JOIN public.contract_resources r ON r.contract_id=c.id
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.employer_contributions,'[]'::jsonb)) line
  WHERE c.unit_id=t.unit_id AND line->>'name' ~* '^Relieving[ _-]+Charges?'
) OR EXISTS (
  SELECT 1 FROM public.payroll_run_snapshots s
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.employer_contributions,'[]'::jsonb)) line
  WHERE s.unit_id=t.unit_id AND line->>'name' ~* '^Relieving[ _-]+Charges?'
);