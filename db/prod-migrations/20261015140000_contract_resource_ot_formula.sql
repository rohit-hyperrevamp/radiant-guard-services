alter table public.contract_resources add column if not exists ot_formula text;
alter table public.contract_resources drop constraint if exists contract_resources_ot_basis_check;
alter table public.contract_resources add constraint contract_resources_ot_basis_check check (ot_basis in ('components','gross','earned_gross','formula'));
notify pgrst, 'reload schema';
