-- Contract Copy: the client rate card / signed copy each contract was reviewed against,
-- viewable from the contract itself. Files live in the private `contract-copies` bucket and
-- open through short-lived signed links; a copy is readable only by someone who can already
-- read that contract (client_contracts RLS) and holds Contracts view access.

create table if not exists public.contract_copies (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  sources jsonb not null default '[]'::jsonb,
  review_period text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (contract_id, storage_path)
);
create index if not exists contract_copies_contract_idx on public.contract_copies(contract_id);
create index if not exists contract_copies_path_idx on public.contract_copies(storage_path);

alter table public.contract_copies enable row level security;

drop policy if exists "contract copies read" on public.contract_copies;
create policy "contract copies read" on public.contract_copies for select to authenticated
  using (
    (select public.current_user_module_access('contracts','view'))
    and exists (select 1 from public.client_contracts cc where cc.id = contract_copies.contract_id)
  );
drop policy if exists "contract copies write" on public.contract_copies;
create policy "contract copies write" on public.contract_copies for insert to authenticated
  with check (
    (select public.current_user_module_access('contracts','edit'))
    and exists (select 1 from public.client_contracts cc where cc.id = contract_copies.contract_id)
  );
drop policy if exists "contract copies delete" on public.contract_copies;
create policy "contract copies delete" on public.contract_copies for delete to authenticated
  using (
    (select public.current_user_module_access('contracts','delete'))
    and exists (select 1 from public.client_contracts cc where cc.id = contract_copies.contract_id)
  );

drop trigger if exists zz_audit on public.contract_copies;
create trigger zz_audit after insert or update or delete on public.contract_copies
  for each row execute function public.audit_row_change('Contract Copy');

insert into storage.buckets (id, name, public) values ('contract-copies','contract-copies', false)
  on conflict (id) do nothing;

-- A file is readable only through a contract copy row the caller can see.
drop policy if exists "contract copies files read" on storage.objects;
create policy "contract copies files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'contract-copies'
    and exists (select 1 from public.contract_copies cp where cp.storage_path = storage.objects.name)
  );
drop policy if exists "contract copies files write" on storage.objects;
create policy "contract copies files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-copies' and (select public.current_user_module_access('contracts','edit')));
