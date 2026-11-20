-- Readback assertions: no attendance rows are created or changed.
BEGIN;
DO $$
DECLARE c public.candidates%rowtype; r record;
BEGIN
 SELECT * INTO STRICT c FROM public.candidates WHERE id='32120a43-ce80-4fb1-a1e0-1e9fe819eee6';
 IF c.mobile IS DISTINCT FROM '9156657381' OR nullif(c.personal_mobile,'') IS NOT NULL THEN
   RAISE EXCEPTION 'Official-only phone requirement failed';
 END IF;
 IF c.unit_id IS DISTINCT FROM '0889cfb4-7fd6-44b4-bbac-7d7026e33f0f'::uuid THEN
   RAISE EXCEPTION 'Payroll home changed';
 END IF;
 SELECT * INTO STRICT r FROM public.attendance_location_rule_for(c.id);
 IF r.mode IS DISTINCT FROM 'anywhere' OR r.source IS DISTINCT FROM 'person' THEN
   RAISE EXCEPTION 'Employee-only distance exemption missing';
 END IF;
 IF NOT public.can_phone_login('9156657381') THEN RAISE EXCEPTION 'Official phone cannot sign in'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.employee_scope_assignments WHERE candidate_id=c.id AND scope_type='branch' AND scope_id='19039997-68ee-4414-a587-e8e8d38428e6') THEN
   RAISE EXCEPTION 'Hyderabad/Telangana regional scope missing';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='f5a06387-967f-445e-b0ce-7603bd0bbb45' AND email='phone-9156657381@radiantguard.local') THEN
   RAISE EXCEPTION 'Existing account not aligned to official number';
 END IF;
END $$;
ROLLBACK;