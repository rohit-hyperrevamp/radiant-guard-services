BEGIN;
-- Reporting heads (operations/branch managers) roll up to VP Operations
WITH vp_south AS (select id from candidates where employee_code='47658'),
     vp_main  AS (select id from candidates where employee_code='45217'),
     heads AS (
       select c.id,
              case when c.employee_code='30044' then (select id from vp_south)
                   else (select id from vp_main) end as mgr
       from candidates c
       where c.role_key in ('operations_manager','branch_manager')
         and c.status='active'
         and c.reports_to is null
         and c.employee_code not in ('45217','47658')
     )
INSERT INTO candidate_reporting_managers (candidate_id, manager_id, is_primary, source)
SELECT id, mgr, true, 'hierarchy' FROM heads
ON CONFLICT (candidate_id, manager_id) DO UPDATE SET is_primary = true;
COMMIT;
