update public.units set zone='Zone II', updated_at=now() where code='CLI3885' and zone is null;
