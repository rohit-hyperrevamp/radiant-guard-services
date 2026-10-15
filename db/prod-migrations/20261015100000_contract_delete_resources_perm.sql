-- Deleting saved contract resources: Super Admin + Leadership only (explicit switch).
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT r, 'contracts', 'delete_resources', true, true, true, false
FROM unnest(ARRAY['super_admin','admin','leadership']) AS r
ON CONFLICT (role_key, module_key, sub_module_key) DO UPDATE SET can_view = true, can_edit = true, can_delete = true;
