# September payroll duplication: sources and safe correction

Read-only follow-up, 24 November 2026. No payroll, attendance, invoice, contract or historical revision was changed during this review.

## Confirmed findings

- September snapshot: 246 employee-level duplicate flags across 46 clients, comprising 51 exact-duplicate flags across two clients and 195 conflicting-setting flags across 44 clients. These are not 246 independent contract defects. Deduplicating period/role/shift/component findings yields 86 distinct flags, still not 86 proven excess charges.
- Production currently contains zero classified reconciliation additions, deductions or snapshot earning/adjustment lines. Earlier Pages-matching balancing was real: deletion audit for CLI4530 has `source_kind=pages_sep_2026_recon` and explicitly says September net pay was aligned to the wage register. Those removed balancing entries are separate from contract-array duplicates.
- **CLI3210 / CON16102:** saved Security Supervisor deductions contain `ALFA EE PT` ₹200 and `EE Professional Tax` ₹200. Audit of resource `81bfa101-7ee1-4644-801f-58db76652e1a` shows one PT line before 17 October 2026 03:03:50 UTC and both afterward. The old update checked only names containing `professional tax`, so it failed to recognise the existing `ALFA EE PT` shorthand. The repository's `20261017050000_pt_missing_contract_lines.sql` contains that exact append rule for CLI3210. This is a confirmed matching-era automated-update defect, not an authorised extra tax. The audit actor is `System (automatic)` and does not identify a human creator.
- **CLI3018 / CON16255:** the September report flags two employer PF variants. Production revisions for resource `d49af5f2-d76f-4c61-9263-2e660c48109d` show one 13% PF formula capped at ₹15,000 for 1–16 September and one capped at ₹18,000 for 17 September onward. They apply on separate date windows. `rate-revisions.ts` blends differently named variants into separate weighted lines before the new contract-duplicate validator runs; therefore this report flag does not establish simultaneous duplicate liability or an excess amount. Do not delete either historical rate merely because both appear in a monthly output.

## Existing protection versus remaining work

- The new contract-only engine ignores billable-client adjustment ledgers, Pages allocations and personal salary overrides. Office salary setup is separate.
- Exact same-side saved calculations are applied once and reported, without changing the source contract. Different nonzero settings with the same liability key block processing rather than select a rate by assumption.
- Employee PF, employer PF, PF administration, EPS/pension, EDLI and Extra Duty ESIC are distinct liabilities. They must not be collapsed into one item just because their names mention PF/ESIC.
- The exception classifier needs rate-window awareness: validate the original applicable contract revision within each date segment before interpreting the blended monthly output as a duplicate. CLI3018 provides concrete evidence for that improvement. This follow-up did not implement it or revise the workbooks.
- Missing caps, unknown formula variables and PH/Bonus/Leave provision-versus-payment questions require their own source-backed review; none is automatically a duplicate. A negative margin is not permission to force an adjustment.

## Recommended correction sequence

1. Back up affected saved contract arrays and historical revisions; retain their original audit evidence.
2. Match equivalent liabilities across their saved names, separately for employee/employer sides and applicable date windows.
3. Remove only proven extra same-window charges; for differing formulas choose the authorised contract/source-sheet setting, not whichever makes a margin positive.
4. Preserve legitimate sequential rate revisions and genuine distinct liabilities. Pages remains comparison evidence only, never a source of balancing entries.
5. Recalculate affected unprocessed payrolls through the shared engine and refresh source-backed finance totals. Compare paid/processed records separately; changes there need their existing amendment/approval process.

## Limits

This review establishes the origin of the CLI3210 shorthand duplicate and the provenance of removed Pages balancing. It does not establish the creator or Pages origin of every remaining contract flag. The September counts describe the earlier 15:46–15:49 UTC snapshot, not a new company-wide live recalculation. Signed-in production selector and payroll interaction were not exercised; no preview/localhost checks were used.