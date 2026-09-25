import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { useAuth } from "@/lib/auth";

/**
 * Cloud-backed admin data store.
 * Tables: public.states, public.branches, public.customers
 * RLS: any authenticated user has full access (pre-launch admin tooling).
 */

export type State = { id: string; name: string };

export type Branch = {
  id: string;
  code: string;
  name: string;
  description: string;
  stateId: string;
  gstin: string;
  registeredAddress: string;
  corporateAddress: string;
  gstStateName: string;
  gstStateCode: string;
  isGstBillingBranch: boolean;
  isGstDefault: boolean;
};

export type CustomerStatus = "active" | "inactive";

export type Customer = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  logoUrl: string;
  industryType: string;
  website: string;
  phone: string;
  address: string;
  contractStartDate: string; // yyyy-mm-dd or ""
  contractEndDate: string;
  status: CustomerStatus;
  billingSalutation: string;
  billingName: string;
  billingAddress1: string;
  billingAddress2: string;
  billingPincode: string;
  billingCity: string;
  billingDistrict: string;
  billingState: string;
  billingCountry: string;
  billingEmail: string;
  billingPhone: string;
  billingFax: string;
  shippingSameAsBilling: boolean;
  shippingSalutation: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingPincode: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingState: string;
  shippingCountry: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingFax: string;
};

export const INDUSTRY_TYPES = [
  "Agriculture, Forestry & Fishing",
  "Automotive",
  "Aviation & Aerospace",
  "Banking, Financial Services & Insurance (BFSI)",
  "Chemicals",
  "Construction & Real Estate",
  "Consumer Goods (FMCG)",
  "Defense & Security",
  "Education & Training",
  "Energy & Utilities",
  "Engineering & Industrial Manufacturing",
  "Entertainment & Media",
  "Food & Beverage",
  "Government & Public Sector",
  "Healthcare & Hospitals",
  "Hospitality, Travel & Tourism",
  "Information Technology & Software",
  "Legal Services",
  "Logistics & Supply Chain",
  "Mining & Metals",
  "Non-Profit & NGO",
  "Oil & Gas",
  "Pharmaceuticals & Biotechnology",
  "Professional Services & Consulting",
  "Retail & E-commerce",
  "Telecommunications",
  "Textiles & Apparel",
  "Transportation",
  "Other",
] as const;

type Result = { ok: true; id?: string } | { ok: false; error: string };
type AddResult = { ok: true; id: string } | { ok: false; error: string };

const QK = {
  states: ["admin", "states"] as const,
  branches: ["admin", "branches"] as const,
  customers: ["admin", "customers"] as const,
};

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

function useAdminQueryEnabled() {
  const { user, isReady } = useAuth();
  return isReady && !!user;
}

// ───────────────────────── States ─────────────────────────

export function useStates() {
  const qc = useQueryClient();
  const enabled = useAdminQueryEnabled();

  const { data: states = [] } = useQuery({
    queryKey: QK.states,
    enabled,
    queryFn: async (): Promise<State[]> => {
      const { data, error } = await supabase
        .from("states")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.states });

  const addMut = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      const { error } = await supabase.from("states").insert({ name: trimmed });
      if (error) throw error;
      void logActivity({ module: "State Manager", action: "create", entityType: "states", entityLabel: trimmed });
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      const { error } = await supabase
        .from("states")
        .update({ name: trimmed })
        .eq("id", id);
      if (error) throw error;
      void logActivity({ module: "State Manager", action: "update", entityType: "states", entityId: id, entityLabel: trimmed });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("states").delete().eq("id", id);
      if (error) throw error;
      void logActivity({ module: "State Manager", action: "delete", entityType: "states", entityId: id });
    },
    onSuccess: invalidate,
  });

  const addState = async (name: string): Promise<Result> => {
    try {
      await addMut.mutateAsync(name);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, "Could not add state") };
    }
  };

  const updateState = async (id: string, name: string): Promise<Result> => {
    try {
      await updateMut.mutateAsync({ id, name });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, "Could not update state") };
    }
  };

  const deleteState = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      throw new Error(errMsg(e, "Could not delete state"));
    }
  };

  return { states, addState, updateState, deleteState };
}

// ───────────────────────── Branches ─────────────────────────

export function useBranches() {
  const qc = useQueryClient();
  const enabled = useAdminQueryEnabled();

  const { data: branches = [] } = useQuery({
    queryKey: QK.branches,
    enabled,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, code, name, description, state_id, gstin, registered_address, corporate_address, gst_state_name, gst_state_code, is_gst_billing_branch, is_gst_default" as never);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id ?? ""),
        code: String(r.code ?? ""),
        name: String(r.name ?? ""),
        description: String(r.description ?? ""),
        stateId: String(r.state_id ?? ""),
        gstin: String(r.gstin ?? ""),
        registeredAddress: String(r.registered_address ?? ""),
        corporateAddress: String(r.corporate_address ?? ""),
        gstStateName: String(r.gst_state_name ?? ""),
        gstStateCode: String(r.gst_state_code ?? ""),
        isGstBillingBranch: Boolean(r.is_gst_billing_branch),
        isGstDefault: Boolean(r.is_gst_default),
      }));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.branches });

  const addMut = useMutation({
    mutationFn: async (data: Omit<Branch, "id">) => {
      const code = data.code.trim();
      if (!code) throw new Error("Branch code is required");
      if (!data.stateId) throw new Error("Pick a state");
      const { error } = await supabase.from("branches").insert({
        code,
        name: data.name.trim(),
        description: data.description.trim(),
        state_id: data.stateId,
        gstin: data.gstin.trim() || null,
        registered_address: data.registeredAddress.trim() || null,
        corporate_address: data.corporateAddress.trim() || null,
        gst_state_name: data.gstStateName.trim() || null,
        gst_state_code: data.gstStateCode.trim() || null,
        is_gst_billing_branch: data.isGstBillingBranch,
        is_gst_default: data.isGstDefault,
      } as never);
      if (error) throw error;
      void logActivity({ module: "Branch Manager", action: "create", entityType: "branches", entityLabel: data.name.trim() || code, details: data as unknown as Record<string, unknown> });
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<Branch, "id"> }) => {
      const code = data.code.trim();
      if (!code) throw new Error("Branch code is required");
      if (!data.stateId) throw new Error("Pick a state");
      const { error } = await supabase
        .from("branches")
        .update({
          code,
          name: data.name.trim(),
          description: data.description.trim(),
          state_id: data.stateId,
          gstin: data.gstin.trim() || null,
          registered_address: data.registeredAddress.trim() || null,
          corporate_address: data.corporateAddress.trim() || null,
          gst_state_name: data.gstStateName.trim() || null,
          gst_state_code: data.gstStateCode.trim() || null,
          is_gst_billing_branch: data.isGstBillingBranch,
          is_gst_default: data.isGstDefault,
        } as never)
        .eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Branch Manager", action: "update", entityType: "branches", entityId: id, entityLabel: data.name.trim() || code, details: data as unknown as Record<string, unknown> });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Branch Manager", action: "delete", entityType: "branches", entityId: id });
    },
    onSuccess: invalidate,
  });

  const addBranch = async (data: Omit<Branch, "id">): Promise<Result> => {
    try {
      await addMut.mutateAsync(data);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "branch") };
    }
  };

  const updateBranch = async (
    id: string,
    data: Omit<Branch, "id">,
  ): Promise<Result> => {
    try {
      await updateMut.mutateAsync({ id, data });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "branch") };
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      throw new Error(errMsg(e, "Could not delete branch"));
    }
  };

  return { branches, addBranch, updateBranch, deleteBranch };
}

// ───────────────────────── Customers ─────────────────────────

export function nextCustomerCode(customers: { code: string }[]) {
  const nums = customers
    .map((c) => parseInt(c.code.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `ORG${max + 1}`;
}

type CustomerRow = Record<string, unknown> & { id: string; code: string; name: string };

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    shortName: s(r.short_name),
    description: s(r.description),
    logoUrl: s(r.logo_url),
    industryType: s(r.industry_type),
    website: s(r.website),
    phone: s(r.phone),
    address: s(r.address),
    contractStartDate: s(r.contract_start_date),
    contractEndDate: s(r.contract_end_date),
    status: (r.status as CustomerStatus) ?? "active",
    billingSalutation: s(r.billing_salutation),
    billingName: s(r.billing_name),
    billingAddress1: s(r.billing_address1),
    billingAddress2: s(r.billing_address2),
    billingPincode: s(r.billing_pincode),
    billingCity: s(r.billing_city),
    billingDistrict: s(r.billing_district),
    billingState: s(r.billing_state),
    billingCountry: s(r.billing_country) || "India",
    billingEmail: s(r.billing_email),
    billingPhone: s(r.billing_phone),
    billingFax: s(r.billing_fax),
    shippingSameAsBilling: r.shipping_same_as_billing !== false,
    shippingSalutation: s(r.shipping_salutation),
    shippingName: s(r.shipping_name),
    shippingAddress1: s(r.shipping_address1),
    shippingAddress2: s(r.shipping_address2),
    shippingPincode: s(r.shipping_pincode),
    shippingCity: s(r.shipping_city),
    shippingDistrict: s(r.shipping_district),
    shippingState: s(r.shipping_state),
    shippingCountry: s(r.shipping_country) || "India",
    shippingEmail: s(r.shipping_email),
    shippingPhone: s(r.shipping_phone),
    shippingFax: s(r.shipping_fax),
  };
}

function customerToRow(data: Omit<Customer, "id">) {
  const code = data.code.trim();
  const name = data.name.trim();
  if (!code) throw new Error("Organisation ID is required");
  if (!name) throw new Error("Organisation name is required");
  const sameAsBilling = data.shippingSameAsBilling;
  const d = data as unknown as Record<string, string>;
  const ship = (k: string, fallback: string) =>
    sameAsBilling ? d[fallback] ?? "" : d[k] ?? "";
  return {
    code,
    name,
    short_name: data.shortName.trim(),
    description: data.description.trim(),
    logo_url: data.logoUrl.trim(),
    industry_type: data.industryType.trim(),
    website: data.website.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    contract_start_date: data.contractStartDate || null,
    contract_end_date: data.contractEndDate || null,
    status: data.status,
    billing_salutation: data.billingSalutation,
    billing_name: data.billingName,
    billing_address1: data.billingAddress1,
    billing_address2: data.billingAddress2,
    billing_pincode: data.billingPincode,
    billing_city: data.billingCity,
    billing_district: data.billingDistrict,
    billing_state: data.billingState,
    billing_country: data.billingCountry || "India",
    billing_email: data.billingEmail,
    billing_phone: data.billingPhone,
    billing_fax: data.billingFax,
    shipping_same_as_billing: sameAsBilling,
    shipping_salutation: ship("shippingSalutation", "billingSalutation"),
    shipping_name: ship("shippingName", "billingName"),
    shipping_address1: ship("shippingAddress1", "billingAddress1"),
    shipping_address2: ship("shippingAddress2", "billingAddress2"),
    shipping_pincode: ship("shippingPincode", "billingPincode"),
    shipping_city: ship("shippingCity", "billingCity"),
    shipping_district: ship("shippingDistrict", "billingDistrict"),
    shipping_state: ship("shippingState", "billingState"),
    shipping_country: ship("shippingCountry", "billingCountry") || "India",
    shipping_email: ship("shippingEmail", "billingEmail"),
    shipping_phone: ship("shippingPhone", "billingPhone"),
    shipping_fax: ship("shippingFax", "billingFax"),
  };
}

export function useCustomers() {
  const qc = useQueryClient();
  const enabled = useAdminQueryEnabled();

  const { data: customers = [] } = useQuery({
    queryKey: QK.customers,
    enabled,
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return (data ?? []).map(rowToCustomer);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.customers });

  const addMut = useMutation({
    mutationFn: async (data: Omit<Customer, "id">): Promise<string> => {
      const { data: inserted, error } = await supabase
        .from("customers")
        .insert(customerToRow(data))
        .select("id")
        .single();
      if (error) throw error;
      const id = (inserted as { id: string }).id;
      void logActivity({ module: "Customer Manager", action: "create", entityType: "customers", entityId: id, entityLabel: data.name, details: data as unknown as Record<string, unknown> });
      return id;
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Omit<Customer, "id">;
    }) => {
      const { error } = await supabase
        .from("customers")
        .update(customerToRow(data))
        .eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Customer Manager", action: "update", entityType: "customers", entityId: id, entityLabel: data.name, details: data as unknown as Record<string, unknown> });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Customer Manager", action: "delete", entityType: "customers", entityId: id });
    },
    onSuccess: invalidate,
  });

  const addCustomer = async (data: Omit<Customer, "id">): Promise<AddResult> => {
    try {
      const id = await addMut.mutateAsync(data);
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "customer") };
    }
  };

  const updateCustomer = async (
    id: string,
    data: Omit<Customer, "id">,
  ): Promise<Result> => {
    try {
      await updateMut.mutateAsync({ id, data });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "customer") };
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      throw new Error(errMsg(e, "Could not delete customer"));
    }
  };

  return { customers, addCustomer, updateCustomer, deleteCustomer };
}

function friendlyDbError(
  e: unknown,
  kind: "branch" | "customer" | "unit",
): string {
  const msg = errMsg(e, "");
  if (/duplicate key/i.test(msg) || /unique/i.test(msg)) {
    if (kind === "branch") {
      if (/state/i.test(msg)) return "State already mapped to a branch";
      return "Branch code already exists";
    }
    if (kind === "unit") return "Client code already exists";
    if (/name/i.test(msg)) return "Organisation name already exists";
    return "Organisation ID already exists";
  }
  return msg || "Something went wrong";
}

// ───────────────────────── Units ─────────────────────────

export type ReportingOfficer = {
  name: string;
  isPrimary: boolean;
  isActive: boolean;
};

export type Unit = {
  id: string;
  code: string;
  name: string;
  location: string;
  description: string;
  status: CustomerStatus;
  /** Optional operational zone label. */
  zone: string;
  /** Optional client-side SAP code for this branch/site. */
  branchSapCode: string;
  /** MIS is sent on its own; excluded from combined MIS exports. */
  separateMis?: boolean;
  clientType?: string;
  hrExecutiveId?: string;
  mappingPayrollWindowId?: string;
  operationsManagerId?: string;
  accountManagerId?: string;
  payrollManagerId?: string;
  complianceManagerId?: string;
  dividingFactor?: string;
  complianceFrequency?: string;
  branchId: string | null;
  customerId: string | null;
  onboardingDate: string;
  closingDate: string;
  contractStartDate: string;
  contractEndDate: string;
  panNumber: string;
  gstPayable: boolean;
  gstType: string;
  gstNumber: string;
  billingSalutation: string;
  billingName: string;
  billingAddress1: string;
  billingAddress2: string;
  billingPincode: string;
  billingCity: string;
  billingDistrict: string;
  billingState: string;
  billingCountry: string;
  shippingSameAsBilling: boolean;
  shippingSameAsOrg: boolean;
  shippingSalutation: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingPincode: string;
  shippingCity: string;
  shippingDistrict: string;
  shippingState: string;
  shippingCountry: string;
  reportingOfficers: ReportingOfficer[];
  emergencyContactName: string;
  emergencyContactMobile: string;
  nearbyHospitalName: string;
  nearbyHospitalMobile: string;
  ambulanceName: string;
  ambulanceMobile: string;
  securityServiceName: string;
  securityServiceMobile: string;
  latitude: number | null;
  longitude: number | null;
  enablePt: boolean;
  enableLwf: boolean;
  uniformIncluded: boolean;
  uniformFeeAmount: number;
  recruitmentFeeEnabled: boolean;
  recruitmentFeeAmount: number;
  gpaipEnabled: boolean;
  gpaipAmount: number;
  /** Public holiday (PH) credit for this unit. */
  phEnabled: boolean;
  /** Extra duty credit on a public holiday: 1 or 2. */
  phMultiplier: number;
  /** Duty value of one PH-marked day for this unit. null = use the PH attendance code's day value. */
  phDayValue: number | null;
  bonusEnabled: boolean;
  bonusFrequency: BonusFrequency | null;
  /** true = EPF wage ceiling (₹15,000) applies AND attendance is capped to payroll days. */
  epfCapEnabled: boolean;
  /** ESIC branch (sub-code) this unit is registered under. */
  esicBranchId: string | null;
  /** false = non-billable unit (e.g. Radiant Office); drives non-billable onboarding. */
  isBillable: boolean;
};

export type BonusFrequency = "monthly" | "yearly" | "on_reimbursement";

export const BONUS_FREQUENCY_OPTIONS: { value: BonusFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "on_reimbursement", label: "On reimbursement" },
];

export function bonusFrequencyLabel(v: string | null | undefined) {
  return BONUS_FREQUENCY_OPTIONS.find((o) => o.value === v)?.label ?? "—";
}

export function nextUnitCode(units: { code: string }[]) {
  const nums = units
    .map((u) => parseInt(u.code.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `UN${max + 1}`;
}

const QK_UNITS = ["admin", "units"] as const;

type UnitRow = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
  description: string | null;
  status: CustomerStatus;
  zone?: string | null;
  branch_sap_code?: string | null;
  separate_mis?: boolean | null;
  client_type?: string | null;
  hr_executive_id?: string | null;
  mapping_payroll_window_id?: string | null;
  operations_manager_id?: string | null;
  account_manager_id?: string | null;
  dividing_factor?: number | null;
  compliance_frequency?: string | null;
  branch_id: string | null;
  customer_id: string | null;
  onboarding_date: string | null;
  closing_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  pan_number: string | null;
  gst_payable: boolean | null;
  gst_type: string | null;
  gst_number: string | null;
  billing_salutation: string | null;
  billing_name: string | null;
  billing_address1: string | null;
  billing_address2: string | null;
  billing_pincode: string | null;
  billing_city: string | null;
  billing_district: string | null;
  billing_state: string | null;
  billing_country: string | null;
  shipping_same_as_billing: boolean;
  shipping_same_as_org: boolean;
  shipping_salutation: string | null;
  shipping_name: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_pincode: string | null;
  shipping_city: string | null;
  shipping_district: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
  reporting_officers: unknown;
  emergency_contact_name: string | null;
  emergency_contact_mobile: string | null;
  nearby_hospital_name: string | null;
  nearby_hospital_mobile: string | null;
  ambulance_name: string | null;
  ambulance_mobile: string | null;
  security_service_name: string | null;
  security_service_mobile: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  enable_pt: boolean | null;
  enable_lwf: boolean | null;
  uniform_included: boolean | null;
  uniform_fee_amount?: number | string | null;
  recruitment_fee_enabled?: boolean | null;
  recruitment_fee_amount?: number | string | null;
  gpaip_enabled?: boolean | null;
  gpaip_amount?: number | string | null;
  ph_enabled?: boolean | null;
  ph_multiplier?: number | string | null;
  ph_day_value?: number | string | null;
  bonus_enabled?: boolean | null;
  bonus_frequency?: string | null;
  epf_cap_enabled?: boolean | null;
  esic_branch_id?: string | null;
  is_billable?: boolean | null;
};

function rowToUnit(r: UnitRow): Unit {
  const officersRaw = Array.isArray(r.reporting_officers)
    ? (r.reporting_officers as Array<Record<string, unknown>>)
    : [];
  const reportingOfficers: ReportingOfficer[] = officersRaw.map((o) => ({
    name: typeof o.name === "string" ? o.name : "",
    isPrimary: Boolean(o.is_primary ?? o.isPrimary),
    isActive: o.is_active === undefined && o.isActive === undefined ? true : Boolean(o.is_active ?? o.isActive),
  }));
  return {
    id: r.id,
    code: r.code,
    name: r.name ?? "",
    location: r.location ?? "",
    description: r.description ?? "",
    status: r.status,
    zone: r.zone ?? "",
    branchSapCode: r.branch_sap_code ?? "",
    separateMis: r.separate_mis === true,
    clientType: r.client_type ?? "",
    hrExecutiveId: r.hr_executive_id ?? "",
    mappingPayrollWindowId: r.mapping_payroll_window_id ?? "",
    operationsManagerId: r.operations_manager_id ?? "",
    accountManagerId: r.account_manager_id ?? "",
    payrollManagerId: r.payroll_manager_id ?? "",
    complianceManagerId: r.compliance_manager_id ?? "",
    dividingFactor: r.dividing_factor == null ? "" : String(r.dividing_factor),
    complianceFrequency: r.compliance_frequency ?? "",
    branchId: r.branch_id,
    customerId: r.customer_id,
    onboardingDate: r.onboarding_date ?? "",
    closingDate: r.closing_date ?? "",
    contractStartDate: r.contract_start_date ?? "",
    contractEndDate: r.contract_end_date ?? "",
    panNumber: r.pan_number ?? "",
    gstPayable: Boolean(r.gst_payable),
    gstType: r.gst_type ?? "",
    gstNumber: r.gst_number ?? "",
    billingSalutation: r.billing_salutation ?? "",
    billingName: r.billing_name ?? "",
    billingAddress1: r.billing_address1 ?? "",
    billingAddress2: r.billing_address2 ?? "",
    billingPincode: r.billing_pincode ?? "",
    billingCity: r.billing_city ?? "",
    billingDistrict: r.billing_district ?? "",
    billingState: r.billing_state ?? "",
    billingCountry: r.billing_country ?? "India",
    shippingSameAsBilling: r.shipping_same_as_billing,
    shippingSameAsOrg: r.shipping_same_as_org,
    shippingSalutation: r.shipping_salutation ?? "",
    shippingName: r.shipping_name ?? "",
    shippingAddress1: r.shipping_address1 ?? "",
    shippingAddress2: r.shipping_address2 ?? "",
    shippingPincode: r.shipping_pincode ?? "",
    shippingCity: r.shipping_city ?? "",
    shippingDistrict: r.shipping_district ?? "",
    shippingState: r.shipping_state ?? "",
    shippingCountry: r.shipping_country ?? "India",
    reportingOfficers,
    emergencyContactName: r.emergency_contact_name ?? "",
    emergencyContactMobile: r.emergency_contact_mobile ?? "",
    nearbyHospitalName: r.nearby_hospital_name ?? "",
    nearbyHospitalMobile: r.nearby_hospital_mobile ?? "",
    ambulanceName: r.ambulance_name ?? "",
    ambulanceMobile: r.ambulance_mobile ?? "",
    securityServiceName: r.security_service_name ?? "",
    securityServiceMobile: r.security_service_mobile ?? "",
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    enablePt: Boolean(r.enable_pt),
    enableLwf: Boolean(r.enable_lwf),
    uniformIncluded: r.uniform_included == null ? true : Boolean(r.uniform_included),
    uniformFeeAmount: Number(r.uniform_fee_amount ?? 0),
    recruitmentFeeEnabled: Boolean(r.recruitment_fee_enabled),
    recruitmentFeeAmount: Number(r.recruitment_fee_amount ?? 0),
    gpaipEnabled: Boolean(r.gpaip_enabled),
    gpaipAmount: Number(r.gpaip_amount ?? 0),
    phEnabled: Boolean(r.ph_enabled),
    phMultiplier: Number(r.ph_multiplier ?? 1) || 1,
    phDayValue:
      r.ph_day_value == null || Number.isNaN(Number(r.ph_day_value)) ? null : Number(r.ph_day_value),
    bonusEnabled: Boolean(r.bonus_enabled),
    bonusFrequency: (r.bonus_frequency as BonusFrequency | null) ?? null,
    epfCapEnabled: r.epf_cap_enabled == null ? true : Boolean(r.epf_cap_enabled),
    esicBranchId: r.esic_branch_id ?? null,
    isBillable: r.is_billable == null ? true : Boolean(r.is_billable),
  };
}

function unitToRow(data: Omit<Unit, "id">) {
  const code = data.code.trim();
  if (!code) throw new Error("Client code is required");
  if (!data.name.trim()) throw new Error("Client name is required");
  return {
    code,
    name: data.name.trim(),
    location: data.location.trim(),
    description: data.description.trim(),
    status: data.status,
    zone: data.zone?.trim() || null,
    branch_sap_code: data.branchSapCode?.trim() || null,
    separate_mis: data.separateMis === true,
    client_type: data.clientType?.trim() || null,
    hr_executive_id: data.hrExecutiveId || null,
    mapping_payroll_window_id: data.mappingPayrollWindowId || null,
    operations_manager_id: data.operationsManagerId || null,
    account_manager_id: data.accountManagerId || null,
    payroll_manager_id: data.payrollManagerId || null,
    compliance_manager_id: data.complianceManagerId || null,
    dividing_factor: data.dividingFactor && Number.isFinite(Number(data.dividingFactor)) ? Number(data.dividingFactor) : null,
    compliance_frequency: data.complianceFrequency || null,
    branch_id: data.branchId || null,
    customer_id: data.customerId || null,
    onboarding_date: data.onboardingDate || null,
    closing_date: data.closingDate || null,
    contract_start_date: data.contractStartDate || null,
    contract_end_date: data.contractEndDate || null,
    pan_number: data.panNumber.trim(),
    gst_payable: Boolean(data.gstPayable),
    gst_type: data.gstPayable ? (data.gstType || null) : null,
    gst_number: data.gstPayable ? data.gstNumber.trim() : "",
    billing_salutation: data.billingSalutation,
    billing_name: data.billingName,
    billing_address1: data.billingAddress1,
    billing_address2: data.billingAddress2,
    billing_pincode: data.billingPincode,
    billing_city: data.billingCity,
    billing_district: data.billingDistrict,
    billing_state: data.billingState,
    billing_country: data.billingCountry || "India",
    shipping_same_as_billing: data.shippingSameAsBilling,
    shipping_same_as_org: data.shippingSameAsOrg,
    shipping_salutation: data.shippingSalutation,
    shipping_name: data.shippingName,
    shipping_address1: data.shippingAddress1,
    shipping_address2: data.shippingAddress2,
    shipping_pincode: data.shippingPincode,
    shipping_city: data.shippingCity,
    shipping_district: data.shippingDistrict,
    shipping_state: data.shippingState,
    shipping_country: data.shippingCountry || "India",
    reporting_officers: data.reportingOfficers.map((o) => ({
      name: o.name,
      is_primary: o.isPrimary,
      is_active: o.isActive,
    })),
    emergency_contact_name: data.emergencyContactName,
    emergency_contact_mobile: data.emergencyContactMobile,
    nearby_hospital_name: data.nearbyHospitalName,
    nearby_hospital_mobile: data.nearbyHospitalMobile,
    ambulance_name: data.ambulanceName,
    ambulance_mobile: data.ambulanceMobile,
    security_service_name: data.securityServiceName,
    security_service_mobile: data.securityServiceMobile,
    latitude: data.latitude,
    longitude: data.longitude,
    enable_pt: data.enablePt,
    enable_lwf: data.enableLwf,
    uniform_included: data.uniformIncluded,
    uniform_fee_amount: data.uniformIncluded ? 0 : Number(data.uniformFeeAmount || 0),
    recruitment_fee_enabled: data.recruitmentFeeEnabled,
    recruitment_fee_amount: data.recruitmentFeeEnabled ? Number(data.recruitmentFeeAmount || 0) : 0,
    gpaip_enabled: data.gpaipEnabled,
    gpaip_amount: data.gpaipEnabled ? Number(data.gpaipAmount || 0) : 0,
    ph_enabled: data.phEnabled,
    ph_multiplier: data.phEnabled ? Number(data.phMultiplier || 1) : 1,
    ph_day_value: data.phDayValue == null ? null : Number(data.phDayValue),
    bonus_enabled: data.bonusEnabled,
    bonus_frequency: data.bonusEnabled ? (data.bonusFrequency ?? "monthly") : null,
    epf_cap_enabled: data.epfCapEnabled,
    esic_branch_id: data.esicBranchId || null,
    is_billable: data.isBillable !== false,
  };
}

export function useUnits() {
  const qc = useQueryClient();
  const enabled = useAdminQueryEnabled();

  const { data: units = [] } = useQuery({
    queryKey: QK_UNITS,
    enabled,
    queryFn: async (): Promise<Unit[]> => {
      // PostgREST caps a single response at 1000 rows — page through everything.
      const pageSize = 1000;
      const all: UnitRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("units")
          .select("*")
          .order("code", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as UnitRow[];
        all.push(...rows);
        if (rows.length < pageSize) break;
      }
      return all.map(rowToUnit);
    },

  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK_UNITS });

  const addMut = useMutation({
    mutationFn: async (data: Omit<Unit, "id">): Promise<string> => {
      const { data: inserted, error } = await supabase
        .from("units")
        .insert(unitToRow(data) as never)
        .select("id")
        .single();
      if (error) throw error;
      void logActivity({ module: "Clients", action: "create", entityType: "units", entityLabel: (data as unknown as { name?: string; code?: string }).name || (data as unknown as { code?: string }).code || "", details: data as unknown as Record<string, unknown> });
      return (inserted as { id: string }).id;
    },
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<Unit, "id"> }) => {
      const { data: updated, error } = await supabase
        .from("units")
        .update(unitToRow(data) as never)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("The client was not updated. Please check your access and try again.");
      void logActivity({ module: "Clients", action: "update", entityType: "units", entityId: id, entityLabel: (data as unknown as { name?: string; code?: string }).name || (data as unknown as { code?: string }).code || "", details: data as unknown as Record<string, unknown> });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
      void logActivity({ module: "Clients", action: "delete", entityType: "units", entityId: id });
    },
    onSuccess: invalidate,
  });

  const addUnit = async (data: Omit<Unit, "id">): Promise<Result> => {
    try {
      const id = await addMut.mutateAsync(data);
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "unit") };
    }
  };

  const updateUnit = async (id: string, data: Omit<Unit, "id">): Promise<Result> => {
    try {
      await updateMut.mutateAsync({ id, data });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyDbError(e, "unit") };
    }
  };

  const deleteUnit = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
    } catch (e) {
      throw new Error(errMsg(e, "Could not delete client"));
    }
  };

  return { units, addUnit, updateUnit, deleteUnit };
}
