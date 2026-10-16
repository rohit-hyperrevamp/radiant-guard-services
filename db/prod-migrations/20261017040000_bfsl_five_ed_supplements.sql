-- Remove duplicate Extra Duty billing on five BFSL Sep-2026 invoices.
-- Supplement = issued invoice taxable - (rounded day rate x rounded duties) from current invoice logic.
-- Guarded on the exact prior row; attendance, contract rates and salaries untouched.
begin;
do $$
declare n int; t int := 0;
begin
  update public.invoice_extra_charges set rate=1186.71, description='Extra Duty supplement - SEP26-27BFSL2978 (documented double-rate billing, existing ED billed once)' where id='1a2c26e3-0b64-47f7-82e3-71bfeba56d0f' and quantity=1 and rate=2231.76 and enabled and description='Increment / OT as per BFSL MIS Sep-2026'; get diagnostics n=row_count; t:=t+n;
  update public.invoice_extra_charges set rate=221.83, description='Extra Duty supplement - SEP26-27BFSL2991 (documented double-rate billing, existing ED billed once)' where id='27d3613a-12de-44d2-a833-4fd816f03065' and quantity=1 and rate=415.84 and enabled and description='Increment / OT as per BFSL MIS Sep-2026'; get diagnostics n=row_count; t:=t+n;
  update public.invoice_extra_charges set rate=347.80, description='Extra Duty supplement - SEP26-27BFSL2987 (documented double-rate billing, existing ED billed once)' where id='2d87fc13-dbb2-4497-9275-75720fb11df3' and quantity=1 and rate=661.04 and enabled and description='Increment / OT as per BFSL MIS Sep-2026'; get diagnostics n=row_count; t:=t+n;
  update public.invoice_extra_charges set rate=386.88, description='Extra Duty supplement - SEP26-27BFSL2972 (documented double-rate billing, existing ED billed once)' where id='ab5a8039-05f1-4aef-a228-7b5dca867b74' and quantity=1 and rate=735.07 and enabled and description='Increment / OT as per BFSL MIS Sep-2026'; get diagnostics n=row_count; t:=t+n;
  update public.invoice_extra_charges set rate=875.10, description='Extra Duty supplement - SEP26-27BFSL2974 (documented double-rate billing, existing ED billed once)' where id='dac96579-5a83-4f0f-9f21-2d2af43504e0' and quantity=1 and rate=1640.79 and enabled and description='Increment / OT as per BFSL MIS Sep-2026'; get diagnostics n=row_count; t:=t+n;
  if t<>5 then raise exception 'expected 5 guarded rows, got %', t; end if;
  insert into public.system_logs(module,action,entity_type,entity_label,status,source,actor_name,details)
  values('Invoice','update','invoice_extra_charges','BFSL Sep-2026 ED supplements (5)','success','reconciliation','System (reconciliation)',
    jsonb_build_object('invoices',jsonb_build_array('SEP26-27BFSL2978','SEP26-27BFSL2991','SEP26-27BFSL2987','SEP26-27BFSL2972','SEP26-27BFSL2974'),'reduction_total',2558.48));
end $$;
commit;