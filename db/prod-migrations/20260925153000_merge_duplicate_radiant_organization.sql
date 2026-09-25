begin;

-- Consolidate the inactive legacy Radiant organization into the canonical
-- active record while preserving every unit and Field Officer scope mapping.
update public.units
set customer_id = 'a474dbb7-95f6-4a70-b27f-3fa922d29c81'
where customer_id = 'ab81d185-755b-464a-beda-a50908cc47b7';

update public.field_officer_scope
set customer_id = 'a474dbb7-95f6-4a70-b27f-3fa922d29c81'
where customer_id = 'ab81d185-755b-464a-beda-a50908cc47b7';

delete from public.customers
where id = 'ab81d185-755b-464a-beda-a50908cc47b7'
  and status = 'inactive';

commit;