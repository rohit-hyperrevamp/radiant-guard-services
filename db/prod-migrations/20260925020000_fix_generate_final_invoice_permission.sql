CREATE OR REPLACE FUNCTION public.generate_final_invoice(_unit_ids uuid[], _period_start date, _period_end date, _invoice_date date DEFAULT CURRENT_DATE, _billing_state text DEFAULT NULL::text, _client_token text DEFAULT NULL::text, _customer_id uuid DEFAULT NULL::uuid, _party_name text DEFAULT NULL::text, _taxable_value numeric DEFAULT 0, _tax_total numeric DEFAULT 0, _total_value numeric DEFAULT 0)
 RETURNS TABLE(invoice_no text, sequence integer, fiscal_year text, month_code text, state_code text, final_invoice_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  fy text; mc text; sc text; tok text; nxt integer; num text;
  prefix text; padding integer; fid uuid; rid uuid; states text[];
begin
  if not (current_user_has_permission('invoice', '', 'edit') or current_user_has_permission('invoicing', '', 'edit')) then
    raise exception 'Not allowed to generate invoices';
  end if;

  if _unit_ids is null or array_length(_unit_ids, 1) is null then
    raise exception 'Select at least one site';
  end if;

  -- Single-state lock across the selected units (and the requested state).
  select array_agg(distinct s) into states
    from (
      select lower(btrim(coalesce(u.billing_state, ''))) as s
        from units u where u.id = any(_unit_ids)
      union
      select lower(btrim(coalesce(_billing_state, '')))
    ) q
   where s <> '';
  if coalesce(array_length(states, 1), 0) > 1 then
    raise exception 'An invoice cannot cover multiple states (%). Generate one invoice per state.',
      array_to_string(states, ', ');
  end if;

  if exists (
    select 1 from final_invoice_units fu
     where fu.unit_id = any(_unit_ids)
       and fu.period_start = _period_start
       and fu.period_end = _period_end
  ) then
    raise exception 'A final invoice already exists for one of the selected sites in this period';
  end if;

  fy := invoice_fiscal_year(_invoice_date);
  mc := invoice_month_code(_invoice_date);
  sc := resolve_invoice_series_state(_billing_state, fy);
  tok := nullif(upper(btrim(coalesce(_client_token, ''))), '');

  select s.number_prefix, s.seq_padding, s.last_sequence + 1
    into prefix, padding, nxt
    from invoice_number_series s
   where s.state_code = sc and s.fiscal_year = fy
   for update;

  if nxt is null then
    raise exception 'No invoice number series configured for % %', sc, fy;
  end if;

  num := build_invoice_number(prefix, mc, fy, tok, nxt, padding);

  update invoice_number_series
     set last_sequence = nxt, updated_at = now()
   where state_code = sc and fiscal_year = fy;

  insert into invoice_number_registry (
    state_code, fiscal_year, month_code, sequence, invoice_no, client_token,
    party_name, unit_id, issued_on, source, created_by
  ) values (
    sc, fy, mc, nxt, num, tok, _party_name, _unit_ids[1], _invoice_date, 'system', auth.uid()
  ) returning id into rid;

  insert into final_invoices (
    invoice_no, state_code, fiscal_year, month_code, sequence, client_token,
    customer_id, party_name, billing_state, invoice_date, period_start, period_end,
    taxable_value, tax_total, total_value, registry_id, generated_by
  ) values (
    num, sc, fy, mc, nxt, tok, _customer_id, _party_name, _billing_state, _invoice_date,
    _period_start, _period_end, _taxable_value, _tax_total, _total_value, rid, auth.uid()
  ) returning id into fid;

  insert into final_invoice_units (final_invoice_id, unit_id, period_start, period_end)
  select fid, u, _period_start, _period_end from unnest(_unit_ids) u;

  return query select num, nxt, fy, mc, sc, fid;
end;
$function$

;
