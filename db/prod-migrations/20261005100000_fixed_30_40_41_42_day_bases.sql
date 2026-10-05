-- Payroll & billing day options: Fixed 30.40 / 30.41 / 30.42 in both lists.
UPDATE public.payroll_day_bases SET fixed_days = 30.41, updated_at = now() WHERE code = 'FIXED_30_41' AND fixed_days IS NULL;
UPDATE public.billing_day_bases SET fixed_days = 30.41, updated_at = now() WHERE code = 'FIXED_30_41' AND fixed_days IS NULL;

INSERT INTO public.payroll_day_bases (name, code, method, fixed_days, description, is_default, enabled, sort_order)
SELECT v.name, v.code, 'fixed_days', v.days, v.descr, false, true, v.ord
FROM (VALUES
  ('Fixed 30.40 Days','FIXED_30_40',30.40::numeric,'Divided by a fixed 30.40 days per month.',44),
  ('Fixed 30.42 Days','FIXED_30_42',30.42::numeric,'Divided by a fixed 30.42 days per month.',46)
) v(name,code,days,descr,ord)
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_day_bases p WHERE p.code = v.code);

INSERT INTO public.billing_day_bases (name, code, method, fixed_days, description, is_default, enabled, sort_order)
SELECT 'Fixed 30.42 Days','FIXED_30_42','fixed_days',30.42,'Billing is divided by a fixed 30.42 days per month.',false,true,46
WHERE NOT EXISTS (SELECT 1 FROM public.billing_day_bases WHERE code = 'FIXED_30_42');
