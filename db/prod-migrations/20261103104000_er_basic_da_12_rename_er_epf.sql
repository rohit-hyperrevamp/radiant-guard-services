-- Relabel the employer "12% of Basic + DA" master as the ER EPF formula.
-- Calculation unchanged: (basic + da) * 0.12, no cap. Party stays 'employer'.
UPDATE public.cost_components
SET name = 'ER EPF 12% (Basic + DA)',
    description = 'Employer EPF contribution: 12% of Basic plus DA, no cap. (A separate capped variant, ER EPF 12% (Basic + DA, cap ₹25,000), is also available.)',
    updated_at = now()
WHERE code = 'ER_BASIC_DA_12'
  AND party = 'employer';
