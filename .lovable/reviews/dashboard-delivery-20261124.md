# Dashboard zero-total investigation and delivery verification

## Rule
Saved, verified payroll and invoice totals must display consistently; missing or outdated results must never be presented as actual zero amounts. GitHub delivers this application to Vercel; no separate hosting connection is required for normal code delivery.

## Places checked
- `admin.dashboard.tsx`: read the saved-total query, exact-period selection, cache identity, and coverage/P&L bindings. Corrected the saved-total query key to version 4 to avoid earlier-result reuse.
- `FinanceCoverage.tsx`: read payroll coverage, invoice coverage, their detail dialog, P&L summaries, per-client rows and CSV exports. Rows/exports already distinguished pending from zero; summary tiles and dialog totals did not. They now withhold unavailable amounts and include only verified rows.
- `FinanceCharter.tsx`: read payroll/invoice source-engine reads, saved-total override, historical-period matching and finalisation selection. Direct engine values remain valid fallback sources; changed the aggregate cache identity to version 4. Existing finalized records are unchanged.
- `finance-totals.ts`: exact version equality could reject compatible newer published results during rolling delivery. Changed to the same minimum-version rule used by database publication; source-generation checks still reject stale results and versions below 4.
- `finance-summary-read.ts`: read exact-period filtering, roster coverage, requests and summary reduction. Already excludes missing totals rather than calling them verified; no permission changes.
- `finance-summary-compute.ts`: read invoice/payroll engine aggregation, latest processed snapshots and finalized invoice part overrides. Preserves settled figures and exact windows; no calculation or financial-record changes.
- `finance-refresh.server.ts` and public finance-refresh route: read claim, compute, publish, failure and continuation paths and private hook verification. Authentication boundary unchanged.
- Production database functions read: request_finance_totals, finance_totals_requested, dirty_finance_totals, dirty_finance_settings, claim_finance_totals, publish_finance_totals, fail_finance_totals, dispatch_finance_refresh, continue_finance_refresh and kick_finance_refresh. Old workers were rejected correctly but released leases without backoff, repeatedly returning claimed=40/published=0. Updated publication to delay same-source rejected versions/schema results while allowing changed generations to retry. Saved money and privileges unchanged.
- Other employee/field/inventory/sales/recruitment dashboards were searched for these shared financial call paths; they do not use this saved P&L flow and were not modified.

## Verified delivery
- Public GitHub main contained the committed September approval and corrected payroll changes.
- GitHub's Vercel status and production deployment status both reported successful delivery at approximately 18:24 UTC, 24 November 2026.
- At approximately 18:25 UTC, radiant.hyperrevamp.com changed from entry index-CLu8w78G.js / finance version 2 to index-CVk_wwnE.js / finance version 4.
- Production finance responses then changed to successful publication, including claimed=40/published=40. All 2,058 previously published September active-site totals remain current.
- No connector was added after the deployment-access card was declined. Normal delivery remains the existing GitHub-to-Vercel chain.

## Checks and preservation
- 40 focused regression tests passed, including compatible newer-result acceptance, source-generation rejection, unavailable summaries and verified zero amounts.
- Rollback-first production test verified old-version rejection, one-hour backoff, successful current publication, generation-race handling and unchanged publication privileges; then only the verified function definition was installed.
- Original publication definition retained privately for rollback. No rates, attendance, paid payroll, finalized invoices, roles or settings were edited.
- Authenticated homepage rendering is not independently verified: no production sign-in session was available. Live version, public deployment statuses and production money publication were verified directly; do not confuse these with signed-in UI testing.