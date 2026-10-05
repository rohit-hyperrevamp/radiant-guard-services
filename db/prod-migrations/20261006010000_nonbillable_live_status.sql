-- Live roster of non-billable staff (excluding field officers): sign-in + today's check-in.
create or replace function public.nonbillable_live_status(_date date default (now() at time zone 'Asia/Kolkata')::date)
returns table(
  candidate_id uuid, user_id uuid, full_name text, employee_code text, mobile text,
  role_key text, department text, designation text, unit_name text,
  last_sign_in_at timestamptz, check_in_at timestamptz, check_out_at timestamptz, last_seen_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select c.id, au.id, c.full_name, c.employee_code, c.mobile, c.role_key,
         d.name, g.name, u.name,
         au.last_sign_in_at, p.check_in_at, p.check_out_at, p.last_seen_at
  from candidates c
  join units u on u.id = c.unit_id and u.is_billable = false
  left join departments d on d.id = c.department_id
  left join designations g on g.id = c.designation_id
  left join auth.users au on au.email = 'phone-' || c.mobile || '@radiantguard.local'
  left join self_attendance_punches p on p.candidate_id = c.id and p.punch_date = _date
  where c.status in ('approved','active')
    and coalesce(c.role_key,'') <> 'field_officer'
    and (public.is_admin_user() or public.current_user_module_access('employees','view'))
  order by c.full_name;
$$;
revoke all on function public.nonbillable_live_status(date) from public, anon;
grant execute on function public.nonbillable_live_status(date) to authenticated;
