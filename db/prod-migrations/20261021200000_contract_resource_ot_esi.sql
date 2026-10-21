-- Optional ESI on Extra Duty per contract role (client exception); formulas picked from Cost Component Manager.
alter table public.contract_resources add column if not exists ot_esi jsonb;
notify pgrst, 'reload schema';
