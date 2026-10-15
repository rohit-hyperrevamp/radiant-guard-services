-- Extra Duty base per contract role: selected components (default), full-month gross, or earned gross.
alter table public.contract_resources add column if not exists ot_basis text not null default 'components';
alter table public.contract_resources drop constraint if exists contract_resources_ot_basis_chk;
alter table public.contract_resources add constraint contract_resources_ot_basis_chk check (ot_basis in ('components','gross','earned_gross'));
