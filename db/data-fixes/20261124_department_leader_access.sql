-- User-authorized identities, verified by employee ID and existing department before editing.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM candidates c JOIN departments d ON d.id=c.department_id WHERE c.id='01bf42e5-a3a6-476e-bdb1-91ed535f9faf' AND c.employee_code='494185' AND c.full_name='Noor Singh' AND d.name='Legal') THEN RAISE EXCEPTION 'Legal Noor identity changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM candidates WHERE id='96604755-1098-43c3-a03b-5d8558077a1a' AND employee_code='26881' AND full_name='Shahid Hussain') THEN RAISE EXCEPTION 'Transport leader identity changed'; END IF;
 UPDATE candidates SET role_key='leadership' WHERE id='01bf42e5-a3a6-476e-bdb1-91ed535f9faf' AND role_key IS DISTINCT FROM 'leadership';
 -- Legal department overrides take priority over roles. Copy only affected Leadership modules to Noor, leaving other Legal employees untouched.
 INSERT INTO access_overrides(scope_type,scope_id,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
 SELECT 'employee','01bf42e5-a3a6-476e-bdb1-91ed535f9faf',p.module_key,p.sub_module_key,p.can_view,p.can_edit,p.can_delete,p.can_approve FROM role_permissions p
 WHERE p.role_key='leadership' AND p.module_key IN (SELECT module_key FROM access_overrides WHERE scope_type='department' AND scope_id=(SELECT department_id FROM candidates WHERE id='01bf42e5-a3a6-476e-bdb1-91ed535f9faf'))
 AND NOT EXISTS(SELECT 1 FROM access_overrides o WHERE o.scope_type='employee' AND o.scope_id='01bf42e5-a3a6-476e-bdb1-91ed535f9faf' AND o.module_key=p.module_key AND o.sub_module_key=p.sub_module_key);
 -- Preserve the leader's existing Vehicles permissions while adding a configurable department-team read switch.
 INSERT INTO access_overrides(scope_type,scope_id,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
 SELECT 'employee','96604755-1098-43c3-a03b-5d8558077a1a',p.module_key,p.sub_module_key,p.can_view,p.can_edit,p.can_delete,p.can_approve FROM role_permissions p WHERE p.role_key='transport' AND p.module_key='vehicles'
 AND NOT EXISTS(SELECT 1 FROM access_overrides o WHERE o.scope_type='employee' AND o.scope_id='96604755-1098-43c3-a03b-5d8558077a1a' AND o.module_key=p.module_key AND o.sub_module_key=p.sub_module_key);
 INSERT INTO access_overrides(scope_type,scope_id,module_key,sub_module_key,can_view,can_edit,can_delete,can_approve)
 SELECT 'employee','96604755-1098-43c3-a03b-5d8558077a1a','vehicles','driver_team_all',true,false,false,false
 WHERE NOT EXISTS(SELECT 1 FROM access_overrides WHERE scope_type='employee' AND scope_id='96604755-1098-43c3-a03b-5d8558077a1a' AND module_key='vehicles' AND sub_module_key='driver_team_all');
END $$;
-- Explicit operational membership only; no primary manager, department or salary-site change.
INSERT INTO public.transport_team_members(manager_id,driver_id)
SELECT '96604755-1098-43c3-a03b-5d8558077a1a',c.id FROM public.candidates c JOIN public.designations d ON d.id=c.designation_id
WHERE c.role_key='transport' AND lower(d.name)='driver' AND c.status IN ('active','approved') AND c.is_enabled
ON CONFLICT DO NOTHING;
