-- Per-posting duty length: at units whose contract has both 8h and 12h lines,
-- the guard's posting says which one applies, so billing/payroll pick that rate.
alter table public.candidate_units add column if not exists shift_hours smallint;
alter table public.candidate_units drop constraint if exists candidate_units_shift_hours_chk;
alter table public.candidate_units add constraint candidate_units_shift_hours_chk check (shift_hours is null or shift_hours in (8,12));
