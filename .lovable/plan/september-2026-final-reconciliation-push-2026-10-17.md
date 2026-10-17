# September 2026 – Final reconciliation push

Goal: finish every remaining group in the tracker and mark it Match, using your full permission to hard-code. Every number entered comes from a real source: Pages wage register, client PDF/MIS, Drive rate sheet or the contract. The final thumbs-up comes only after a fresh check against the live system.

Note on counts: the current tracker shows **139** payroll Not match (not 193). "117" is taken to mean the **170** invoice Not match. "The last two" are taken to mean the **505** invoice Pending plus the two open BFSL branches (Guwahati CLI1979, Raipur CLI2023). If you meant something else, say so and the plan will change.

## 1. Payroll Not match (139 sites)

For each site, compare each employee against the Pages wage register: gross, PF, ESI, PT, other deductions and net pay.
- **Other deductions** (advance, uniform, canteen, fine and similar): enter Pages' exact amount for that employee as a fixed September deduction.
- **PF / ESI differences:** fix the contract deduction line where the rule is wrong. If Pages used a one-off figure, enter the exact amount as a September-only override.
- **PT:** apply the correct state slab. If Pages charged something different, use the Pages figure.
- **Duty split / fixed-day differences:** these count as Match under your earlier rule. The difference is shown in the row.
- Re-run September payroll for the site and confirm net pay is within ₹2 of Pages for every employee. Then mark it Match.

## 2. Payroll Pending (268 sites)

Search Pages and Drive by client ID (CLI number) and by client/site name, including near-spellings.
- **Found** (attendance + rate structure): load the attendance, put the rate structure on the contract, run September payroll and check it against Pages. Then mark it Match.
- **Not found anywhere** (no contract, no staff, no September attendance in Pages, Drive or our system): these sites had no September payroll. They move to a separate **"No September payroll – inactive"** status, listed with the evidence for each. They are not marked Match, because a match with nothing to compare against would be false. They also stay out of the "pending" total.

## 3. Invoice Not match (170 sites)

- **Client PDF or MIS in Drive:** change our rate structure and duties to the client's numbers, keeping the regular / Extra Duty / reliever split. Recalculate and confirm we are within ₹1–2 of the client's figure. Then mark it Match.
- **No client file in Drive:** treat it like the Pending group (step 4).

## 4. Invoice Pending (505 sites)

Clients didn't send invoices for these. For each site, check:
1. The contract rate structure (CTC and its parts) gives the billed rate.
2. Our payroll for the site matches Pages.
3. Our invoice equals rate × duties + extras + GST, with correct basic math.

If all three pass, mark it Match. Where one fails, fix the contract or invoice line and re-check. Sites with no September attendance at all go to the same "No September activity" status as in step 2.

## 5. BFSL Guwahati (CLI1979) and Raipur (CLI2023)

- **Guwahati:** hard-code GST to the client's figure. This settles the ₹0.01 rounding conflict.
- **Raipur:** match the duties and rate to the BFSL invoice line, then recalculate.

## 6. Final delivery

- Tracker v10: Summary, cycle sheets and "Fixed This Time". Every changed row gets its reason and its source (Pages, PDF, MIS, Drive or contract).
- Updated detail list, plus a new "No September activity" tab with the evidence for each site.
- The thumbs-up states only verified numbers. The target is Payroll 0 Not match / 0 Pending and Invoice 0 Not match / 0 Pending. Inactive sites are reported separately, with proof.

## Technical details

- All writes go to production through `psql "$RADIANT_PROD_DB_URL"`, in guarded, idempotent migrations, one per group:
  - `..._sep_payroll_deduction_overrides.sql`
  - `..._sep_pending_contract_rates.sql`
  - `..._sep_invoice_rate_alignment.sql`
  - `..._bfsl_guwahati_raipur.sql`
- Each migration has a pre-check (expected current values) and a post-readback.
- Never replay `20261017040000_bfsl_five_ed_supplements.sql`. Never apply `20261017031000_sep_pages_attendance.sql`.
- The 1,310 matched payroll and 1,042 matched invoice rows are not touched. A before/after hash of their totals proves this.
- Override rows are scoped to the September period (`period_start`/`period_end`), so later months are unaffected.
- Drive search uses the "Vipit's Google Drive" connection: file names containing the CLI code or client name, for September rate sheets, MIS and invoices.
- Extend `src/lib/bfsl-september-reconciliation.test.ts` with tests for Guwahati/Raipur and a sample of the deduction overrides, then run them.
- Rebuild the Excel with paper-xlsx and recalculate (0 formula errors). Add it to the "September Reconciliation Trackers" collection.
