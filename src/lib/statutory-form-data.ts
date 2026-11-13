import { statutoryForms, type FormId } from "./statutory-form-schema";

export type DraftValues = Record<string, string>;
export type EmployeeFormSource = Record<string, unknown>;
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown): string => typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
export function formDate(v: unknown): string {
  const s = text(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
export function prefillStatutoryForm(id: FormId, employee: EmployeeFormSource, employer: EmployeeFormSource): DraftValues {
  const c = object(employee.compliance), other = object(employee.other_info);
  const address = [employee.permanent_address1, employee.permanent_address2, employee.permanent_city, employee.permanent_district, employee.permanent_state, employee.permanent_pincode].map(text).filter(Boolean).join(", ");
  const name = text(employee.full_name), father = text(other.father_name);
  const pf = text(c.pf_number) || text(c.epf_number);
  const values: DraftValues = {
    name, father, dob: formDate(employee.date_of_birth), gender: text(employee.gender), marital: text(employee.marital_status),
    email: text(employee.email), mobile: text(employee.personal_mobile) || text(employee.mobile),
    esic: text(c.esic_number), uan: text(c.uan), pf,
    bank: [employee.bank_account_number, employee.bank_ifsc].map(text).filter(Boolean).join(" / "),
    aadhaar: text(employee.aadhaar_number), pan: text(employee.pan_number), address,
    employerName: text(employer.company_name), employerAddress: text(employer.registered_address), employerEsic: text(employer.esic_number),
    joining: formDate(employee.preferred_joining_date), employerMember: name, allottedUan: text(c.uan),
    injured: [name, address].filter(Boolean).join("\n"),
    employer: [employer.company_name, employer.registered_address].map(text).filter(Boolean).join("\n"),
    blockName: name.toUpperCase(), blockFather: father.toUpperCase(),
  };
  // Current PF/EPS enablement and a saved UAN do not prove PREVIOUS membership.
  const contacts = Array.isArray(employee.contacts) ? employee.contacts.map(object) : [];
  const nominees = Array.isArray(c.nominees) ? c.nominees.map(object) : [];
  nominees.slice(0, 6).forEach((n, i) => {
    const ref = text(n.contact);
    const contact = contacts.find((p, index) => ref === (text(p.id) || (text(p.name) ? `${text(p.name)}|${text(p.mobile) || text(p.phone)}` : `idx:${index}`)));
    if (!contact) return;
    values[`nomName${i}`] = text(contact.name);
    values[`nomRelation${i}`] = text(contact.relation);
    values[`nomAddress${i}`] = text(contact.address);
    values[`nomDob${i}`] = formDate(contact.date_of_birth);
    values[`nomShare${i}`] = text(n.percent);
  });
  // ESIC family is not automatically an EPS-eligible family declaration.
  return Object.fromEntries((statutoryForms.find(f => f.id === id)?.fields ?? []).map(f => [f.key, values[f.key] ?? ""]));
}
export function missingStatutoryFields(id: FormId, values: DraftValues): string[] {
  const fields = statutoryForms.find(f => f.id === id)?.fields ?? [];
  const missing = fields.filter(f => f.required && !values[f.key]?.trim()).map(f => f.label);
  if (id === "epf11") {
    if (values.previousEpf === "Yes" || values.previousEps === "Yes") {
      if (!values.uan?.trim()) missing.push("Universal account number");
      if (!values.previousPf?.trim()) missing.push("Previous PF account number");
    }
    if (values.international === "Yes") for (const key of ["country", "passport", "passportValidity"]) {
      if (!values[key]?.trim()) missing.push(fields.find(f => f.key === key)?.label ?? key);
    }
  }
  if (id === "pf2") {
    const rows = Array.from({length: 6}, (_, i) => i).filter(i => values[`nomName${i}`]?.trim());
    if (!rows.length) missing.push("At least one verified EPF nominee");
    const total = rows.reduce((sum, i) => sum + Number(values[`nomShare${i}`] || 0), 0);
    if (rows.length && total !== 100) missing.push("EPF nominee shares must total 100%");
    for (const i of rows) for (const key of ["nomAddress", "nomRelation", "nomDob", "nomShare"]) {
      if (!values[`${key}${i}`]?.trim()) missing.push(`EPF nominee ${i + 1} — ${key.replace("nom", "")}`);
    }
  }
  return missing;
}