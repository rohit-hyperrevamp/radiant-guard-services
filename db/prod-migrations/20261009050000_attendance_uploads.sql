create table if not exists public.attendance_uploads (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  period_start date,
  period_end date,
  path text not null,
  file_name text not null,
  mime text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists attendance_uploads_unit_idx on public.attendance_uploads(unit_id, period_start);
grant select, insert, delete on public.attendance_uploads to authenticated;
grant all on public.attendance_uploads to service_role;
alter table public.attendance_uploads enable row level security;
drop policy if exists att_uploads_select on public.attendance_uploads;
create policy att_uploads_select on public.attendance_uploads for select to authenticated
  using ((select public.current_user_module_access('attendance','view')) or public.current_user_can_manage_attendance_unit(unit_id));
drop policy if exists att_uploads_insert on public.attendance_uploads;
create policy att_uploads_insert on public.attendance_uploads for insert to authenticated
  with check ((select public.current_user_module_access('attendance','view')) or public.current_user_can_manage_attendance_unit(unit_id));
insert into storage.buckets(id,name,public) values ('attendance-uploads','attendance-uploads',false) on conflict (id) do nothing;
drop policy if exists att_uploads_obj_read on storage.objects;
create policy att_uploads_obj_read on storage.objects for select to authenticated using (bucket_id='attendance-uploads');
drop policy if exists att_uploads_obj_write on storage.objects;
create policy att_uploads_obj_write on storage.objects for insert to authenticated with check (bucket_id='attendance-uploads');
