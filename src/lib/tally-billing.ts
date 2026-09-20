import { writeXlsx } from "@/lib/csv-export";

// Shared Tally billing-file export. Used by the per-invoice export on the
// invoice detail page and the combined multi-invoice export on the invoice
// charter. Tally needs a strict column set — do not reorder or rename.

export const TALLY_BILLING_HEADERS = [
  "Vch No.", "Vch Type", "Date", "GST Registration", "Bill to Place", "Ship to Place", "Reference No.",
  "Delivery Note No", "Delivery Note Date", "Order No", "Order Date", "Party Name", "Ledger Group",
  "Registration Type", "GSTIN No", "Country", "State", "Pincode", "Address 1", "Address 2", "Address 3",
  "Cost Center", "Cost Center Amt", "Sales Ledger", "Item Name", "Stock Group", "Client", "Maintain Batches",
  "Applicable From", "HSN Description", "HSN", "IGST Rate", "CGST Rate", "SGST Rate", "CESS Rate",
  "Tracking No", "Order No ", "Order Due Date", "Godown", "Batch", "Qty ", "Incluse", "Rate", "Amt",
  "Additional Ledger", "Amount", "CGST Ledger", "CGST Amt", "SGST Ledger", "SGST Amt", "IGST Ledger",
  "IGST Amt", "CESS Ledger", "CESS Amt", "Total", "Narration", "TALLYIMPORTSTATUS",
] as const;

export type TallyBillingParty = {
  code?: string | null;
  name?: string | null;
  customer_name?: string | null;
  gstin?: string | null;
  billing_state?: string | null;
  billing_address1?: string | null;
  billing_address2?: string | null;
  billing_city?: string | null;
  billing_district?: string | null;
  billing_pincode?: string | null;
  billing_country?: string | null;
  customer?: {
    billing_state?: string | null;
    billing_address1?: string | null;
    billing_address2?: string | null;
    billing_city?: string | null;
    billing_district?: string | null;
    billing_pincode?: string | null;
    billing_country?: string | null;
  } | null;
};

export type TallyBillingLine = {
  /** Billable quantity (days/duties, or 1 for lumpsum). */
  qty: number;
  /** Per-quantity rate. */
  rate: number;
  /** Taxable amount for the line. */
  amount: number;
  /** Contracted monthly rate behind the line (for the item name). */
  monthly: number;
};

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function fmtPretty(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${String(d).padStart(2, "0")} ${months[m - 1].slice(0, 3)} ${y}`;
}

export function tallyVoucherNo(unitCode: string, periodStart: string) {
  const [ys, ms] = periodStart.split("-").map(Number);
  const fyStart = ms >= 4 ? ys : ys - 1;
  const fyEnd = fyStart + 1;
  return `${MONTH_ABBR[ms - 1]}${String(ys).slice(2)}-${String(fyEnd).slice(2)}${(unitCode || "").toUpperCase()}`;
}

export function buildTallyVoucherRows(args: {
  unit: TallyBillingParty;
  companyState: string;
  periodStart: string;
  periodEnd: string;
  serviceTypeName: string;
  lines: TallyBillingLine[];
}): Record<string, unknown>[] {
  const { unit, companyState, periodStart, periodEnd, serviceTypeName, lines } = args;
  const COMPANY_STATE = companyState;
  const COMPANY_STATE_SHORT = companyState.slice(0, 4);

  const billingState = unit.billing_state || unit.customer?.billing_state || "";
  const isIntraState = billingState.trim().toLowerCase() === COMPANY_STATE.toLowerCase();
  const gstRate = 18;
  const cgstRate = isIntraState ? 9 : 0;
  const sgstRate = isIntraState ? 9 : 0;
  const igstRate = isIntraState ? 0 : gstRate;
  const salesLedger = isIntraState
    ? `Sale ${serviceTypeName} Charges ${COMPANY_STATE_SHORT} SGST/CGST ${gstRate}%`
    : `Sale ${serviceTypeName} Charges ${COMPANY_STATE_SHORT} IGST ${gstRate}%`;

  const vchNo = tallyVoucherNo(unit.code ?? "", periodStart);
  const vchDate = periodEnd;
  const partyName = `${unit.customer_name || ""}, ${unit.name || unit.code || ""}`.trim();

  const addr1 = unit.billing_address1 || unit.customer?.billing_address1 || "";
  const addr2 = unit.billing_address2 || unit.customer?.billing_address2 || "";
  const addr3 = [
    unit.billing_city || unit.customer?.billing_city,
    unit.billing_district || unit.customer?.billing_district,
    unit.billing_pincode || unit.customer?.billing_pincode,
  ].filter(Boolean).join(", ");
  const pincode = unit.billing_pincode || unit.customer?.billing_pincode || "";
  const country = unit.billing_country || unit.customer?.billing_country || "India";

  return lines.map((line) => {
    const amt = Math.round(line.amount * 100) / 100;
    const cgstAmt = Math.round(amt * (cgstRate / 100) * 100) / 100;
    const sgstAmt = Math.round(amt * (sgstRate / 100) * 100) / 100;
    const igstAmt = Math.round(amt * (igstRate / 100) * 100) / 100;
    const total = Math.round((amt + cgstAmt + sgstAmt + igstAmt) * 100) / 100;
    return {
      "Vch No.": vchNo,
      "Vch Type": `Sales ${COMPANY_STATE}`,
      "Date": vchDate,
      "GST Registration": `${COMPANY_STATE} Registration`,
      "Bill to Place": "",
      "Ship to Place": "",
      "Reference No.": vchNo,
      "Delivery Note No": "",
      "Delivery Note Date": "",
      "Order No": "",
      "Order Date": "",
      "Party Name": partyName,
      "Ledger Group": "Sundry Debtors",
      "Registration Type": "Regular",
      "GSTIN No": unit.gstin || "",
      "Country": country,
      "State": billingState,
      "Pincode": pincode,
      "Address 1": addr1,
      "Address 2": addr2,
      "Address 3": addr3,
      "Cost Center": COMPANY_STATE,
      "Cost Center Amt": "",
      "Sales Ledger": salesLedger,
      "Item Name": `${serviceTypeName} @${line.monthly.toFixed(2)} Per Month`,
      "Stock Group": "Primary",
      "Client": "Duty",
      "Maintain Batches": "Yes",
      "Applicable From": "01-Jul-2017",
      "HSN Description": `${serviceTypeName} Services`,
      "HSN": 998525,
      "IGST Rate": igstRate || gstRate,
      "CGST Rate": cgstRate || 9,
      "SGST Rate": sgstRate || 9,
      "CESS Rate": "",
      "Tracking No": "",
      "Order No ": "",
      "Order Due Date": "",
      "Godown": "",
      "Batch": "",
      "Qty ": line.qty,
      "Incluse": "",
      "Rate": Math.round(line.rate * 1000000) / 1000000,
      "Amt": amt,
      "Additional Ledger": "",
      "Amount": "",
      "CGST Ledger": isIntraState ? `${COMPANY_STATE} CGST` : "",
      "CGST Amt": isIntraState ? cgstAmt : "",
      "SGST Ledger": isIntraState ? `${COMPANY_STATE} SGST` : "",
      "SGST Amt": isIntraState ? sgstAmt : "",
      "IGST Ledger": !isIntraState ? `${COMPANY_STATE} IGST` : "",
      "IGST Amt": !isIntraState ? igstAmt : "",
      "CESS Ledger": "",
      "CESS Amt": "",
      "Total": total,
      "Narration": `${fmtPretty(periodStart)} To ${fmtPretty(periodEnd)} Invoice`,
      "TALLYIMPORTSTATUS": "",
    } satisfies Record<string, unknown>;
  });
}

export async function writeTallyBillingXlsx(filename: string, rows: Record<string, unknown>[]) {
  const columns = TALLY_BILLING_HEADERS.map((h) => ({ key: h, header: h }));
  await writeXlsx({ filename, rows, columns });
}
