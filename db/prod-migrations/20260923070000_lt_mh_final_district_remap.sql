-- Final L&T Maharashtra district remapping:
--   CON15935 / CLI4287 (Ichalkaranji) -> Sangli column   (template CLI4320)
--   CON16163/64/65/66/67 (Akola, Wardha, Nagpur, Digdoh, Buldhana) -> Aurangabad column (template CLI4288)
--   CON16156 / CLI4439 (Khopoli Shilphata Highway)       -> Mumbai column (template CLI4276)
begin;

with rate_map(target_code, source_code) as (
  values
    ('CLI4287', 'CLI4320'),
    ('CLI4433', 'CLI4288'), ('CLI4435', 'CLI4288'), ('CLI4436', 'CLI4288'),
    ('CLI4437', 'CLI4288'), ('CLI4438', 'CLI4288'),
    ('CLI4439', 'CLI4276')
), source_rates as (
  select rm.target_code, src.components, src.benefits, src.deductions,
         src.employer_contributions, src.gross,
         src.payroll_day_base_id, src.billing_day_base_id
    from rate_map rm
    join units su on su.code = rm.source_code
    join client_contracts sc on sc.unit_id = su.id
    join contract_resources src on src.contract_id = sc.id and src.shift_hours = 12
    join designations sd on sd.id = src.designation_id and sd.name = 'Security Guard'
)
update contract_resources target
   set components = sr.components,
       benefits = sr.benefits,
       deductions = sr.deductions,
       employer_contributions = sr.employer_contributions,
       gross = sr.gross,
       payroll_day_base_id = sr.payroll_day_base_id,
       billing_day_base_id = sr.billing_day_base_id,
       updated_at = now()
  from client_contracts tc
  join units tu on tu.id = tc.unit_id
  join source_rates sr on sr.target_code = tu.code
  join designations td on td.name = 'Security Guard'
 where target.contract_id = tc.id
   and target.designation_id = td.id
   and target.shift_hours = 12
   and tu.customer_id = '77ddd7f3-bd79-4453-b0d7-f7e533687353';

commit;
