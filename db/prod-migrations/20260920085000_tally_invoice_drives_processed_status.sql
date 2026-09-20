-- A client invoice is processed only when its actual Tally invoice is uploaded.
-- Keep the persisted register status synchronized for every write path.
CREATE OR REPLACE FUNCTION public.sync_tally_invoice_processed_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payroll_runs (
    unit_id,
    period_start,
    period_end,
    status,
    invoice_status,
    invoice_processed_at,
    invoice_processed_by
  )
  VALUES (
    NEW.unit_id,
    NEW.period_start,
    NEW.period_end,
    'draft',
    CASE WHEN NEW.tally_invoice_path IS NOT NULL THEN 'processed' ELSE 'open' END,
    CASE WHEN NEW.tally_invoice_path IS NOT NULL THEN COALESCE(NEW.tally_invoice_uploaded_at, now()) END,
    CASE WHEN NEW.tally_invoice_path IS NOT NULL THEN NEW.tally_invoice_uploaded_by END
  )
  ON CONFLICT (unit_id, period_start, period_end) DO UPDATE
  SET invoice_status = EXCLUDED.invoice_status,
      invoice_processed_at = EXCLUDED.invoice_processed_at,
      invoice_processed_by = EXCLUDED.invoice_processed_by,
      updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_sheet_sync_tally_invoice_status ON public.attendance_sheets;
CREATE TRIGGER attendance_sheet_sync_tally_invoice_status
AFTER INSERT OR UPDATE OF tally_invoice_path, tally_invoice_uploaded_at, tally_invoice_uploaded_by
ON public.attendance_sheets
FOR EACH ROW
EXECUTE FUNCTION public.sync_tally_invoice_processed_status();

UPDATE public.payroll_runs AS run
SET invoice_status = CASE
      WHEN sheet.tally_invoice_path IS NOT NULL THEN 'processed'
      ELSE 'open'
    END,
    invoice_processed_at = CASE
      WHEN sheet.tally_invoice_path IS NOT NULL THEN COALESCE(sheet.tally_invoice_uploaded_at, now())
      ELSE NULL
    END,
    invoice_processed_by = CASE
      WHEN sheet.tally_invoice_path IS NOT NULL THEN sheet.tally_invoice_uploaded_by
      ELSE NULL
    END,
    updated_at = now()
FROM public.attendance_sheets AS sheet
WHERE sheet.unit_id = run.unit_id
  AND sheet.period_start = run.period_start
  AND sheet.period_end = run.period_end;

UPDATE public.payroll_runs AS run
SET invoice_status = 'open',
    invoice_processed_at = NULL,
    invoice_processed_by = NULL,
    updated_at = now()
WHERE invoice_status = 'processed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.attendance_sheets AS sheet
    WHERE sheet.unit_id = run.unit_id
      AND sheet.period_start = run.period_start
      AND sheet.period_end = run.period_end
      AND sheet.tally_invoice_path IS NOT NULL
  );