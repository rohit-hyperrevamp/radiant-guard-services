-- Case Desk: hearing reminders (configurable schedule), hearing diary, money tracking per case.
CREATE TABLE IF NOT EXISTS public.legal_hearing_alert_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  days_before integer[] NOT NULL DEFAULT '{7,3,1,0}',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.legal_hearing_alert_settings TO authenticated;
GRANT ALL ON public.legal_hearing_alert_settings TO service_role;
ALTER TABLE public.legal_hearing_alert_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lhas read" ON public.legal_hearing_alert_settings;
CREATE POLICY "lhas read" ON public.legal_hearing_alert_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lhas write" ON public.legal_hearing_alert_settings;
CREATE POLICY "lhas write" ON public.legal_hearing_alert_settings FOR ALL TO authenticated
  USING ((SELECT public.is_admin_user()) OR (SELECT public.current_user_role_key()) = 'leadership'
         OR (SELECT public.current_user_module_access('legal_cases','edit')))
  WITH CHECK ((SELECT public.is_admin_user()) OR (SELECT public.current_user_role_key()) = 'leadership'
         OR (SELECT public.current_user_module_access('legal_cases','edit')));
INSERT INTO public.legal_hearing_alert_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.legal_case_hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.legal_cases(id) ON DELETE CASCADE,
  hearing_on date NOT NULL,
  hearing_time time,
  court_name text,
  judge text,
  purpose text,
  attended_by text,
  proceedings text,
  order_passed text,
  next_hearing_on date,
  next_hearing_time time,
  next_purpose text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_case_hearings_case_idx ON public.legal_case_hearings(case_id, hearing_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_case_hearings TO authenticated;
GRANT ALL ON public.legal_case_hearings TO service_role;
ALTER TABLE public.legal_case_hearings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lch view" ON public.legal_case_hearings FOR SELECT TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','view')));
CREATE POLICY "lch insert" ON public.legal_case_hearings FOR INSERT TO authenticated WITH CHECK ((SELECT public.current_user_module_access('legal_cases','edit')));
CREATE POLICY "lch update" ON public.legal_case_hearings FOR UPDATE TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','edit')));
CREATE POLICY "lch delete" ON public.legal_case_hearings FOR DELETE TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','delete')));
CREATE TRIGGER legal_case_hearings_updated BEFORE UPDATE ON public.legal_case_hearings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER zz_audit AFTER INSERT OR DELETE OR UPDATE ON public.legal_case_hearings FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Case Desk');

CREATE TABLE IF NOT EXISTS public.legal_case_money (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.legal_cases(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'claim',
  direction text NOT NULL DEFAULT 'payable',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  entry_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_case_money_case_idx ON public.legal_case_money(case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_case_money TO authenticated;
GRANT ALL ON public.legal_case_money TO service_role;
ALTER TABLE public.legal_case_money ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lcm view" ON public.legal_case_money FOR SELECT TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','view')));
CREATE POLICY "lcm insert" ON public.legal_case_money FOR INSERT TO authenticated WITH CHECK ((SELECT public.current_user_module_access('legal_cases','edit')));
CREATE POLICY "lcm update" ON public.legal_case_money FOR UPDATE TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','edit')));
CREATE POLICY "lcm delete" ON public.legal_case_money FOR DELETE TO authenticated USING ((SELECT public.current_user_module_access('legal_cases','delete')));
CREATE TRIGGER legal_case_money_updated BEFORE UPDATE ON public.legal_case_money FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER zz_audit AFTER INSERT OR DELETE OR UPDATE ON public.legal_case_money FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('Case Desk');

-- Who gets hearing reminders: anyone with Case Desk view (Access Control decides), plus the case's owner/representative.
CREATE OR REPLACE FUNCTION public.send_legal_hearing_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer; _days integer[]; _on boolean;
BEGIN
  SELECT days_before, enabled INTO _days, _on FROM public.legal_hearing_alert_settings LIMIT 1;
  IF _days IS NULL THEN _days := '{7,3,1,0}'; END IF;
  IF _on IS FALSE THEN RETURN 0; END IF;
  WITH due AS (
    SELECT lc.id, lc.case_number, lc.title, lc.court_or_authority, lc.next_hearing_on, lc.next_hearing_time,
           lc.owner_id, lc.representative_id,
           (lc.next_hearing_on - (now() AT TIME ZONE 'Asia/Kolkata')::date) AS days_left
      FROM public.legal_cases lc
     WHERE lc.status <> 'closed' AND lc.next_hearing_on IS NOT NULL
       AND (lc.next_hearing_on - (now() AT TIME ZONE 'Asia/Kolkata')::date) = ANY(_days)
  ),
  people AS (
    SELECT c.id AS cid, au.id AS user_id, c.role_key
      FROM public.candidates c
      JOIN auth.users au ON au.email = 'phone-' || c.mobile || '@radiantguard.local'
     WHERE COALESCE(c.status,'') = 'active'
  ),
  viewers AS (
    SELECT p.* FROM people p
     WHERE p.role_key IN ('admin','super_admin')
        OR EXISTS (SELECT 1 FROM public.effective_permissions_for(p.cid) e
                    WHERE e.module_key = 'legal_cases' AND e.can_view)
  ),
  pairs AS (
    SELECT DISTINCT p.user_id, d.* FROM due d JOIN people p
      ON p.cid IN (d.owner_id, d.representative_id) OR p.cid IN (SELECT cid FROM viewers)
  ),
  ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, entity_type, entity_id)
    SELECT pr.user_id, 'legal_hearing:' || pr.days_left,
           CASE WHEN pr.days_left = 0 THEN 'Hearing today'
                WHEN pr.days_left = 1 THEN 'Hearing tomorrow'
                ELSE 'Hearing in ' || pr.days_left || ' days' END,
           COALESCE(pr.case_number || ' – ', '') || COALESCE(pr.title, 'Case')
             || COALESCE(' · ' || pr.court_or_authority, '')
             || ' · ' || to_char(pr.next_hearing_on, 'DD Mon YYYY')
             || COALESCE(' at ' || to_char(pr.next_hearing_time, 'HH12:MI AM'), ''),
           '/admin/cases?case=' || pr.id::text, 'legal_case', pr.id::text
      FROM pairs pr
     WHERE NOT EXISTS (SELECT 1 FROM public.notifications x
                        WHERE x.user_id = pr.user_id AND x.entity_id = pr.id::text
                          AND x.type = 'legal_hearing:' || pr.days_left
                          AND x.created_at > now() - interval '20 hours')
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_legal_hearing_alerts() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('legal-hearing-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'legal-hearing-alerts');
SELECT cron.schedule('legal-hearing-alerts', '0 2 * * *', 'SELECT public.send_legal_hearing_alerts();');
