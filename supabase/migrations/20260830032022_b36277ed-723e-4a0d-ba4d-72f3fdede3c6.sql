UPDATE public.cost_components
SET formula_mode = 'advanced',
    formula_expression = 'ctc * 16.67 / 100',
    formula_version = COALESCE(formula_version, 1) + 1,
    calc_type = 'percentage',
    percentage = 16.67,
    base_components = '[{"label":"CTC","operator":"+"}]'::jsonb,
    description = '16.67% of Total CTC',
    updated_at = now()
WHERE name ILIKE '%reliev%';