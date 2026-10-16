alter table public.client_contracts add column if not exists exact_day_rate boolean not null default false;
comment on column public.client_contracts.exact_day_rate is 'Invoice line = monthly rate / billing days * duties, rounded once (no 2dp per-day rounding) — matches client MIS';
update client_contracts c set exact_day_rate=true from units u join customers cu on cu.id=u.customer_id
 where u.id=c.unit_id and c.status='active' and (cu.name ilike 'Bajaj Finance Ltd%' or cu.name='Bajaj Finance Limited Gujarat');
