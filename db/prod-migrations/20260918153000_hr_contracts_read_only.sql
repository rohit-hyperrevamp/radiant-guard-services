-- HR can inspect signed client contracts, but cannot alter contract data or access invoicing.
UPDATE public.role_permissions
SET can_view = true,
    can_edit = false,
    can_delete = false,
    can_approve = false
WHERE role_key = 'hr'
  AND module_key = 'contracts'
  AND sub_module_key IN ('', 'client_contracts');

UPDATE public.role_permissions
SET can_view = false,
    can_edit = false,
    can_delete = false,
    can_approve = false
WHERE role_key = 'hr'
  AND module_key = 'invoice';

CREATE OR REPLACE FUNCTION public.prevent_hr_contract_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role_key() = 'hr' THEN
    RAISE EXCEPTION 'HR access to contracts is read-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_hr_client_contract_mutation ON public.client_contracts;
CREATE TRIGGER prevent_hr_client_contract_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.prevent_hr_contract_mutation();

DROP TRIGGER IF EXISTS prevent_hr_contract_resource_mutation ON public.contract_resources;
CREATE TRIGGER prevent_hr_contract_resource_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.contract_resources
FOR EACH ROW EXECUTE FUNCTION public.prevent_hr_contract_mutation();