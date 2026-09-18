-- HR and Finance reporting structure, mirroring what operations already has.
--   * a helper + read policy so a person can always see their own department's
--     org chart (finance has no employees permission, so without this their
--     dashboard tree would render empty)
--   * explicit reports_to links for the HR and Accounts/Finance chains
--   * candidate_reporting_managers kept in sync (source 'people_hierarchy')

create or replace function public.current_user_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.department_id
  from public.candidates c
  where c.id = public.current_user_candidate_id()
  limit 1
$$;

grant execute on function public.current_user_department_id() to authenticated, service_role;

drop policy if exists "Employees read their own department people" on public.candidates;
create policy "Employees read their own department people"
on public.candidates
for select
to authenticated
using (
  status = any (array['approved', 'active'])
  and department_id is not null
  and department_id = (select public.current_user_department_id())
);

-- ---------------------------------------------------------------- HR chain
with pairs(child, parent) as (
  values
    ('40008', '41497'),  -- Manager - HR & Compliance      -> HR Head
    ('45980', '41497'),  -- Manager - Payroll & Compliance -> HR Head
    ('48433', '45980'),  -- Assistant Manager - Payroll    -> Manager Payroll
    ('46517', '48433'),  -- Executive - Payroll            -> Asst Manager Payroll
    ('37238', '40008'),  -- Senior Executive - HR          -> Manager HR
    ('42013', '40008'),  -- Senior HR Executive            -> Manager HR
    ('42721', '37238'),
    ('46693', '37238'),
    ('32224', '37238'),
    ('29775', '37238'),
    ('43930', '37238'),
    ('38659', '37238'),
    ('46717', '37238'),
    ('48637', '42013'),  -- Junior HR Executive            -> Senior HR Executive
    -- ------------------------------------------------------- Finance chain
    ('36728', '28879'),  -- Assistant Manager   -> AGM Account & Finance
    ('25398', '36728'),
    ('41070', '36728'),
    ('33724', '36728')
),
resolved as (
  select c.id as candidate_id, m.id as manager_id
  from pairs p
  join public.candidates c on c.employee_code = p.child
  join public.candidates m on m.employee_code = p.parent
)
insert into public.candidate_reporting_managers (candidate_id, manager_id, is_primary, source)
select candidate_id, manager_id, true, 'people_hierarchy'
from resolved
on conflict (candidate_id, manager_id)
do update set is_primary = true, source = 'people_hierarchy';

update public.candidates c
set reports_to = crm.manager_id
from public.candidate_reporting_managers crm
where crm.candidate_id = c.id
  and crm.source = 'people_hierarchy'
  and crm.is_primary
  and coalesce(c.reports_to, '00000000-0000-0000-0000-000000000000'::uuid) <> crm.manager_id;
