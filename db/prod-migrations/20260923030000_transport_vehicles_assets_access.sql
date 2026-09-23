-- Transport role owns fleet AND assets end to end.
-- Vehicles already granted; this extends the same full access to Assets
-- (inventory, loans, expenses) and to the Asset master under Control Center.

INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT 'transport', 'assets', s.sub, true, true, true, true
FROM (VALUES (''), ('asset_inventory'), ('loan_manager'), ('expense_manager')) AS s(sub)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = 'transport' AND rp.module_key = 'assets' AND coalesce(rp.sub_module_key, '') = s.sub
);

UPDATE public.role_permissions
SET can_view = true, can_edit = true, can_delete = true, can_approve = true
WHERE role_key = 'transport' AND module_key = 'assets';

-- Asset master lives in Control Center; transport needs it to maintain assets.
INSERT INTO public.role_permissions (role_key, module_key, sub_module_key, can_view, can_edit, can_delete, can_approve)
SELECT 'transport', 'control_center', 'asset_manager', true, true, true, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = 'transport' AND rp.module_key = 'control_center' AND rp.sub_module_key = 'asset_manager'
);

UPDATE public.role_permissions
SET can_view = true, can_edit = true, can_delete = true
WHERE role_key = 'transport' AND module_key = 'control_center' AND sub_module_key = 'asset_manager';

UPDATE public.role_permissions
SET can_view = true
WHERE role_key = 'transport' AND module_key = 'control_center' AND coalesce(sub_module_key, '') = '';
