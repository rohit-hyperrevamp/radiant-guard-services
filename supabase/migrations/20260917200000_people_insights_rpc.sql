create or replace function public.people_insights(
  p_unit_ids uuid[] default null,
  p_days int default 45,
  p_sixty boolean default false,
  p_limit int default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with base as (
  select c.id,
         c.full_name,
         c.photo_url,
         c.mobile,
         c.date_of_birth,
         coalesce(c.approved_at, c.created_at) as started_at,
         c.unit_id,
         c.designation_id,
         coalesce(nullif(u.name,''), u.code) as unit_name,
         d.name as designation_name
    from candidates c
    left join units u on u.id = c.unit_id
    left join designations d on d.id = c.designation_id
   where c.status in ('approved','active')
     and c.date_of_birth is not null
     and (p_unit_ids is null or c.unit_id = any(p_unit_ids))
), dated as (
  select b.*,
         (date_trunc('day', current_date))::date as today,
         make_date(
           extract(year from current_date)::int,
           extract(month from b.date_of_birth)::int,
           case when extract(month from b.date_of_birth)::int = 2
                 and extract(day from b.date_of_birth)::int = 29
                then 28 else extract(day from b.date_of_birth)::int end
         ) as bd_this_year,
         case when b.started_at is null then null else
           make_date(
             extract(year from current_date)::int,
             extract(month from b.started_at)::int,
             case when extract(month from b.started_at)::int = 2
                   and extract(day from b.started_at)::int = 29
                  then 28 else extract(day from b.started_at)::int end
           ) end as ann_this_year
    from base b
), calc as (
  select d.*,
         case when d.bd_this_year < current_date then d.bd_this_year + interval '1 year' else d.bd_this_year end::date as next_bd,
         case when d.ann_this_year is null then null
              when d.ann_this_year < current_date then (d.ann_this_year + interval '1 year')::date
              else d.ann_this_year end as next_ann
    from dated d
), final as (
  select c.*,
         (c.next_bd - current_date) as bd_days,
         case when c.next_ann is null then null else (c.next_ann - current_date) end as ann_days,
         extract(year from age(current_date, c.date_of_birth))::int as age,
         extract(year from age(c.next_bd, c.date_of_birth))::int as turning_age,
         case when c.started_at is null then null else extract(year from age(c.next_ann, c.started_at))::int end as years
    from calc c
)
select jsonb_build_object(
  'birthdays', coalesce((
     select jsonb_agg(x order by x->>'daysUntil')
       from (
         select jsonb_build_object(
                  'id', id, 'full_name', full_name, 'photo_url', photo_url, 'mobile', mobile,
                  'date_of_birth', date_of_birth, 'unit_id', unit_id, 'designation_id', designation_id,
                  'unit_name', coalesce(unit_name,''), 'designation_name', coalesce(designation_name,''),
                  'daysUntil', bd_days, 'nextDate', next_bd, 'turningAge', turning_age) as x
           from final
          where bd_days <= p_days
          order by bd_days, full_name
          limit p_limit
       ) s), '[]'::jsonb),
  'anniversaries', coalesce((
     select jsonb_agg(x)
       from (
         select jsonb_build_object(
                  'id', id, 'full_name', full_name, 'photo_url', photo_url, 'mobile', mobile,
                  'date_of_birth', date_of_birth, 'unit_id', unit_id, 'designation_id', designation_id,
                  'unit_name', coalesce(unit_name,''), 'designation_name', coalesce(designation_name,''),
                  'daysUntil', ann_days, 'nextDate', next_ann, 'years', years) as x
           from final
          where ann_days is not null and ann_days <= p_days and years >= 1
          order by ann_days, years desc
          limit p_limit
       ) s), '[]'::jsonb),
  'sixtyPlus', case when not p_sixty then '[]'::jsonb else coalesce((
     select jsonb_agg(x)
       from (
         select jsonb_build_object(
                  'id', id, 'full_name', full_name, 'photo_url', photo_url, 'mobile', mobile,
                  'date_of_birth', date_of_birth, 'unit_id', unit_id, 'designation_id', designation_id,
                  'unit_name', coalesce(unit_name,''), 'designation_name', coalesce(designation_name,''),
                  'age', age) as x
           from final
          where age >= 60
          order by age desc, full_name
          limit p_limit
       ) s), '[]'::jsonb) end
);
$$;

grant execute on function public.people_insights(uuid[], int, boolean, int) to authenticated;
