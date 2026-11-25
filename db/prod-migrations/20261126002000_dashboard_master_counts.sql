-- PERF: dashboard master tiles (Organizations / Units / Employees / active and
-- expiring contracts) in ONE request instead of paging every non-inactive
-- candidate (8 serial pages), units, customers, client_contracts and
-- rehire_requests into the browser.
--
-- SECURITY INVOKER: every table read goes through the caller's own RLS, exactly
-- like the PostgREST reads it replaces. Logic mirrors
-- computeDashboardMasterCounts() in src/lib/dashboard-master-counts.ts step for
-- step (parity fixtures in src/lib/dashboard-master-counts.test.ts):
--   * units / customers / client_contracts: status = 'active'
--   * candidates: status <> 'inactive' (PostgREST neq also drops NULL status),
--     grouped by coalesce(nullif(trim(mobile),''), id); in each group the best
--     row among status active/approved is chosen by
--       is_enabled desc, trailing-digits(employee_code) desc,
--       first non-empty(approved_at, created_at, updated_at) desc, id desc;
--     counted when that row is enabled, not in a pending rehire, and (when a
--     scope is given) its unit_id is in scope.
--   * contracts: unit null or unit active, in scope when scoped,
--     end_date null or >= today (IST); expiring = end_date <= today + 60,
--     ordered by end_date (then id, the browser's stable input order).
--   * orgs: active customers (when scoped, only customers of visible units).
-- Also: employee_insights_counts() folds the four EmployeeInsightsSection head
-- counts into one scan (SECURITY INVOKER, same RLS).
--
-- RISK: LOW. Read-only, invoker rights; the client falls back to the browser
-- computation when this function is missing or errors.
-- VERIFY (as an admin JWT, e.g. via the dashboard):
--   select public.dashboard_master_counts(null, null);
--   select public.dashboard_master_counts(array(select id from units where status='active' limit 5), null);
--   select public.employee_insights_counts();
-- Compare with the previous browser tile values (Employees, Units, Contracts).

BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_master_counts(p_scope uuid[] DEFAULT NULL, p_today date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) AS today
),
u AS (
  SELECT id, customer_id FROM public.units WHERE status = 'active'
),
vu AS (
  SELECT id, customer_id FROM u WHERE p_scope IS NULL OR id = ANY (p_scope)
),
pending AS (
  SELECT previous_candidate_id AS id FROM public.rehire_requests WHERE status = 'pending' AND previous_candidate_id IS NOT NULL
  UNION
  SELECT new_candidate_id FROM public.rehire_requests WHERE status = 'pending' AND new_candidate_id IS NOT NULL
),
people AS (
  SELECT c.id, c.unit_id, c.status, c.is_enabled, c.employee_code, c.approved_at, c.created_at, c.updated_at,
         -- JS: p.mobile?.trim() || p.id
         coalesce(nullif(regexp_replace(coalesce(c.mobile, ''), '^\s+|\s+$', '', 'g'), ''), c.id::text) AS grp
  FROM public.candidates c
  WHERE c.status <> 'inactive'
),
best AS (
  SELECT DISTINCT ON (p.grp) p.*
  FROM people p
  WHERE p.status IN ('active', 'approved')
  ORDER BY p.grp,
           (p.is_enabled IS TRUE) DESC,                                            -- Number(is_enabled), null -> 0
           coalesce(substring(coalesce(p.employee_code, '') FROM '(\d+)$')::numeric, 0) DESC,
           coalesce(p.approved_at, p.created_at, p.updated_at) DESC NULLS LAST,    -- "" sorts lowest
           p.id::text COLLATE "C" DESC
),
emp AS (
  SELECT count(*) AS n
  FROM best b
  WHERE b.is_enabled IS TRUE
    AND NOT EXISTS (SELECT 1 FROM pending x WHERE x.id = b.id)
    AND (p_scope IS NULL OR (b.unit_id IS NOT NULL AND b.unit_id = ANY (p_scope)))
),
ac AS (
  SELECT cc.id, cc.contract_code, cc.unit_id, cc.status, cc.end_date
  FROM public.client_contracts cc, params
  WHERE cc.status = 'active'
    AND (cc.unit_id IS NULL OR EXISTS (SELECT 1 FROM u WHERE u.id = cc.unit_id))
    AND (p_scope IS NULL OR (cc.unit_id IS NOT NULL AND cc.unit_id = ANY (p_scope)))
    AND (cc.end_date IS NULL OR cc.end_date >= params.today)
)
SELECT jsonb_build_object(
  'orgs', (SELECT count(*) FROM public.customers cu
           WHERE cu.status = 'active'
             AND (p_scope IS NULL OR EXISTS (SELECT 1 FROM vu WHERE vu.customer_id = cu.id))),
  'units', (SELECT count(*) FROM vu),
  'employees', (SELECT n FROM emp),
  'contractsActive', (SELECT count(*) FROM ac),
  'contractsExpiring', coalesce((
     SELECT jsonb_agg(jsonb_build_object(
              'id', ac.id, 'contract_code', ac.contract_code, 'unit_id', coalesce(ac.unit_id::text, ''),
              'status', ac.status, 'end_date', ac.end_date::text)
            ORDER BY ac.end_date, ac.id)
     FROM ac, params
     WHERE ac.end_date IS NOT NULL AND ac.end_date <= params.today + 60), '[]'::jsonb)
);
$function$;

REVOKE ALL ON FUNCTION public.dashboard_master_counts(uuid[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_master_counts(uuid[], date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.employee_insights_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'employees',       count(*) FILTER (WHERE is_enabled = true AND status IN ('active', 'approved')),
  'candidates',      count(*) FILTER (WHERE status IN ('draft', 'submitted', 'pending', 'candidate')),
  'pendingApproval', count(*) FILTER (WHERE status IN ('submitted', 'pending')),
  'offboarded',      count(*) FILTER (WHERE status IN ('offboarded', 'inactive', 'exited'))
)
FROM public.candidates;
$function$;

REVOKE ALL ON FUNCTION public.employee_insights_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_insights_counts() TO authenticated, service_role;

COMMIT;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.dashboard_master_counts(uuid[], date);
--   DROP FUNCTION IF EXISTS public.employee_insights_counts();
-- (the client falls back to the browser computation automatically).
