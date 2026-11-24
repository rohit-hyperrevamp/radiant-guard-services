# September 2026 verified approvals and dashboard refresh

- User authorization: Rohit Joshi requested submission and approval so September totals appear on the homepage.
- Pre-change backup retained privately in the document metadata backups, including approval records, finance generations and reviewed engine outputs.
- Fresh production inputs passed through the shared version-4 payroll and invoice engines: 2,364 active-site September-ending windows checked; 2,058 complete finance results; 293 payroll source-review windows; 13 unavailable invoice-source windows.
- Rollback-first integration operation passed all approval, exact-publication and source-preservation assertions, then the same operation committed successfully.
- Newly approved: 616 payrolls (72 first submitted), plus four previously draft attendance sheets. Existing approvals and processed payroll preserved.
- Production readback: 1,453 approved/open payrolls, one approved/processed payroll; 178 submitted/open and 36 draft/open remain. Remaining records are not all duplicate errors: some have no payable attendance and are not eligible for blanket approval.
- All 2,058 published totals have calculation_version=4 and calculated_generation=generation. The 293 unresolved payroll and 13 unavailable-invoice windows remain explicitly unavailable, not zero-valued verified totals.
- Rate resources, rate revisions, attendance entries, immutable payroll snapshots and final invoices retained their transaction-level fingerprints. No money posting, source deletion or rate edit occurred.
- Audit entries name the assistant and Rohit Joshi's request rather than claiming the person signed in or hiding the action as an automatic reconciliation.

## Homepage delivery limitation

At the production check, the live finance asset still used calculation version 2 and the old worker returned claimed=40/published=0. The database rejects that worker's obsolete amounts. Saved version-4 results will remain pending on that old frontend until GitHub-to-Vercel delivers the current version-4 application. The deployment trigger was updated; actual deployment and authenticated homepage readback have not been verified.

## Re-run and rollback

`db/operations/20261124_september_verified_payroll_approvals.sql` accepts a freshly generated review import file. Default execution rolls back; `apply_changes` commits only after assertions pass. Never reuse the review after source changes: generation and exact status comparisons intentionally withhold stale windows.

Use the retained before-state backup for a narrowly scoped rollback of changed approval fields; do not overwrite later edits, processed payroll or newer source rates. Dashboard aggregates are reproducible through the shared engines.