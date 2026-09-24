-- Create L&T Finance Karad Vishnu Plaza GL (CLI4511, D360) and contract CON16224,
-- cloned from Satara Sadar Bazar (CLI4432 / CON16158) so it carries Satara district rates.
-- Contract 21 May 2026 – 20 Oct 2026, 21-to-20 payroll window, Security Guard.
do $$
declare
  su units; sc client_contracts; r contract_resources;
  u_id uuid := gen_random_uuid(); c_id uuid := gen_random_uuid();
  w_id uuid;
begin
  if exists (select 1 from units where code = 'CLI4511') then return; end if;
  select * into su from units where code = 'CLI4432';
  select * into sc from client_contracts where contract_code = 'CON16158';
  select id into w_id from payroll_windows where id = '5e900b36-3cca-4137-a923-57bfe7910641';

  insert into units select * from jsonb_populate_record(null::units, to_jsonb(su) || jsonb_build_object(
    'id', u_id, 'code', 'CLI4511',
    'name', 'L&T FINANCE LIMITED- KARAD VISHNU PLAZA GL-(D360)', 'location', 'Karad',
    'billing_name', 'L&T FINANCE LIMITED- KARAD VISHNU PLAZA GL',
    'billing_address1', 'Vishnu Plaza, Shop No 5&6, CT Sr. No. 446/A, Karad Kolhapur Road',
    'billing_address2', 'Nr. City Police Station, Karad, Dist. Satara',
    'billing_pincode', '415110', 'billing_city', 'Karad', 'billing_district', 'Satara', 'billing_state', 'Maharashtra',
    'shipping_name', 'L&T FINANCE LIMITED- KARAD VISHNU PLAZA GL',
    'shipping_address1', 'Vishnu Plaza, Shop No 5&6, CT Sr. No. 446/A, Karad Kolhapur Road',
    'shipping_address2', 'Nr. City Police Station, Karad, Dist. Satara',
    'shipping_pincode', '415110', 'shipping_city', 'Karad', 'shipping_district', 'Satara', 'shipping_state', 'Maharashtra',
    'pan_number', 'AABCL5046R', 'enable_pt', false, 'enable_lwf', false, 'status', 'active',
    'latitude', null, 'longitude', null, 'coordinates_source', null, 'coordinates_captured_by', null,
    'coordinates_captured_at', null, 'coordinates_accuracy_m', null,
    'contract_start_date', '2026-05-21', 'contract_end_date', '2026-10-20',
    'created_at', now(), 'updated_at', now()));

  insert into client_contracts select * from jsonb_populate_record(null::client_contracts, to_jsonb(sc) || jsonb_build_object(
    'id', c_id, 'contract_code', 'CON16224', 'unit_id', u_id,
    'description', 'KARAD VISHNU PLAZA - CLI4511, L&T Security Guard (Satara rates)',
    'start_date', '2026-05-21', 'original_start_date', '2026-05-21',
    'end_date', '2026-10-20', 'expiry_date', '2026-10-20',
    'payroll_window_id', coalesce(w_id, sc.payroll_window_id),
    'status', 'active', 'approval_status', 'approved', 'approved_at', now(),
    'signed_pdf_url', '', 'signed_at', null, 'renewal_count', 0,
    'created_at', now(), 'updated_at', now()));

  for r in select * from contract_resources where contract_id = sc.id order by sort_order loop
    insert into contract_resources select * from jsonb_populate_record(null::contract_resources, to_jsonb(r) || jsonb_build_object(
      'id', gen_random_uuid(), 'contract_id', c_id, 'created_at', now(), 'updated_at', now()));
  end loop;
end $$;
