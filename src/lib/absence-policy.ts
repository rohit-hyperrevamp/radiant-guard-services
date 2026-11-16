export type AbsencePolicy = {
  enabled: boolean;
  alerts_enabled: boolean;
  termination_enabled: boolean;
  termination_days: number;
  warning_days: number[];
  role_keys: string[];
  department_ids: string[];
  activated_on: string | null;
};

export const DEFAULT_ABSENCE_POLICY: AbsencePolicy = {
  enabled: false, alerts_enabled: true, termination_enabled: false,
  termination_days: 15, warning_days: [10, 15, 20],
  role_keys: ["guard"], department_ids: [], activated_on: null,
};

export function validateAbsencePolicy(policy: AbsencePolicy): string | null {
  if (!Number.isInteger(policy.termination_days) || policy.termination_days < 15 || policy.termination_days > 365)
    return "Termination requires at least 15 days (maximum 365).";
  if (!policy.warning_days.length || policy.warning_days.some((day) => !Number.isInteger(day) || day < 1 || day > 365))
    return "Choose warning days between 1 and 365.";
  if (!policy.warning_days.some((day) => day < policy.termination_days))
    return "At least one warning must precede the termination threshold.";
  if (policy.role_keys.length !== 1 || policy.role_keys[0] !== "guard")
    return "This rule applies to security guards only.";
  return null;
}

export type AbsenceDay = { date: string; assigned: boolean; worked: boolean; excused: boolean };

/** Reference model for the database rule: any-site work/leave breaks the streak. */
export function continuousAbsence(daysNewestFirst: AbsenceDay[]): number {
  let count = 0;
  for (const day of daysNewestFirst) {
    if (!day.assigned || day.worked || day.excused) break;
    count++;
  }
  return count;
}