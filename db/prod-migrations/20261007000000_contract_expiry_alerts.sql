-- Contract expiry alerts: daily in-app notifications at 15/10/5/3/2/1 days before
-- a contract ends, sent to every person who can see contracts under Access Control
-- (contracts::expiry_alerts row decides; no row = anyone with Contracts view).

CREATE OR REPLACE FUNCTION public.effective_permissions_for(_candidate_id uuid)
RETURNS TABLE(module_key text, sub_module_key text, can_view boolean, can_edit boolean, can_delete boolean, can_approve boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (
    SELECT c.id, c.role_key, c.department_id, c.designation_id FROM public.candidates c WHERE c.id = _candidate_id
  ),
  lvl AS (
    SELECT o.*, CASE
      WHEN o.scope_type = 'employee' AND o.scope_id = me.id THEN 1
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id = me.department_id THEN 2
      WHEN o.scope_type = 'designation' AND o.scope_id = me.designation_id AND o.department_id IS NULL THEN 3
      WHEN o.scope_type = 'department' AND o.scope_id = me.department_id THEN 4
    END AS lv
    FROM public.access_overrides o, me
  ),
  best AS (SELECT l.module_key, min(l.lv) AS lv FROM lvl l WHERE l.lv IS NOT NULL GROUP BY l.module_key)
  SELECT l.module_key, l.sub_module_key, l.can_view, l.can_edit, l.can_delete, l.can_approve
    FROM lvl l JOIN best b ON b.module_key = l.module_key AND b.lv = l.lv
  UNION ALL
  SELECT rp.module_key, rp.sub_module_key, rp.can_view, rp.can_edit, rp.can_delete, rp.can_approve
    FROM public.role_permissions rp JOIN me ON rp.role_key = me.role_key
   WHERE NOT EXISTS (SELECT 1 FROM best b WHERE b.module_key = rp.module_key);
$$;
REVOKE ALL ON FUNCTION public.effective_permissions_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.candidate_gets_contract_expiry_alerts(_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN (SELECT role_key FROM public.candidates WHERE id = _candidate_id) IN ('admin','super_admin') THEN
      COALESCE((SELECT p.can_view FROM public.effective_permissions_for(_candidate_id) p
                 WHERE p.module_key='contracts' AND p.sub_module_key='expiry_alerts' LIMIT 1), true)
    ELSE COALESCE(
      (SELECT p.can_view FROM public.effective_permissions_for(_candidate_id) p
        WHERE p.module_key='contracts' AND p.sub_module_key='expiry_alerts' LIMIT 1),
      EXISTS (SELECT 1 FROM public.effective_permissions_for(_candidate_id) p
               WHERE p.module_key='contracts' AND p.can_view))
  END;
$$;
REVOKE ALL ON FUNCTION public.candidate_gets_contract_expiry_alerts(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_contract_expiry_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  WITH due AS (
    SELECT cc.id, cc.contract_code, cc.unit_id, COALESCE(cc.end_date, cc.expiry_date) AS ends,
           (COALESCE(cc.end_date, cc.expiry_date) - (now() AT TIME ZONE 'Asia/Kolkata')::date) AS days_left,
           u.name AS unit_name, u.code AS unit_code, cu.name AS org_name, u.customer_id
      FROM public.client_contracts cc
      JOIN public.units u ON u.id = cc.unit_id
      LEFT JOIN public.customers cu ON cu.id = u.customer_id
     WHERE cc.record_type = 'contract' AND cc.status = 'active'
       AND COALESCE(cc.end_date, cc.expiry_date) IS NOT NULL
       AND (COALESCE(cc.end_date, cc.expiry_date) - (now() AT TIME ZONE 'Asia/Kolkata')::date) IN (15,10,5,3,2,1)
  ),
  people AS (
    SELECT c.id AS cid, au.id AS user_id, c.role_key, c.unit_id
      FROM public.candidates c
      JOIN auth.users au ON au.email = 'phone-' || c.mobile || '@radiantguard.local'
     WHERE COALESCE(c.status,'') = 'active' AND public.candidate_gets_contract_expiry_alerts(c.id)
  ),
  pairs AS (
    SELECT p.user_id, d.* FROM people p JOIN due d ON
      p.role_key <> 'hr_executive'
      OR d.unit_id = p.unit_id
      OR d.unit_id IN (SELECT cu2.unit_id FROM public.candidate_units cu2 WHERE cu2.candidate_id = p.cid)
  ),
  ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, entity_type, entity_id)
    SELECT pr.user_id, 'contract_expiry:' || pr.days_left,
           'Contract expiring in ' || pr.days_left || CASE WHEN pr.days_left = 1 THEN ' day' ELSE ' days' END,
           COALESCE(pr.unit_code || ' – ', '') || COALESCE(pr.unit_name, 'Client')
             || COALESCE(' (' || pr.org_name || ')', '')
             || ': contract ' || COALESCE(pr.contract_code, '') || ' expires on '
             || to_char(pr.ends, 'DD Mon YYYY') || '. Renew or extend it before then.',
           '/admin/contracts/client-contracts', 'client_contract', pr.id::text
      FROM pairs pr
     WHERE NOT EXISTS (SELECT 1 FROM public.notifications x
                        WHERE x.user_id = pr.user_id AND x.entity_id = pr.id::text
                          AND x.type = 'contract_expiry:' || pr.days_left
                          AND x.created_at > now() - interval '20 hours')
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_contract_expiry_alerts() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'contract-expiry-alerts';
SELECT cron.schedule('contract-expiry-alerts', '30 3 * * *', $$SELECT public.send_contract_expiry_alerts();$$);
