-- Create three new L&T Finance Karnataka sites (Mudhol CLI4504, Naragund CLI4505,
-- Ramdurg CLI4506) and their contracts, cloned from CLI4500 / CON16187 so they carry
-- the same Karnataka Un-Armed Guard 12 Hours structure (total billing 34,608.84).
do $$
declare
  src_unit units;
  src_contract client_contracts;
  src_res contract_resources;
  rec record;
  new_unit_id uuid;
  new_contract_id uuid;
  next_num int;
begin
  select * into src_unit from units where code = 'CLI4500';
  select * into src_contract from client_contracts where contract_code = 'CON16187';
  select * into src_res from contract_resources where contract_id = src_contract.id order by sort_order limit 1;

  select coalesce(max((regexp_replace(contract_code, '\D', '', 'g'))::int), 0)
    into next_num
    from client_contracts
   where contract_code ~ '^CON[0-9]+$';

  for rec in
    select * from (values
      ('CLI4504', 'L&T FINANCE LTD- MUDHOL',   'Mudhol',   'Bagalkot'),
      ('CLI4505', 'L&T FINANCE LTD- NARAGUND', 'Naragund', 'Gadag'),
      ('CLI4506', 'L&T FINANCE LTD- RAMDURG',  'Ramdurg',  'Belagavi')
    ) as t(code, name, city, district)
  loop
    if exists (select 1 from units where code = rec.code) then
      continue;
    end if;

    new_unit_id := gen_random_uuid();
    insert into units
    select * from jsonb_populate_record(
      null::units,
      to_jsonb(src_unit) || jsonb_build_object(
        'id', new_unit_id,
        'code', rec.code,
        'name', rec.name,
        'location', rec.city,
        'billing_name', rec.name,
        'shipping_name', rec.name,
        'billing_city', rec.city,
        'billing_district', rec.district,
        'shipping_city', rec.city,
        'shipping_district', rec.district,
        'created_at', now(),
        'updated_at', now()
      )
    );

    next_num := next_num + 1;
    new_contract_id := gen_random_uuid();
    insert into client_contracts
    select * from jsonb_populate_record(
      null::client_contracts,
      to_jsonb(src_contract) || jsonb_build_object(
        'id', new_contract_id,
        'contract_code', 'CON' || next_num::text,
        'unit_id', new_unit_id,
        'description', upper(rec.city) || ' - ' || rec.code || ', L&T Un-Armed Guard Karnataka 12 Hours',
        'created_at', now(),
        'updated_at', now()
      )
    );

    insert into contract_resources
    select * from jsonb_populate_record(
      null::contract_resources,
      to_jsonb(src_res) || jsonb_build_object(
        'id', gen_random_uuid(),
        'contract_id', new_contract_id,
        'created_at', now(),
        'updated_at', now()
      )
    );
  end loop;
end $$;
