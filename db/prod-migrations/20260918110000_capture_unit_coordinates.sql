-- Field officers can only mark a site visit while physically at the site.
-- Sites without coordinates are allowed once, and the officer's on-site GPS
-- reading is stored on the unit as the future source of truth.

alter table public.units
  add column if not exists coordinates_source text,
  add column if not exists coordinates_captured_by uuid,
  add column if not exists coordinates_captured_at timestamptz,
  add column if not exists coordinates_accuracy_m numeric;

create or replace function public.capture_unit_coordinates(
  _unit_id uuid,
  _lat numeric,
  _lng numeric,
  _accuracy numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _candidate_id uuid;
  _has_coords boolean;
  _allowed boolean;
begin
  if _lat is null or _lng is null then
    return false;
  end if;
  if _lat < -90 or _lat > 90 or _lng < -180 or _lng > 180 then
    return false;
  end if;

  select latitude is not null and longitude is not null
    into _has_coords
    from public.units
   where id = _unit_id;

  if _has_coords is null or _has_coords then
    -- unknown unit, or already has a source of truth: never overwrite
    return false;
  end if;

  _candidate_id := public.current_user_candidate_id();
  if _candidate_id is null then
    return false;
  end if;

  select exists (
    select 1 from public.candidate_units cu
     where cu.candidate_id = _candidate_id and cu.unit_id = _unit_id
    union all
    select 1 from public.candidates c
     where c.id = _candidate_id and c.unit_id = _unit_id
  ) into _allowed;

  if not coalesce(_allowed, false) then
    return false;
  end if;

  update public.units
     set latitude = round(_lat, 7),
         longitude = round(_lng, 7),
         coordinates_source = 'field_officer_visit',
         coordinates_captured_by = _candidate_id,
         coordinates_captured_at = now(),
         coordinates_accuracy_m = _accuracy
   where id = _unit_id
     and latitude is null
     and longitude is null;

  return found;
end;
$$;

revoke all on function public.capture_unit_coordinates(uuid, numeric, numeric, numeric) from public;
grant execute on function public.capture_unit_coordinates(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.capture_unit_coordinates(uuid, numeric, numeric, numeric) to service_role;
