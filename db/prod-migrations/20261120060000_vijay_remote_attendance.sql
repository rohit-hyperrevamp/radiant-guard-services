-- Requested employee-only data correction; run against Radiant production.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id='32120a43-ce80-4fb1-a1e0-1e9fe819eee6' AND full_name='Vijay Raj Sharma' AND mobile='9156657381') THEN
    RAISE EXCEPTION 'Employee identity changed; abort';
  END IF;
END $$;
UPDATE public.candidates SET personal_mobile=NULL
WHERE id='32120a43-ce80-4fb1-a1e0-1e9fe819eee6';
INSERT INTO public.attendance_location_overrides(candidate_id,mode,notes)
VALUES ('32120a43-ce80-4fb1-a1e0-1e9fe819eee6','anywhere','Owner requested remote attendance for Hyderabad Regional Head; remove Pune HO 300m restriction for this employee only.')
ON CONFLICT(candidate_id) DO UPDATE SET mode=excluded.mode,notes=excluded.notes,updated_at=now();
INSERT INTO public.employee_scope_assignments(candidate_id,scope_type,scope_id,scope_label)
VALUES ('32120a43-ce80-4fb1-a1e0-1e9fe819eee6','branch','19039997-68ee-4414-a587-e8e8d38428e6','Telangana')
ON CONFLICT(candidate_id,scope_type,scope_id) DO NOTHING;
COMMIT;