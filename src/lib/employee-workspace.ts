type ExitRecord = {
  status?: string | null;
  is_enabled?: boolean | null;
  is_disabled?: boolean | null;
  offboarded_at?: string | null;
  offboarding_reason_id?: string | null;
  offboarding_details?: { collection_status?: string | null; date_of_offboarding?: string | null } | null;
};

/** A previous exit must not expose exit actions on an active, rehired profile. */
export function hasEmployeeOffboarding(employee: ExitRecord | null | undefined): boolean {
  if (!employee) return false;
  if (employee.offboarding_details?.collection_status === "pending") return true;
  return employee.status === "inactive" || employee.is_enabled === false || employee.is_disabled === true;
}