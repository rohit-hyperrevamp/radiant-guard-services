-- The imported sheets carried trailing empty rows, which became unused invoice
-- numbers. Trim them back to the last number actually issued per series.
begin;

delete from public.invoice_number_registry
 where (state_code = 'MH' and sequence > 2878)
    or (state_code = 'GA' and sequence > 90)
    or (state_code = 'RF' and sequence > 149)
    or (state_code = 'TS' and sequence > 65);

update public.invoice_number_series s
   set last_sequence = coalesce(
         (select max(r.sequence) from public.invoice_number_registry r
           where r.state_code = s.state_code and r.fiscal_year = s.fiscal_year), 0)
 where s.state_code in ('MH', 'GA', 'RF', 'TS');

commit;
