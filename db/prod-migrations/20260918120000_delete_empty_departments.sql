-- Delete departments that have zero candidates mapped.
-- Only candidates.department_id references departments (verified via information_schema),
-- so removing departments with no candidates is safe.
delete from public.departments d
where not exists (
  select 1 from public.candidates c where c.department_id = d.id
);
