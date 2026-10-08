-- Employee-specific, view-only access; editable through Access Control.
BEGIN;
INSERT INTO public.access_overrides
  (scope_type,scope_id,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
SELECT 'employee','bcb812f8-5c89-46c5-821e-91a55871476c'::uuid,m,s,true,false,false,false
FROM (VALUES
  ('dashboard',''),('dashboard','w_team_clients'),
  ('organizations',''),('organizations','organization_manager'),('organizations','unit_manager'),
  ('contracts',''),('contracts','client_contracts'),('contracts','resources'),
  ('employees',''),('attendance','')
) AS grants(m,s)
WHERE NOT EXISTS (
  SELECT 1 FROM public.access_overrides a
  WHERE a.scope_type='employee' AND a.scope_id='bcb812f8-5c89-46c5-821e-91a55871476c'::uuid
    AND a.module_key=m AND a.sub_module_key=s AND a.department_id IS NULL
);
INSERT INTO public.system_logs(module,action,entity_type,entity_id,entity_label,status,details)
VALUES ('Access Control','update','candidate','bcb812f8-5c89-46c5-821e-91a55871476c','Pandurang Patil workspace access','success',
  '{"change":"Employee-level view-only access for dashboard, organizations, clients, contracts, resources, employees and attendance; no editing or approval granted"}'::jsonb);
COMMIT;