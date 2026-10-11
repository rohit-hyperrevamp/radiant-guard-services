-- ITC MTC Mumbai (CLI2, CON13054): align EPF with Pages and standardise pay-item names.
-- Pages EPF = 12% of earned (Basic + DA + CCA + WA + Others + Bonus + NFH), capped at 15,000; HRA and Leave Pay excluded.
begin;
update contract_resources cr set components = (
  select jsonb_agg(case c->>'name'
    when 'HRA 20%' then jsonb_set(c,'{name}','"HRA"')
    when 'Conveyance Allowance' then jsonb_set(c,'{name}','"CCA"')
    when 'Leave Conveyance Travelling' then jsonb_set(c,'{name}','"Others"')
    when 'Leave with Wages 6%' then jsonb_set(c,'{name}','"Leave Pay"')
    when 'Paid Holiday 1%' then jsonb_set(c,'{name}','"Paid Holiday"')
    when 'Bonus 10%' then jsonb_set(c,'{name}','"Bonus"')
    else c end order by ord)
  from jsonb_array_elements(cr.components) with ordinality t(c,ord))
where cr.contract_id = 'dbc4d160-ebee-45b4-be84-064a0d611ddb';

update contract_resources cr set deductions = (
  select jsonb_agg(case when d->>'name' ilike '%epf%'
    then d || jsonb_build_object(
      'name','EE EPF 12% (Basic+DA+CCA+WA+Others+Bonus+Paid Holiday, cap 15000)',
      'formulaExpression','min(basic + da + cca + washing_allowance + others + bonus + paid_holiday, 15000) * 0.12',
      'roundMode','nearest')
    else d end order by ord)
  from jsonb_array_elements(cr.deductions) with ordinality t(d,ord))
where cr.contract_id = 'dbc4d160-ebee-45b4-be84-064a0d611ddb';
commit;
