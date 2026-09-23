-- Transport (Shahid Hussain / Senior Manager - Admin) must never see Control Center.
-- Remove the control_center asset_manager grant added for asset-type management and
-- switch the module parent row off so the Control Center menu and routes disappear.
DELETE FROM role_permissions
WHERE role_key = 'transport'
  AND module_key = 'control_center'
  AND sub_module_key = 'asset_manager';

UPDATE role_permissions
SET can_view = false,
    can_edit = false,
    can_delete = false,
    can_approve = false
WHERE role_key = 'transport'
  AND module_key = 'control_center'
  AND (sub_module_key IS NULL OR sub_module_key = '');
