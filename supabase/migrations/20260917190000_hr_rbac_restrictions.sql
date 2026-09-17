-- RBAC: HR (and HR Head, sharing the `hr` role) must never reach the Control
-- Center or the Uniform (inventory) module, and must not see client commercial
-- surfaces (contracts / invoicing). Payroll, attendance, employees,
-- organizations, compliance and personal pages stay intact.
UPDATE public.role_permissions
   SET can_view = false, can_edit = false, can_delete = false, can_approve = false
 WHERE role_key = 'hr'
   AND module_key IN ('control_center', 'contracts', 'invoice', 'inventory');
