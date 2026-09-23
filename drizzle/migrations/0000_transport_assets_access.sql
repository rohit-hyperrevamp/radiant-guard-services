-- Transport role owns fleet AND assets end to end.
-- (Applied to production via db/prod-migrations copy of the same SQL.)
UPDATE public.role_permissions
SET can_view = true, can_edit = true, can_delete = true, can_approve = true
WHERE role_key = 'transport'
  AND (module_key = 'assets'
       OR (module_key = 'control_center' AND sub_module_key = 'asset_manager'));

UPDATE public.role_permissions
SET can_view = true
WHERE role_key = 'transport' AND module_key = 'control_center' AND sub_module_key = '';