# September invoices: match every Drive invoice exactly

## Scope
Only clients that have a September invoice in Drive are changed. Everything else (including the 1,473 invoices already matching and all payroll) is left exactly as it is.

Sources in Drive:
1. Radiant Launch / _PR_21 / invoices_21 — BFSL, BFL, L&T invoices plus their MIS sheets (SG rate, per-day rate, attendance, total duties).
2. Radiant Launch / Bank Tax Invoice September 2026 — every bank tax invoice.

## Steps
1. **Read every invoice and MIS file** from both folders. For each invoice line capture: client/branch, invoice number, designation, monthly SG rate, per-duty rate, duties (regular, Extra Duty, reliever), taxable value, GST.
2. **Map each line to our client ID** (by branch/site name, MIS branch code, invoice number; consolidated invoices are split to their sites). Anything that cannot be mapped is listed by name, not guessed.
3. **Compare with our live September invoice** (same engine the invoice screen uses), line by line: rate, duties, amount.
4. **Fix only the differences**, invoice is the authority:
   - Rate differs: set the billing rate so our per-duty rate equals the invoice rate exactly (billing-only rate line, re-solved so reliever/management-fee formulas don't move it again — the cause of the earlier drift on CLI1359).
   - Duties differ: align our attendance (regular / Extra Duty / reliever split) to the invoice/MIS duties.
   - Separate regular, Extra Duty and reliever invoices are compared separately.
5. **Re-run the live invoice for every changed site** and confirm each equals the Drive invoice within ₹1–2. Repeat until all mapped invoices match.
6. **Payroll check after attendance changes**: only sites where duties were changed are recalculated; payroll stays equal to Pages (existing per-employee payroll adjustments re-balanced where needed). Payroll of all other sites untouched.
7. **Deliver** `Payroll_Invoice_Status_Sep2026_v11.xlsx`: every Drive invoice with client figure vs ours, what was changed, and final Match status; plus an updated summary. Thumbs-up given only if every mapped invoice matches on the live numbers.

## Rules kept
- Banks: billing-only — employee roles and salaries are not changed.
- BFSL/BFL payroll cycle 21 Aug–20 Sep; ₹1–2 tolerance; fixed-26 + Extra Duty split is accepted.
- No "adjustment as per client invoice" lines visible on the invoice; changes go into the rate and duties.
- Live system only; nothing outside the Drive-invoice clients is edited.

## Technical notes
- Drive access via the Google Drive connector (one-off gateway calls); PDFs parsed with pdfplumber/pdftotext, MIS via pandas.
- Rate fix uses the `Billing Rate Adjustment` employer line on the period contract (`fetchPeriodContract` with the new tie-break), solved against `refreshBillingAddOns` so the live screen shows the same number.
- Duty fixes write `attendance_entries` with import source; payroll re-aligned through existing `pages_sep_2026_recon` rows only for affected employees.
- Note: user asked that payroll follow the new rate structure automatically. Because September payroll is now locked to Pages per employee, rate changes are applied billing-only so payroll does not move; payroll components are not changed.
