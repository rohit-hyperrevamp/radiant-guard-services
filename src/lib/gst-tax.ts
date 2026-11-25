/** Contract opt-out leaves the existing state-based GST split unchanged. */
export function taxSplit(taxableValue: number, intraState: boolean, gstOption?: string | null) {
  const enabled = gstOption !== "none";
  const round = (value: number) => Math.round(value * 100) / 100;
  const cgst = enabled && intraState ? round(taxableValue * 0.09) : 0;
  const sgst = enabled && intraState ? round(taxableValue * 0.09) : 0;
  const igst = enabled && !intraState ? round(taxableValue * 0.18) : 0;
  return { cgst, sgst, igst, total: round(cgst + sgst + igst) };
}

export function finalInvoiceTax(lines: { taxableValue: number; gstOption?: string | null }[], intraState: boolean) {
  return Math.round(lines.reduce((sum, line) => sum + taxSplit(line.taxableValue, intraState, line.gstOption).total, 0) * 100) / 100;
}

/** State names compared the way the invoice detail page does ("Tamil Nadu" = "TamilNadu"). */
export function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Supplier (company) state for one invoice, exactly as the invoice detail page
 * resolves it: the matched GST billing branch, else org_settings.company_state.
 */
export function invoiceCompanyState(branchStateName: string | null | undefined, orgCompanyState: string | null | undefined) {
  return String(branchStateName || orgCompanyState || "Maharashtra").trim();
}

/** CGST+SGST when the site's billing state is the supplier state, else IGST. */
export function isIntraStateSupply(billingState: string | null | undefined, companyState: string | null | undefined) {
  return normalizeState(billingState) === normalizeState(companyState);
}

/** Final invoice total stored and printed: grand total rounded to the rupee. */
export function finalInvoiceGrandTotal(taxableValue: number, taxTotal: number) {
  return Math.round(Math.round((taxableValue + taxTotal) * 100) / 100);
}

/** Today's calendar date in India (IST, UTC+05:30) as YYYY-MM-DD — never the UTC date. */
export function istDateISO(now: Date = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
