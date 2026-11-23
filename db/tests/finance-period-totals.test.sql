BEGIN;
DO $$ DECLARE before_generation bigint; after_generation bigint; BEGIN
 IF has_table_privilege('anon','public.finance_period_totals','SELECT') THEN RAISE EXCEPTION 'Anonymous finance read grant'; END IF;
 IF has_table_privilege('authenticated','public.finance_period_totals','UPDATE') THEN RAISE EXCEPTION 'Browser finance overwrite grant'; END IF;
 IF has_function_privilege('authenticated','public.publish_finance_totals(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser publishing grant'; END IF;
 SELECT generation INTO before_generation FROM public.finance_period_totals WHERE unit_id='0b145c39-bea3-4a2c-bd6e-c9ae58752c3f' AND period_start='2026-09-01' AND period_end='2026-09-30';
 UPDATE public.attendance_entries SET code=code WHERE id=(SELECT id FROM public.attendance_entries WHERE unit_id='0b145c39-bea3-4a2c-bd6e-c9ae58752c3f' AND entry_date='2026-09-01' LIMIT 1);
 SELECT generation INTO after_generation FROM public.finance_period_totals WHERE unit_id='0b145c39-bea3-4a2c-bd6e-c9ae58752c3f' AND period_start='2026-09-01' AND period_end='2026-09-30';
 IF after_generation<>before_generation+1 THEN RAISE EXCEPTION 'Attendance change did not invalidate saved finance'; END IF;
END $$;
ROLLBACK;