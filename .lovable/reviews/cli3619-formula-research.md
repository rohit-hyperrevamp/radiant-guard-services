# CLI3619 formula trial: verified results and limits

## Scope and backup

Only active CLI3619 contract CON15115, Security Guard and Security Supervisor. Original rate structures for all four CLI3619 contracts are saved in `db/backups/cli3619-rate-structure-20261124.json`. The guarded restoration script restores the original active contract rate fields and refuses to overwrite later edits. Apply and exact restoration both passed production rollback testing.

No other client, historic resource, contract header, approval, attendance, processed payroll or shared formula master was changed. Production checks confirmed that contract amounts exactly match the tested proposal after the update.

## Applied verified formulas

- Employee EPF: 12% of Basic + DA, ceiling ₹15,000. Linked to the existing matching master; full-month amount stays ₹1,800 for each role.
- Employer EPF: 13% of Gross − HRA, ceiling ₹15,000. Linked to the existing matching master; full-month amount stays ₹1,950 for each role.
- Employer EPF now responds to earned wages rather than remaining the old flat ₹1,950 for every attendance quantity. Employee EPF was already an unlinked formula; it now has a matching existing master link.

These bases are printed on the supplied Cipla sheets. They are not guesses based only on matching a number.

## Independent research requested without another source sheet

Read both uploaded Cipla PDFs visually. Examined 31 Cipla contract-role structures; none provides a configured HRA, Bonus or Leave formula. Compared 72 relevant existing allowance-master evaluations against the two current roles, including rupee rounding: no existing candidate reproduces the saved amounts. Shared masters were not edited and no calibrated percentage was created.

| Item | Guard saved | Example formula result | Supervisor saved | Example formula result |
| --- | ---: | ---: | ---: | ---: |
| HRA, using 20% of Basic + DA | ₹3,224 | ₹3,208.40 | ₹4,914 | ₹3,494.40 |
| Statutory Bonus, using 8.33% of Basic + DA | ₹1,326 | ₹1,336.30 | ₹1,456 | ₹1,455.42 |
| Leave Encashment, using 5% of Basic + DA | ₹806 | ₹802.10 | ₹858 | ₹873.60 |

Supervisor Bonus equals exactly `(Basic + DA) / 12`, but Guard Bonus does not. That is a mathematical clue, not proof of the agreed policy. Likewise, dividing each saved allowance by Basic + DA creates an implied percentage but cannot establish the actual base or original rule. Applying those ratios would hide an unexplained value behind a formula rather than verify it.

Basic, DA, HRA, Bonus and Leave remain at the correct agreed amounts. LWF ₹10/₹30, WC Policy ₹225, Uniform ₹360 and Management Fee ₹900 are shown as flat amounts without percentage labels on the supplied sheets; no percentage was invented for them.

## Preservation results

| Role | Gross | Employee deductions | Net | Monthly billing |
| --- | ---: | ---: | ---: | ---: |
| Security Guard | ₹21,398 | ₹1,810 | ₹19,588 | ₹24,863 |
| Security Supervisor | ₹24,700 | ₹1,810 | ₹22,890 | ₹28,165 |

Focused tests check editor amount evaluation, payroll full-month and partial-attendance EPF, master hydration, unknown references, and before/after invoice-engine taxable values. Production readback confirmed both saved rows. Scoped finance totals were invalidated by the existing trigger and read back current for September, October and November.

## Not completed

Full conversion of unexplained allowances cannot be verified from the available evidence while preserving the stated correct amounts. They remain unchanged rather than forcing a match. Live signed-in contract-screen verification remains unavailable without a production-compatible browser session; no preview or localhost browser checks were substituted.