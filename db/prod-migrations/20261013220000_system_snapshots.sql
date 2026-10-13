-- Full-system snapshots: copy every public table into its own schema and
-- restore them on demand (Control Center > System Backups). Super admin only.
create table if not exists public.system_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  schema_name text not null unique,
  table_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid
);
grant select on public.system_snapshots to authenticated;
grant all on public.system_snapshots to service_role;
alter table public.system_snapshots enable row level security;
drop policy if exists "admins read snapshots" on public.system_snapshots;
create policy "admins read snapshots" on public.system_snapshots for select to authenticated
  using (public.current_user_role_key() = 'super_admin');

create or replace function public.create_system_snapshot(_label text)
returns uuid language plpgsql security definer set search_path = public
set statement_timeout = 0 as $$
declare s text; t record; n int := 0; new_id uuid;
begin
  if auth.uid() is not null and public.current_user_role_key() <> 'super_admin' then
    raise exception 'Only Super Admin can create backups';
  end if;
  s := 'snap_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
  execute format('create schema %I', s);
  for t in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'public' and c.relkind = 'r'
             and c.relname not like '\_bkp%' and c.relname <> 'system_snapshots' loop
    execute format('create table %I.%I as table public.%I', s, t.relname, t.relname);
    n := n + 1;
  end loop;
  insert into public.system_snapshots(label, schema_name, table_count, created_by)
  values (coalesce(nullif(_label, ''), s), s, n, auth.uid()) returning id into new_id;
  return new_id;
end $$;

create or replace function public.restore_system_snapshot(_id uuid)
returns integer language plpgsql security definer set search_path = public
set statement_timeout = 0 as $$
declare s text; t record; n int := 0; cols text;
begin
  if auth.uid() is null or public.current_user_role_key() <> 'super_admin' then
    raise exception 'Only Super Admin can restore backups';
  end if;
  select schema_name into s from public.system_snapshots where id = _id;
  if s is null then raise exception 'Backup not found'; end if;
  set local session_replication_role = replica;
  for t in select table_name from information_schema.tables
           where table_schema = s and table_type = 'BASE TABLE' loop
    if to_regclass(format('public.%I', t.table_name)) is null then continue; end if;
    select string_agg(format('%I', sc.column_name), ',') into cols
      from information_schema.columns sc
      join information_schema.columns pc on pc.table_schema = 'public' and pc.table_name = sc.table_name
        and pc.column_name = sc.column_name and pc.is_generated = 'NEVER'
     where sc.table_schema = s and sc.table_name = t.table_name;
    execute format('delete from public.%I', t.table_name);
    execute format('insert into public.%I (%s) select %s from %I.%I', t.table_name, cols, cols, s, t.table_name);
    n := n + 1;
  end loop;
  update public.system_snapshots set restored_at = now(), restored_by = auth.uid() where id = _id;
  return n;
end $$;

revoke all on function public.create_system_snapshot(text) from public, anon;
revoke all on function public.restore_system_snapshot(uuid) from public, anon;
grant execute on function public.create_system_snapshot(text) to authenticated;
grant execute on function public.restore_system_snapshot(uuid) to authenticated;
