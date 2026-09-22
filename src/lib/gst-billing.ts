import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrgSettings } from "@/lib/org-settings";

export type GstBillingBranch = {
  id: string;
  code: string;
  name: string;
  gstin: string;
  registeredAddress: string;
  corporateAddress: string;
  stateName: string;
  stateCode: string;
  isDefault: boolean;
};

export function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

export async function loadGstBillingBranches(): Promise<GstBillingBranch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("id, code, name, gstin, registered_address, corporate_address, gst_state_name, gst_state_code, is_gst_default")
    .eq("is_gst_billing_branch", true);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name ?? "",
    gstin: row.gstin ?? "",
    registeredAddress: row.registered_address ?? "",
    corporateAddress: row.corporate_address ?? "",
    stateName: row.gst_state_name ?? "",
    stateCode: row.gst_state_code ?? "",
    isDefault: Boolean(row.is_gst_default),
  }));
}

export function useGstBillingBranches() {
  return useQuery({
    queryKey: ["gst-billing-branches"],
    queryFn: loadGstBillingBranches,
    staleTime: 5 * 60_000,
  });
}

export function resolveGstBillingBranch(
  branches: GstBillingBranch[],
  clientState: string | null | undefined,
  fallback?: OrgSettings | null,
): GstBillingBranch | null {
  const state = normalizeState(clientState);
  const matched = branches.find((branch) => normalizeState(branch.stateName) === state);
  if (matched) return matched;
  const configuredDefault = branches.find((branch) => branch.isDefault);
  if (configuredDefault) return configuredDefault;
  if (!fallback?.company_gstin) return null;
  return {
    id: fallback.id,
    code: "HQ",
    name: "Maharashtra Head Office",
    gstin: fallback.company_gstin,
    registeredAddress: fallback.registered_address ?? "",
    corporateAddress: fallback.corporate_address ?? "",
    stateName: fallback.company_state ?? "Maharashtra",
    stateCode: fallback.company_state_code ?? "27",
    isDefault: true,
  };
}

export function taxSplit(taxableValue: number, intraState: boolean) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const cgst = intraState ? round(taxableValue * 0.09) : 0;
  const sgst = intraState ? round(taxableValue * 0.09) : 0;
  const igst = intraState ? 0 : round(taxableValue * 0.18);
  return { cgst, sgst, igst, total: round(cgst + sgst + igst) };
}