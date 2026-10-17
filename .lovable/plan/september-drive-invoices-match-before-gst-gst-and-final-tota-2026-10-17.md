# September Drive invoices: match before-GST, GST and final total exactly

## Problem reported
On some invoices, our total *including* GST equals the client's amount *before* GST. That means the rate we set was too high by the GST amount: we added GST on top of a figure that already had it. The cause is not confirmed yet, so step 1 is to check it.

## Scope
Only the September invoices in Drive (Radiant Launch / 1_PR_21 / invoices_21 and Bank Tax Invoice Sep 2026). Every other invoice and all payroll stay as they are. For banks, only billing changes: no employee roles or salaries are changed.

## Steps
1. **Confirm the cause.** For every invoice from the 17 Oct rate fixes (the 39 rate-set sites plus the bank invoices), compare three numbers against the client invoice: amount before GST, GST (CGST/SGST or IGST) and final total. Flag every site where our before-GST amount equals the client's final total, or where our final total equals the client's before-GST amount.
2. **Re-read every Drive invoice** and record its before-GST amount, GST, final total, per-duty rate, duties and GST type (same state or other state). If an invoice only shows one figure, work out the other two and note that on the row.
3. **Fix the rate on every flagged site** so our before-GST amount equals the client's before-GST amount. GST is then calculated on top of that. This is a billing-only rate change, with no visible "adjustment" line. Also check the GST type (same state or other state) against the client invoice.
4. **Check all 772 again, one invoice at a time**, using the same calculation as the invoice screen. Separate regular, Extra Duty and reliever invoices are checked separately. All three amounts (before GST, GST, final total) must be within ₹1–2. A site that matched only on one total is not counted as Match.
5. **Recheck the ones already marked Match** against the real client invoice: both the full matches and the ones that are only partly off. Any site that doesn't match on all three amounts is fixed in the same way as step 3.
6. **Sites with no client invoice in Drive:** if the site's payroll matches Pages, and our invoice comes out correctly from that same rate structure (rate × duties + extras, then GST at 18%, with the basic math checked), it is marked Match. If the invoice doesn't come out of the structure correctly, the invoice line is fixed and then checked again.
7. **Repeat** until every row matches. If a row truly can't be fixed (for example, a client invoice that can't be tied to any of our sites), it is listed by name with its exact reason, so you can decide what to do with it.
8. **Deliver v12** of the workbook. The "Drive invoices" sheet gets client vs ours columns for before GST, GST and final total, a difference for each, what was changed and the result. The Summary counts are updated. The final thumbs-up is given once every row is verified on the live numbers.

## Technical details
- Production only, via `psql "$RADIANT_PROD_DB_URL"`. Before writing, back up the affected `contract_resources` rows to a dated `_bkp_` table.
- Re-solve the `Billing Rate Adjustment` employer line against the taxable value, not the grand total, using `refreshBillingAddOns` and `fetchPeriodContract` (which now has the tie-break).
- Check `taxSplit` intra/inter-state against the GST billing branch and client state. Fix the branch mapping only where it differs from the client invoice.
- Write a guarded, idempotent migration `2026101706xxxx_sep_drive_invoice_taxable_rates.sql`, with a pre-check and a read-back.
- Add a test asserting that the rate solves to the taxable value (not the total incl. GST) and that GST is 18% on top of it, then run it.
- Build the workbook with paper-xlsx, recalculate it and confirm there are 0 formula errors.
