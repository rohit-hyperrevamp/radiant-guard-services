-- L&T Finance Chandrapur Sharif Complex GL (CLI4512, D500) + contract CON16225.
-- Cloned from Wardha (CLI4433 / CON16164), amounts replaced with the
-- "12 HRS Maharashtra" sheet Chandrapur column (32,600 / 27 = ~1,207 per day).
-- Contract 21 Jul 2026 – 20 Jan 2027, 21-to-20 window, Security Guard.
do $$
declare
  su units; sc client_contracts; r contract_resources;
  u_id uuid := gen_random_uuid(); c_id uuid := gen_random_uuid();
  amt jsonb := jsonb_build_object(
    'Basic',11234,'DA',3900,'HRA',757,'Conveyance Allowance',650,'Washing Allowance',650,
    'Education Allowance',550,'Additional 4 Hours Allowance 50% (Basic+DA)',7567,
    'EE EPF 12% (Basic+DA, cap 15000)',1800,'EE ESI 0.75% (Basic+DA)',113.51,'EE Professional Tax',200,
    'ER EPF 12% (Basic+DA, cap 15000)',1800,'EPF Admin 1% (Basic+DA, cap 15000)',150,'ER LWF - MH',12.5,
    'ER ESI 3.25% (Basic+DA)',492,'Leave with Wages 6% (Basic+DA) Employer Cost',908,
    'Paid Holiday 1% (Basic+DA) Employer Cost',151,'Bonus / Exgratia 10% (Basic+DA) Employer Cost',1513,
    'Uniform 4% (Basic+DA) Employer Cost',605,'Gratuity 4% (Basic+DA)',605,
    'Guard Board Levy 3% (Basic+DA)',454,'Service Charge (Fixed)',600);
begin
  if exists (select 1 from units where code = 'CLI4512') then return; end if;
  select * into su from units where code = 'CLI4433';
  select * into sc from client_contracts where contract_code = 'CON16164';

  insert into units select * from jsonb_populate_record(null::units, to_jsonb(su) || jsonb_build_object(
    'id', u_id, 'code', 'CLI4512',
    'name', 'L&T FINANCE LIMITED- CHANDRAPUR SHARIF COMPLEX GL-(D500)', 'location', 'Chandrapur',
    'billing_name', 'L&T FINANCE LIMITED- CHANDRAPUR SHARIF COMPLEX GL',
    'billing_address1', 'Ground Floor, Sharif Complex Kasturba Rd, Bazar Ward',
    'billing_address2', 'Chandrapur City, Maharashtra',
    'billing_pincode', '442402', 'billing_city', 'Chandrapur', 'billing_district', 'Chandrapur', 'billing_state', 'Maharashtra',
    'shipping_name', 'L&T FINANCE LIMITED- CHANDRAPUR SHARIF COMPLEX GL',
    'shipping_address1', 'Ground Floor, Sharif Complex Kasturba Rd, Bazar Ward',
    'shipping_address2', 'Chandrapur City, Maharashtra',
    'shipping_pincode', '442402', 'shipping_city', 'Chandrapur', 'shipping_district', 'Chandrapur', 'shipping_state', 'Maharashtra',
    'pan_number', 'AABCL5046R', 'status', 'active',
    'latitude', null, 'longitude', null, 'coordinates_source', null, 'coordinates_captured_by', null,
    'coordinates_captured_at', null, 'coordinates_accuracy_m', null,
    'contract_start_date', '2026-07-21', 'contract_end_date', '2027-01-20',
    'created_at', now(), 'updated_at', now()));

  insert into client_contracts select * from jsonb_populate_record(null::client_contracts, to_jsonb(sc) || jsonb_build_object(
    'id', c_id, 'contract_code', 'CON16225', 'unit_id', u_id,
    'description', 'CHANDRAPUR SHARIF COMPLEX - CLI4512, L&T Security Guard (Chandrapur rates)',
    'start_date', '2026-07-21', 'original_start_date', '2026-07-21',
    'end_date', '2027-01-20', 'expiry_date', '2027-01-20',
    'status', 'active', 'approval_status', 'approved', 'approved_at', now(),
    'signed_pdf_url', '', 'signed_at', null, 'renewal_count', 0,
    'created_at', now(), 'updated_at', now()));

  for r in select * from contract_resources where contract_id = sc.id order by sort_order loop
    insert into contract_resources select * from jsonb_populate_record(null::contract_resources, to_jsonb(r) || jsonb_build_object(
      'id', gen_random_uuid(), 'contract_id', c_id, 'quantity', 1, 'created_at', now(), 'updated_at', now(),
      'components', (select coalesce(jsonb_agg(case when amt ? (x->>'name') then jsonb_set(x,'{amount}',amt->(x->>'name')) else x end),'[]') from jsonb_array_elements(r.components) x),
      'deductions', (select coalesce(jsonb_agg(case when amt ? (x->>'name') then jsonb_set(x,'{amount}',amt->(x->>'name')) else x end),'[]') from jsonb_array_elements(r.deductions) x),
      'employer_contributions', (select coalesce(jsonb_agg(case when amt ? (x->>'name') then jsonb_set(x,'{amount}',amt->(x->>'name')) else x end),'[]') from jsonb_array_elements(r.employer_contributions) x)));
  end loop;
end $$;
