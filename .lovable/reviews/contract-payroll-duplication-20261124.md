# Backup-first payroll duplication correction

## Delivered
- Rate snapshot: 24 November 2026, 17:34:17 UTC; 24,053 resources, 141 revisions, contract directory, payroll divisors and formula reference tables. Inspected ZIP includes hashes, original calculation/test files and original finance function definitions.
- Contract-only payroll calculates each original rate window using its actual dated duties and the whole-period divisor. Saved rates are not blended into independently charged full-month formulas.
- Equivalent unspecified/eight-hour attendance groups resolve in calculation only; genuine shifts remain separate. Ambiguous shifts, overlapping duties and missing dated rates block calculation instead of silently losing attendance.
- Every pay side validates duplicate calculations, including formulas whose saved display amount is zero. Exact duplicates apply once; differing source calculations remain review exceptions. Liability names ignore PF/ESI words within other components' formula bases; NFH is distinct from Paid Holiday.
- Fixed monthly items apply once across role lines/windows. Explicit saved PF monthly caps remain employee-level; conflicting role limits are flagged, not selected by assumption.
- Finance calculation version 4 is installed with rollback-tested claim/publish/dispatch guards; existing publication privileges are unchanged. Older workers cannot publish version-3 payroll as current results.

## September workbook
- Production inputs were read approximately 17:41–17:43 UTC and subsequently recalculated through the final shared engine; no Pages comparison was performed.
- 1,712 active clients, 2,362 saved September-ending windows, 837 approved records and 8,623 employee-role rows.
- 293 windows require source review; their master payroll/margin amounts are blank. 409 duplication findings comprise 143 handled exact duplicates and 266 possible duplicates, not 409 proven overpayments. Other missing-setting/formula/monthly-cap findings are separately listed.
- All 2,362 master windows reconcile to the calculated employee rows; all six worksheet counts and zero invalid cells verified. Dated component rows are explicitly before monthly weighting/limits and must not be added to final-output rows. Invoices are saved references, not freshly generated invoice matches.

## Preservation and verification
- Production readback verified all 24,053 resource rows and 141 revisions byte-for-byte unchanged from the backup.
- Attendance, payroll runs, immutable posted snapshots and final invoices retain their pre-change fingerprints. No payroll was posted or reprocessed, no contract charge was removed and no balancing amount was inserted.
- 74 focused regression checks pass; the latest automatic application check reports build OK.
- Signed-in live screen verification is pending delivery through GitHub → Vercel. No preview/localhost verification and no unrelated backend tools were used.

## Rollback and remaining decisions
- Restore only the changed calculation/test files from the archive or its recorded pre-change revision, remove the newly introduced payroll-rate-segments module, restore the original three finance definitions, and redeploy via the existing delivery. Do not overwrite newer contract edits with a blanket rate restore.
- Remaining source exceptions need verified authorized component/formula/role/shift settings. They were not silently deleted or altered to force margins positive.