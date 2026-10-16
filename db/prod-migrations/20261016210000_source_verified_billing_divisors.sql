-- Source-backed billing-divisor corrections only. No salary, designation,
-- payroll divisor, attendance, approval or contribution amount is changed.
-- CLI318: MH-SEP26-27-3051 (01–30 September): SG 25068.19 / 30,
-- supervisor 26391.87 / 30. Shared CLI318 Helvoet rate sheet explicitly
-- states "Billing Rate 30/31 Days"; use the calendar-month billing basis.
-- CLI887: MH-SEP26-27-3018: SG 21063.30 / 26 = displayed 810.13/day.
-- Shared CLI887 Franklin PDF explicitly states "Revised Rate for 26 Days".
-- Newer July–December quotations differ from these issued invoices: do not
-- overwrite wage or CTC components until their applicability is verified.
begin;

create temporary table verified_divisor_before on commit drop as
select * from public.contract_resources
where id in (
  '26d87150-180e-4b51-8d73-4a6625f3e983',
  '15bc3b54-483f-48cc-9c87-4427ea8a1093',
  'd55db111-935f-464f-a3ee-8780dffdc644'
);

do $$
begin
  if (select count(*) from verified_divisor_before) <> 3 then
    raise exception 'Expected exactly three verified resource rows';
  end if;
  if not exists (select 1 from public.billing_day_bases where code='ACTUAL_DAYS')
     or not exists (select 1 from public.billing_day_bases where code='FIXED_26') then
    raise exception 'Required billing day masters are missing';
  end if;
end $$;

update public.contract_resources
set billing_day_base_id=(select id from public.billing_day_bases where code='ACTUAL_DAYS')
where id in ('26d87150-180e-4b51-8d73-4a6625f3e983','15bc3b54-483f-48cc-9c87-4427ea8a1093');

update public.contract_resources
set billing_day_base_id=(select id from public.billing_day_bases where code='FIXED_26')
where id='d55db111-935f-464f-a3ee-8780dffdc644';

-- Executable regression checks: both concrete divisors and all untouched fields.
do $$
begin
  if (select count(*) from public.contract_resources r
      join public.billing_day_bases b on b.id=r.billing_day_base_id
      where r.id in ('26d87150-180e-4b51-8d73-4a6625f3e983','15bc3b54-483f-48cc-9c87-4427ea8a1093')
        and b.code='ACTUAL_DAYS') <> 2 then
    raise exception 'Helvoet must bill by calendar-month days';
  end if;
  if not exists (select 1 from public.contract_resources r
      join public.billing_day_bases b on b.id=r.billing_day_base_id
      where r.id='d55db111-935f-464f-a3ee-8780dffdc644' and b.code='FIXED_26') then
    raise exception 'Franklin guard must bill using 26 days';
  end if;
  if exists (select 1 from verified_divisor_before old
      join public.contract_resources r using(id)
      where (to_jsonb(old)-'billing_day_base_id'-'updated_at')
          is distinct from (to_jsonb(r)-'billing_day_base_id'-'updated_at')) then
    raise exception 'Billing-only correction modified another resource field';
  end if;
end $$;

commit;