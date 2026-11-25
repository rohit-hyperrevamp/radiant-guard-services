/**
 * Pure helpers for the organization / client setup wizards: state options,
 * pincode → state lookup and per-step validation.
 */

/** The 28 states and 8 union territories of India (official names). */
export const INDIAN_STATES_AND_UTS: readonly string[] = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const stateKey = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/**
 * State choices for a select: the states master table first (it is what the
 * rest of the portal matches on), then any official state it lacks, then the
 * record's current value if it is free text that matches neither — so old
 * records keep their saved value.
 */
export function stateOptions(masterNames: readonly string[], current?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (name: string | null | undefined) => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return;
    const key = stateKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };
  for (const name of masterNames) push(name);
  for (const name of INDIAN_STATES_AND_UTS) push(name);
  push(current);
  return out.sort((a, b) => a.localeCompare(b));
}

/** Map a typed state onto the matching option's spelling, if any. */
export function canonicalState(value: string, options: readonly string[]): string {
  const key = stateKey(value);
  return options.find((option) => stateKey(option) === key) ?? value;
}

export type PincodeRangeRow = {
  state: string;
  range_start: number;
  range_end: number;
  is_excluded: boolean;
};

/**
 * State for a 6-digit pincode from the `pincode_ranges` table. Only answers
 * when exactly one state covers the pincode (narrowest non-excluded range);
 * returns null when unknown or ambiguous so a user's choice is never guessed.
 */
export function stateForPincode(pincode: string, ranges: readonly PincodeRangeRow[]): string | null {
  const trimmed = pincode.trim();
  if (!/^\d{6}$/.test(trimmed)) return null;
  const pin = Number(trimmed);
  const covering = ranges.filter((r) => !r.is_excluded && pin >= Number(r.range_start) && pin <= Number(r.range_end));
  if (covering.length === 0) return null;
  const states = new Set(covering.map((r) => stateKey(r.state)));
  if (states.size !== 1) return null;
  return covering.sort((a, b) => (a.range_end - a.range_start) - (b.range_end - b.range_start))[0].state;
}

export type OrgWizardFields = {
  code: string;
  name: string;
  billingName: string;
  billingAddress1: string;
  billingCity: string;
  billingPincode: string;
  shippingSameAsBilling: boolean;
  shippingAddress1: string;
  shippingCity: string;
  shippingPincode: string;
};

export type StepProblem = { field: keyof OrgWizardFields; message: string };

/** First missing or invalid required field on an organization wizard step. */
export function validateOrgStep(form: OrgWizardFields, step: string): StepProblem | null {
  const blank = (value: string) => !String(value ?? "").trim();
  if (step === "profile") {
    if (blank(form.code)) return { field: "code", message: "Enter an organization ID" };
    if (blank(form.name)) return { field: "name", message: "Enter the organization name" };
  }
  if (step === "contact") {
    if (blank(form.billingName)) return { field: "billingName", message: "Enter the contact person's name" };
  }
  if (step === "billing") {
    if (blank(form.billingAddress1)) return { field: "billingAddress1", message: "Enter the billing address" };
    if (blank(form.billingCity)) return { field: "billingCity", message: "Enter the billing city" };
    if (form.billingPincode && !/^\d{6}$/.test(form.billingPincode)) return { field: "billingPincode", message: "Enter a valid 6-digit pincode" };
  }
  if (step === "deployment" && !form.shippingSameAsBilling) {
    if (blank(form.shippingAddress1)) return { field: "shippingAddress1", message: "Enter the deployment address" };
    if (blank(form.shippingCity)) return { field: "shippingCity", message: "Enter the deployment city" };
    if (form.shippingPincode && !/^\d{6}$/.test(form.shippingPincode)) return { field: "shippingPincode", message: "Enter a valid 6-digit pincode" };
  }
  return null;
}

/**
 * Where "Next" may go: moving forward stops at the first earlier step with a
 * problem; moving back is always allowed.
 */
export function guardedStepTarget(
  steps: readonly string[],
  current: string,
  target: string,
  validate: (step: string) => unknown,
): { step: string; blockedBy: string | null } {
  const from = steps.indexOf(current);
  const to = steps.indexOf(target);
  if (to <= from) return { step: target, blockedBy: null };
  for (let index = 0; index < to; index += 1) {
    if (validate(steps[index])) return { step: steps[index], blockedBy: steps[index] };
  }
  return { step: target, blockedBy: null };
}
