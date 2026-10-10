// One standard name per pay item for payroll columns, so short forms and
// spelling variants ("WA", "Washing Allowance", "Bonus / Exgratia 8.33%
// (Basic+DA) Rounded") land in the same column instead of two.
// Display/grouping only — formula variables keep their own aliases.

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const GROUPS: Array<[string, string[]]> = [
  ["Basic", ["basic", "basicpay", "basicsalary", "basicwage", "basicwages"]],
  ["DA", ["da", "dearnessallowance", "spllda", "splda", "specialda"]],
  ["HRA", ["hra", "houserentallowance", "houserent"]],
  ["Washing Allowance", ["wa", "washingallowance", "washallowance", "washingallow", "washing", "washingallowances"]],
  ["Other Allowance", ["oa", "otherallowance", "otherallowances", "otherallow", "othersallowance"]],
  ["Bonus", ["bonus", "bonusexgratia", "exgratia", "exgratiabonus", "statutorybonus", "bonusexgratiarounded"]],
  ["Leave Pay", ["leavepay", "leavewithwages", "lww", "leavewages", "earnedleave", "el", "leavewithwage", "leave"]],
  ["Special Allowance", ["specialallowance", "splallowance", "splallow", "spicalallowance", "specialallow", "sa"]],
  ["Conveyance Allowance", ["conveyance", "conveyanceallowance", "convallow", "convallowance", "conv"]],
  ["Transport Allowance", ["transportallowance", "transportationallowance", "transport", "transportation"]],
  ["Uniform Allowance", ["uniformallowance", "uniform", "uniformmaintenance", "uniformmaintenanceallowance"]],
  ["Paid Holiday", ["paidholiday", "paidholidays", "ph", "nationalholiday", "nh", "nfh"]],
  ["CCA", ["cca", "citycompensatoryallowance"]],
  ["Supervisor Allowance", ["supervisorallowance", "securitysupervisorallowance"]],
  ["Skill Allowance", ["skillallowance", "skilallowance"]],
];

const LOOKUP = new Map<string, string>();
for (const [label, keys] of GROUPS) {
  LOOKUP.set(compact(label), label);
  for (const k of keys) LOOKUP.set(k, label);
}

function stripQualifiers(name: string): string {
  let s = String(name ?? "").trim();
  // Parentheses describing the base / rate, e.g. "(Basic+DA)", "(Rs.7000)", "(8.33%)".
  s = s.replace(/\(([^)]*)\)/g, (m, inner: string) => (/[\d%+]|basic|\bda\b|rs/i.test(inner) ? " " : m));
  s = s.replace(/\d+(?:\.\d+)?\s*%/g, " ");
  s = s.replace(/\b(rounded|round(ed)? off|ctc)\b/gi, " ");
  s = s.replace(/\s+\d+(?:\.\d+)?\s*$/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Standard display label for a pay item; unknown names come back tidied but unchanged. */
export function standardPayItemName(name: string): string {
  const raw = String(name ?? "").trim();
  if (!raw) return raw;
  const stripped = stripQualifiers(raw) || raw;
  const hit = LOOKUP.get(compact(stripped)) ?? LOOKUP.get(compact(raw));
  return hit ?? stripped;
}

/** Grouping key: two names with the same key belong in one payroll column. */
export function payItemKey(name: string): string {
  return compact(standardPayItemName(name));
}
