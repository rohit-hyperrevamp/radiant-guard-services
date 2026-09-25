WITH t AS (
  SELECT id, 49476 + row_number() OVER (ORDER BY created_at, id) AS n
  FROM public.candidates
  WHERE employee_code LIKE 'EMP%' OR employee_code = '3464827443'
)
UPDATE public.candidates c SET employee_code = t.n::text FROM t WHERE c.id = t.id
RETURNING c.full_name, c.employee_code;
