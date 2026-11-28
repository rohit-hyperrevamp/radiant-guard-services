-- Attendance Card: the client-signed attendance card / muster roll a site's attendance sheet
-- was checked against, viewable from that sheet (like Contract Copy on contracts).
-- Files live in the private `attendance-cards` bucket and open through short-lived signed
-- links; a card is readable only by someone who can already see that unit and holds
-- Attendance view access. Upload needs Attendance edit.

create table if not exists public.attendance_card_copies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  storage_path text not null,
  file_name text not null,
  sources jsonb not null default '[]'::jsonb,
  check_status text,            -- e.g. 'match' when every person's card total equals the sheet
  check_summary jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (unit_id, period_start, period_end, storage_path)
);
create index if not exists attendance_card_copies_unit_idx on public.attendance_card_copies(unit_id, period_start, period_end);
create index if not exists attendance_card_copies_path_idx on public.attendance_card_copies(storage_path);

alter table public.attendance_card_copies enable row level security;

drop policy if exists "attendance cards read" on public.attendance_card_copies;
create policy "attendance cards read" on public.attendance_card_copies for select to authenticated
  using (
    (select public.current_user_module_access('attendance','view'))
    and exists (select 1 from public.units u where u.id = attendance_card_copies.unit_id)
  );
drop policy if exists "attendance cards write" on public.attendance_card_copies;
create policy "attendance cards write" on public.attendance_card_copies for insert to authenticated
  with check (
    (select public.current_user_module_access('attendance','edit'))
    and exists (select 1 from public.units u where u.id = attendance_card_copies.unit_id)
  );
drop policy if exists "attendance cards delete" on public.attendance_card_copies;
create policy "attendance cards delete" on public.attendance_card_copies for delete to authenticated
  using (
    (select public.current_user_module_access('attendance','delete'))
    and exists (select 1 from public.units u where u.id = attendance_card_copies.unit_id)
  );

drop trigger if exists zz_audit on public.attendance_card_copies;
create trigger zz_audit after insert or update or delete on public.attendance_card_copies
  for each row execute function public.audit_row_change('Attendance Card');

insert into storage.buckets (id, name, public) values ('attendance-cards','attendance-cards', false)
  on conflict (id) do nothing;

-- A file is readable only through an attendance card row the caller can see.
drop policy if exists "attendance cards files read" on storage.objects;
create policy "attendance cards files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance-cards'
    and exists (select 1 from public.attendance_card_copies cp where cp.storage_path = storage.objects.name)
  );
drop policy if exists "attendance cards files write" on storage.objects;
create policy "attendance cards files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-cards' and (select public.current_user_module_access('attendance','edit')));
