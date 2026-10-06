-- Rename the second invoice part from "OT+Night" to "OT+Reliever".
--
-- Why: this part collects Extra Duty (ED) and reliever duties, never night-shift
-- days, so "OT+Night" mislabelled it in front of the client. The name is stored
-- per client in customers.invoice_split (parts[].label) and is copied onto
-- final_invoices.part_label when an invoice is finalised.

update customers
set invoice_split = jsonb_set(
  invoice_split,
  '{parts}',
  (
    select jsonb_agg(
      case
        when lower(trim(p ->> 'label')) in ('ot+night', 'ot + night', 'ot and night', 'ot & night')
          then jsonb_set(p, '{label}', '"OT+Reliever"')
        else p
      end
      order by ord
    )
    from jsonb_array_elements(invoice_split -> 'parts') with ordinality as t(p, ord)
  )
)
where invoice_split ? 'parts'
  and exists (
    select 1
    from jsonb_array_elements(invoice_split -> 'parts') p
    where lower(trim(p ->> 'label')) in ('ot+night', 'ot + night', 'ot and night', 'ot & night')
  );

-- Keep already-finalised invoice records in step with the new name.
update final_invoices
set part_label = 'OT+Reliever'
where lower(trim(coalesce(part_label, ''))) in ('ot+night', 'ot + night', 'ot and night', 'ot & night');
