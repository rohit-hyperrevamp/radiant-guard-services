# Mobile app UI re-review

## CLI325 Japan Tubular rate structure — 23 October
- [ ] Verify contract roles against uploaded SG/Supervisor sheets and reconcile printed totals/formulas.
- [ ] Add reusable HRA 5% (Basic + DA) formula and expose it in formula choices.
- [ ] Replace CLI325 verified role rates, back up old values, and verify calculations/readback; clarify conflicting totals before changing them.

## CLI2098 Pradeep / Ekanath correction — 23 October
- [x] Production verified 49748 already belongs to Pradip Raosaheb Rathod (inactive Security Guard at CLI2098), and 49653 to Ekanath Jaanrao Palaspagar; no identity merge needed. User confirmed 49748 is the same person called Pradeep Rathore.
- [x] User confirmed 30 duties in 21 September–20 October, keep cap and joining date unchanged. Restored 49748 active/enabled; reopened approved attendance and submitted (unprocessed) payroll to draft; replaced existing 30 dated marks with Present input. Global rules returned exactly 26 Present + 4 Extra Duty; no dates added or lost. Production before/after backups retained privately.
- [x] Read back 30 dated entries and 26 P + 4 ED; verified Ekanath 49653 name unchanged. Payroll/attendance require resubmission and approval.
- [ ] Change displayed name to Pradeep Rathore through the configured sensitive-employee approval process. Blocked on an authorized production session; do not bypass approval with a privileged direct name update.

## CLI2098 October attendance — 23 October
- [x] Inspect production: CLI2098 October period is 21 September–20 October; no entries or postings there for any of the three employees. Their current attendance is at CLI1651.
- [ ] Remove 37391/37414 PH credit at confirmed CLI1651: neither has stored PH/ED; attendance and payroll synthesize the holiday credit from unit settings. Per-employee exclusion is not supported; cannot turn off PH for the whole unit or remove their worked/absent day as a substitute. Requires a production-supported exclusion change; no safe production schema-write tool available in this turn.
- [x] User confirmed CLI1651, not CLI2098. Restored existing 49566 Amresh Kumar to active/enabled at CLI1651, retained Security Guard designation and posting, corrected joining date to 20 September; production readback passed.
- [x] Verified October contract period 21 September–20 October: Amresh already has exactly 22 P + one PH on 2 October and zero stored ED. Retained those dated marks without adding a duplicate holiday/ED payment.

## CLI4808 and CLI4809 — 23 October
- [x] Retrieve both authoritative Pages profiles; full contract directory and client-specific/mini-contract requests return no contracts for either client.
- [x] Create CLI4808 Hyderabad and update existing CLI4809 Plant 2.0 in production, linked to ORG207 and source branches; source addresses, dates, GST/PAN, PT/LWF and contacts preserved without duplicate clients. Existing managers and operational terms retained.
- [x] Read back every imported profile field with zero mismatches; confirm no fabricated contracts/resources and no unrelated existing field changes.
- [ ] Import verified contracts/rate structures: blocked on source contract documents or availability in Pages; payroll report returns a source server error. Signed-in live client-page review remains unavailable.

## Remaining panels and Compliance — 22 October
- [x] Rectify Staff, My Tasks, notification and Compliance tiles; centre the score and align exception controls.
- [x] Distinguish circular actions by purpose, including portal dialogs; add payroll/invoice summary View commands that focus the records while retaining existing per-record View destinations.
- [x] Thirteen shared controls/list checks pass; automatic compilation is clean.
- [ ] Live visual and exception-sweep review waits on publication and an authorized production session; no signed-in production session is available.

## Screenshot finishing fixes — 22 October
- [x] Protect labelled Add/Export action width and allow toolbar wrapping across Tasks, Clients and Vehicles.
- [x] Restore mildly rounded rectangular task/case/history/notification surfaces; add explicit payroll/invoice View destinations and labelled Breakdown actions.
- [x] Thirteen existing controls/list checks pass; automatic compilation is clean.
- [ ] Production visual verification requires publication and an authorized live session; screenshots show prior published styling, not the latest changes.

## Labelled controls and sidebar — 22 October
- [x] Correct shared icon detection so labelled actions remain pills; unify tabs/search controls and align client/organization actions.
- [x] Compact the sidebar expand/collapse control; 13 existing control checks pass and automatic compilation is clean.
- [ ] Signed-in production visual review requires publication and an authorized live session.

## Compact smart lists — 22 October
- [x] Audit directory-table patterns across clients, contracts, employees, organizations, inventory, recruitment and master data; consolidate Clients location/state/city and organization/branch into paired cells.
- [x] Apply shared width-aware primary fields and secondary detail dialogs to action-bearing directory tables, including legacy raw tables; retain original actions, exports and data. Narrow layouts use compact flat row groups rather than horizontal scrolling; calculation registers/forms are excluded.
- [x] Thirteen checks pass, including secondary values read through the detail dialog and original Delete action; automatic compilation is clean.
- [ ] Verify every signed-in list visually on production; blocked on publication and an authorized production session. Bespoke non-table lists and calculation matrices have not been fully visually reviewed.

## Single-line list action alignment — 21 October
- [x] Remove the shared wrapping conflict, reserve intrinsic action-row width and keep Delete's tooltip wrapper from shrinking; contracts use contained horizontal scrolling rather than clipping.
- [x] Review contract, employee setup, inventory, recruitment and management-list action groups; shared protection covers marked columns and legacy trailing icon groups without changing permissions or actions.
- [x] Automatic compilation is clean and ten shared dropdown tests pass.
- [ ] Verify signed-in live action alignment; blocked on publication and an authorized production session.

## Single-line scrolling list names — 21 October
- [x] Add a shared overflow-only scrolling label with consistent typography, bounded width, off-screen suspension and reduced-motion support.
- [x] Apply to shared long text and selection labels, employee/candidate, contract, organization/client, recruitment, inventory, cost-component and posting names without changing data or actions; numeric cells and status controls stay stationary.
- [x] Automatic compilation is clean; all ten shared dropdown search/selection tests pass, including keyboard selection and clearing.
- [ ] Verify signed-in live visual rendering; blocked on publication and an authorized production session.

## CLI4096 manual attendance saves — 21 October
- [x] Reproduced a CLI4096 Absent correction reverting to its old Present/ED mark; a before-update trigger now clears obsolete original-rule values on explicit edits, retaining metadata during internal recalculation.
- [x] Applied production migration; rollback-only regressions confirm Absent and cleared ED persist through repeated rules, and the Present-day cap stays enforced. No actual attendance marks altered by tests.
- [ ] Verify the user's signed-in edit flow on the live site; blocked on an authorized production session. Database fix is already active and does not require publication.

## CLI4096 separate Extra Duty invoice rate — 21 October
- [x] Traced invoice's single-rate multiplication of all duties; regular fixed-27 rate unchanged.
- [x] Apply (Basic + DA) / 26 × 2 to CLI4096 invoice Extra Duty only, with separate regular/ED lines in detail/print/Tally and consistent MIS/charter billing.
- [x] Production inputs confirm Basic ₹12,324 + DA ₹1,573 → ED ₹1,069; regular ₹805.69. Mixed-duty totals and regressions pass; zero issued invoices affected.
- [ ] Verify signed-in live invoice after publication; blocked on publication and an authorized production session. Payroll and attendance unchanged.

## CLI4096 fixed daily billing — 21 October
- [x] Production CLI4096 / CON15788 billing basis is Fixed 27 Days; payroll remains Days Minus Four, attendance untouched, no dated revisions or finalized invoices found.
- [x] Read back ₹21,753.58 ÷ 27 = ₹805.69 per duty; 26 duties ₹20,947.94 and 27 duties ₹21,753.63 before GST. Three focused calculation tests passed. Saved-data/calculation verified; signed-in live invoice screen not checked.

## BFSL uploaded September attendance — 21 October
- [x] Visually review all 40 pages and independently check clear daily grids against production identities; retain unreadable IDs, compound marks, source-year conflicts and unallocated Extra Duty as pending, not guessed.
- [x] Save 1,025 confirmed daily cells for 36 employees across 25 BFSL sites with before-change backups; retain existing line identities, put confirmed new secondary-site duties into Extra Duty, and convert clock-hour ED using the contracted eight-hour shift.
- [x] Read back all 1,025 cells with zero mismatches after restoring rule-original values for comparison; no dates outside 21 August–20 September changed, no processed payroll affected, and no regular line exceeds its 27-day cap. Deliver BFSL_September_2026_Attendance_Verification.csv with source-row exceptions; no full-sheet match or new approval claimed.
- [ ] Finish BFSL unresolved cells: user confirmation needed for conflicting employee/client IDs (Ranchi, Vadodara, Lucknow, Gorakhpur, Bhubaneswar and Mahesh at Giga Space), September 2025 heading, unclear compound holidays, secondary-site off-days, and conflicting/unallocated ED summaries; clearer daily source evidence needed for blurred rows. Blank source spans are not attendance or permission to delete prior records.

## Canara, SBI and L&T uploaded attendance — 21 October
- [x] Check requested Canara/SBI/L&T approvals: fresh production read shows all 128 existing September-overlapping sheets already approved (30 Canara, 13 SBI, 85 L&T). No additional approvals issued: new/partial sheets still require full-period verification; Ponda also contains a second employee's six existing entries beyond the 30 cells checked.
- [x] Extend all 38 identified expired/closed uploaded-sheet clients and latest contracts to 31 December 2026; fresh production readback confirms active status and dates, with other contract terms unchanged.
- [x] Save and verify 260 source-backed daily cells for 14 employees across 13 sites, including all eight reopened Rajasthan sites; retained existing dates and processed periods, with global-rule original values checked. Ponda date mapping corrected to the actual 30 printed columns (no August 31).
- [ ] Complete ambiguous source cells: Nagaur Noratan ID 47548 conflicts with Sundaram Raju Singh; Mohan Singh has P/P and unclear marks; Khatipura/Tonk OT-row P marks need numeric ED interpretation; dash/SUNDAY need paid/unpaid-off confirmation; Washim Nitin's WO conflicts with reliever posting. Blank printed rows do not establish attendance.
- [x] Extract 222 scanned pages and three spreadsheets; retain source references and identify duplicate archive contents.
- [ ] Complete date-by-date verification: 258 extracted rows have mapped client/employee IDs and 217 have stored entries, but stored entries are not proof of matching; conflicting names, misaligned daily columns and blank printed rows prevent automatic import.
- [x] Production writes available: safely verified missing attendance saved and read back; CLI4510 employee 25828 has exactly six Present marks (15–20 September) and 24 Absent cells on the printed dates. No payroll processed or approved and no existing attendance replaced outside corrections to this task's new Ponda cells.
- [x] Deliver Canara_SBI_LT_Attendance_Review.xlsx with 360 extracted-row review results and explicit incomplete-verification notes; flag calendar-month Canara spreadsheet differences and inactive Rajasthan source sites without reopening them.

## CLI4096 regular employees
- [x] Review the current CLI4096 roster and other postings; no processed payroll periods affected; inactive staff and employee 47940's prior CLI3708 reassignment preserved.
- [x] Production readback confirms 120 active employees regular/primary at CLI4096 and 175 other postings reliever-only; 6,235 attendance entries retained with identical employee/site/month duty totals. Historical manual Extra Duty remains Extra Duty rather than inventing Present; payroll-day caps still apply.

## Copy CLI4337 rates to L&T Rajasthan
- [ ] Read CLI4337's current saved contract resource formulas and rates; blocked because the live contract page redirects to login and available database read tools target a different backend.
- [ ] Apply its rate structure to matching L&T Finance Rajasthan roles only, preserving site identities, staffing quantities and unmatched roles; blocked on authorized production access.
- [ ] Verify saved target rates against CLI4337; blocked on the same production access. No contract rates changed.

## Smart search in long dropdowns
- [x] Add automatic search to shared dropdowns with more than ten options, covering contracts, branches, states and inventory; unify existing organization/client and designation pickers with indexed local matching without changing scoped options.
- [x] Verify word-order/name/code matching, selection retention, no dirty marking while searching, keyboard selection, empty/cleared results and short-list behavior; 19 tests pass and automatic build is clean.
- [ ] Verify signed-in production forms after publication; blocked until publication and an authorized production session are available.

## Reuse unchanged portal data
- [x] Add session-isolated saved reference-list caching with bounded freshness and write invalidation; exclude employee PII, financial results and permissions.
- [x] Remove duplicate opening refreshes while preserving expired-session recovery and existing change listeners; employee list stays fresh in memory for five minutes.
- [x] Test cache restore without another request, expiry, invalidation, account isolation and unavailable storage; 15 cache/search checks pass.
- [ ] Verify signed-in live reopening; blocked until publication and an authorized production session are available.

## Additional September attendance — 19 October
- [x] Review all 11 worksheets: ANZ/RMZ Hours contain 2,790 dated duties totaling 11,164 hours; Dynamic sheets contain undated monthly totals only. CLI4109 is missing 38 duties; CLI4108 flags an employee attribution for verification. Register daily cells are zero despite positive totals, so use Hours evidence, not the register cells.
- [ ] Match identities and import date-backed ANZ/RMZ attendance; blocked on an authorized live-site session (live attendance redirects to login; managed preview session targets a different backend).
- [ ] Import and verify Dynamic Logistics attendance; blocked on original dated muster pages, CLI4109 missing pages 5–6, and CLI4108 attribution clarification. Preserve existing records until then.

## Urgent dashboard loading delay
- [x] Fix zeros/"could not load" after background sign-in recovery: refetch on session recovery, dashboard waits for a real session.
- [x] Throttle live-location driven refetches on dashboard cards.
- [x] Diagnose the live dashboard's slow counts and payroll/invoice totals: serial lifecycle wait, unresolved window requests, timer-based full financial reloads, and nested JSONB serialization.
- [x] Optimize production P&L serialization without changing records, privileges, or values; separate authenticated count/lifecycle requests and avoid premature/polling P&L loads.
- [x] Verify identical October and September payloads, production basic counts (43ms) and P&L (1.5–1.7s versus prior 3.6s mean), three period-contract tests, and clean automatic compilation.
- [ ] Verify the signed-in live dashboard after publishing the page changes; blocked on publication and an available production session.

## Priority one: September exact reconciliation
- [ ] Include all applicable client-provided Drive rate structures in the current September re-review of payroll and invoices.
- [ ] Re-audit September payroll against Pages and invoices/MIS against original rate/attendance evidence; preserve already-matched records.
- [ ] Apply backed corrections to mismatching inputs only, retain before/after evidence, and validate actual generated totals.
- [x] Correct five additional BFSL duplicate ED supplements; fresh production calculations exactly match source taxable/GST/final totals for Kolkata, Ranchi, Patna, Gurugram and Indore. Only five invoice-charge rows changed; 21 focused tests pass. Not a generated-invoice or payroll approval.
- [ ] Update the summary from verified final outputs only; do not label unverified records as 100% matched.
- [x] Re-check CLI1359 and every BFL 21–20 site against the client MIS SG rate and amounts: Midwest = client invoice ₹2,12,041.20; all 343 MIS rows (323 site groups) within ₹1, total diff ₹0.86.
- [ ] Payroll Not match: 129 moved to Match under the duty-split rule; 139 left (other-deduction or PF/ESI/PT gaps at same gross) need per-employee fixes against Pages.
- [ ] Payroll Pending (268): search Pages by client ID and name; match where found.
- [ ] Invoice Not match (174) and Pending (508): Match only where contract, payroll and invoice math agree.
- [ ] Recover original September Pages payslips after temporary workspace reset and complete authenticated live payroll/invoice output checks; original 6,503-slip cache is absent and the current-query runner has not executed successfully, so full-period verification is blocked. Recovered Guwahati/Raipur PDFs and BFSL MIS from Drive; Guwahati has a ₹0.01 source GST rounding conflict, so no exact all-field claim or charge edit made there.

## Payroll-cycle status workbook
- [x] Fill a versioned tracker with 1,721 source-report results and explicit pending reasons; explain the 27-site BFL holding group and 378 missing cycle assignments. Payroll: 1,045 Match / 242 Not match / 434 Pending; invoice/MIS: 529 Match / 2 Not match / 1,190 Pending. These are comparison results, not fresh generated approvals; latest BFSL/L&T and independently unverified five-state invoice mappings remain Pending. All 150 rendered pages inspected, formula counts verified and populated dropdown changes tested.
- [x] Export current client-to-payroll-cycle assignments for the September 2026 review: 1,721 clients; retain an Unassigned sheet.
- [x] Create seven cycle sheets with serial number, client ID/name and payroll/invoice Match/Not match dropdowns plus automatic summary counts; unverified statuses remain blank.
- [x] Recalculate, test both dropdowns against detail/summary totals, inspect all 122 rendered pages and deliver the final Excel workbook.

## Consistent allowance names
- [x] Apply shared naming to contracts, rate comparisons, payroll, payslips and invoices without rewriting rates or formulas.
- [x] Audit 23,935 production resource structures and 207 source labels; CLI2 conveyance stays ₹2,200; grouping changes no amounts; 21 regression checks passed.
- [ ] Verify updated live screens after publication — blocked until publication.

## Case and task form documents
- [x] Widen and space case/task forms; add custom-named multiple case documents on save and task documents on completion.
- [x] Provide later in-app viewing and direct document downloads.
- [x] Validate name persistence, legacy filenames and downloads with passing tests; latest build is clean.
- [ ] Verify the updated save/view/download flow on production — blocked until publication; task creator attachments remain outside the existing assignee-only proof permissions.

## Single Tasks tile and global number readability
- [x] Combine assigned and created task summaries into one central dashboard tile.
- [x] Replace clipped summary values with shared width-fitting numbers across dashboard and module tiles.
- [x] Check the changes: 100 width-fitting cases and all three dashboard consolidation checks pass; latest build is clean.
- [ ] Verify updated tiles visually on production — blocked until the user publishes these UI changes.

## Pandurang dashboard recovery
- [x] Restore requested view-only menu permissions for Pandurang through employee Access Control.
- [x] Keep console users on their team dashboard, including old personal-dashboard links.
- [x] Show team/client sections independently of the Operations presentation, resolve designation names from the master, and report loading failures.
- [x] Verify production permissions and signed-in live dashboard: dashboard and module menu restored; four teammates and 829 sites readable.
- [ ] Verify the new team cards visually on production — blocked until the user publishes the updated app.

## State-based GST branches and invoicing

- [x] Extract and verify Maharashtra, Telangana, Karnataka, Goa, and Gujarat GST certificates.
- [x] Add configurable GST registration details to Branch Manager.
- [x] Select the supplier registration by client state with Maharashtra head-office fallback.
- [x] Apply CGST + SGST for same-state billing and IGST-only for fallback/interstate billing.
- [x] Apply the same calculation to invoice preview/print, MIS, and individual/combined Tally exports.
- [x] Apply and verify the production migration and run TypeScript validation.

## Dashboard status-card number visibility

- [x] Keep Attendance, Payroll, and Invoicing figures fully visible without ellipsis or wrapping.
- [x] Preserve equal sizing and alignment across all three status cards.

## Consistent iOS-style mobile refinement

- [x] Align dashboard and all mobile surfaces to the bottom dock width.
- [x] Standardize compact buttons, switches, selectors, tabs, and action rows.
- [x] Add restrained glass treatment to floating and sticky mobile surfaces.
- [x] Re-audit attendance, sheets, onboarding, off-boarding, and shared forms for phone usability.
- [x] Run TypeScript and formatting validation.

- [x] Audit all mobile routes, shared components, and every form
- [x] Fix remaining alignment, placement, overflow, and clarity issues
- [x] Verify representative screens at narrow phone widths
- [x] Confirm checks and close remaining tasks

## Current request

- [x] Require Applicable from and Applicable till when approving a revised contract rate.
- [x] Show the complete validity range in present, revised, scheduled, and expired rate views.
- [x] Color the complete Present Rate table column green and Revised Rate column yellow.

- [x] Restore Recruitment dashboard summary tiles to the established full-size dashboard layout.

- [x] Consolidate abbreviated and grade-suffixed designations end to end, including CCT/CCTV A-B, Fireman A, pump-operator A, ARG, CAHOT/TSM, and EXC.

- [x] Make attendance row deletion remove only the selected regular/reliever posting and preserve sibling lines for the same employee.

- [x] Reconcile the uploaded BFL Telangana MIS total against approved system attendance branch by branch.
- [x] Identify the complete 2634 vs 2583.54 variance, including missing and extra branches.
- [x] Reassign CLI3885 Medha Hospital Road from the unrelated ORG296 to BFL Rural and preserve its BFL MIS attributes.
- [ ] Publish the shared BFL MIS template fix and verify the regenerated Telangana total on the live site.
- [x] Diagnose the sudden global slowdown against the live database and isolate Training from the regression.
- [x] Remove duplicate Attendance/Payroll/Invoice period-status reads and debounce realtime refresh storms.
- [x] Move attendance photos beside their respective Day Patrol punch-in/out times and remove the separate gallery.
- [x] Compress new attendance photos to low-resolution JPEG thumbnails before upload.
- [x] Copy-to-clipboard option for IDs (clients, contracts, employees) across list screens
- [x] Mic input in the ED "Set ED hours" dialog — speak "1 hour 30 minutes", fills hours/minutes
- [x] Prevent legacy zero-hour fallback rows from duplicating employees with saved attendance lines across clients

- [x] Make the Control Center home a Radar-only dashboard with live field officers first.
- [x] Show the full Radar map, completed versus in-progress visits, and field officer deployment mapping.
- [x] Restrict the Control Center left menu to Radar Dashboard, Day Patrol, Expenses, and Reports.
- [ ] Verify the Control Center dashboard live as Shiv Shankar Kumar after deployment.

- [x] Expand the HR Executive client portfolio to the full dashboard width.
- [x] Prevent client-table text overlap and keep wide columns internally scrollable.
- [x] Make dashboard clients link directly to their matching Clients-page record.
- [x] Make client type, dividing factor, pay cycle, and pay date filters independently combinable.
- [x] Run TypeScript validation.

- [x] Reconcile all 12-hour Maharashtra L&T guard contracts to their correct district rate-sheet columns.
- [x] Show final Billing instead of Gross and remove duplicate Billing/day from resource cards.
- [x] Show 27-, 26-, 25-, and 24-day billing rates together for every contract resource.
- [x] Put the rate matching the current calendar month first (31→27, 30→26, 29→25, 28→24).
- [x] Determine the highlighted daily rate from each contract's actual payroll window, including 21 Aug–20 Sep as 31 days.
- [x] Match Employees summary tiles to the shared dashboard theme.
- [x] Make Employees open faster with an instant cached list, progressive paging, retries, and deferred inventory loading.
- [x] Fix field officer unit visibility dynamically on dashboard and candidate posting.
- [x] Rename field officer Employees surface to Candidates.
- [x] Redesign mobile More panel without Menu/X and clipping.
- [x] Keep mobile form canvases flat; preserve rounded dashboards, tiles, and actions.
- [x] Verify Rohit's production access and validate the mobile code changes.

## Interface recovery

- [x] Restore rounded dashboards, tiles, and CTAs while keeping form canvases flat.
- [x] Diagnose the signed-in page-load failure and stop duplicate live-unit subscriptions from crashing the dashboard.
- [x] Verify the corrected mobile interface and production unit feed.

## Contacts form fix

- [x] Fix Contacts step completion and red status after valid entry.
- [x] Modernize the Contacts form while preserving mobile-first behavior.
- [x] Verify validation and visual layout.

## Required-field indicator audit

- [x] Match every Candidate wizard red asterisk to actual save and submit rules.
- [x] Mark conditional requirements only when the condition applies.
- [x] Verify all wizard steps and shared address fields.

## Candidate form modernization

- [x] Simplify the Candidate form header, progress, steps, and actions.
- [x] Standardize sections, fields, contacts, documents, and validation states.
- [x] Verify narrow Android, iPhone, tablet, and desktop layouts.

## Candidate guided workspace redesign

- [x] Replace the desktop step strip with a persistent guided sidebar.
- [x] Keep the mobile form focused with compact progress and anchored actions.
- [x] Apply the selected Cloud White direction while retaining the current font and form rules.

## All-form design standardization

- [x] Standardize shared inputs, dates, selectors, text areas, labels, checks, radios, and switches.
- [x] Apply the Candidate form's white canvas and system-blue states to editable dialogs and sheets.
- [x] Keep form canvases flat on mobile while preserving rounded dashboards, cards, tiles, and actions.
- [x] Cover bespoke dialog fields that do not use a form wrapper.
- [x] Verify formatting and mobile-safe action layouts.

## Employee-style business forms

- [x] Extend the white, system-blue form language across all shared form controls.
- [x] Modernize organization, client, state, branch, vehicle, contract, uniform, and asset form layouts.
- [x] Verify representative business forms at phone, tablet, and desktop widths.

## Convert all business forms to Candidate-style workflows

- [x] Inventory every create/edit form and classify wizard vs single-step.
- [x] Extract a reusable white-and-blue wizard shell with progress, completed steps, and mobile actions.
- [x] Convert organization, client/unit, state, branch, contract, uniform, item/product, vehicle, asset, and related forms.
- [x] Convert remaining operational forms while preserving validation, permissions, and saving.
- [x] Verify responsive form structure and project checks across phone, tablet, and desktop layouts.

## Field dashboard device card

- [x] Rebalance the My Device card so its status tiles and action fill the available height without a blank lower area.

## Candidate list and page headings

- [x] Add a clean empty Candidate state with a direct Add Candidate action.
- [x] Preserve totals, statuses, search, and candidate rows when records exist.
- [x] Remove the Home/location breadcrumb trail from shared page headings for every role.

- [x] Candidate form: left step list must scroll to Review (step 10); completion card overlaps it

## Employee dashboard redesign

- [x] Match Guard, billable, and non-billable employee dashboards to the Field Officer bento layout.
- [x] Preserve attendance, assignments, manager, team, device, and insights behavior.
- [x] Verify responsive layout and project checks.
- [x] Improve the profile-card image visibility and text contrast on mobile and desktop.
- [x] Show assigned unit locations and identify Primary and Secondary units.
- [x] Keep Duty and Unit cards white, color only their inner tiles, and label the profile card's primary unit.
- [x] Center attendance errors and confirm check-in/out with time and location.

## My Profile redesign

- [x] Replace net pay and employer-cost presentation with one CTC value for every employee profile.
- [x] Apply the selected Cloud White, system-blue, current-font bento profile design.
- [x] Preserve profile details, photo actions, postings, documents, settings, and sign-out behavior.
- [x] Rebuild My Profile as a full-width professional grid with a compact profile rail.
- [x] Normalize all card spacing, headers, gutters, padding, radii, and paired heights.
- [x] Remove Mobile App Status and keep the complete left profile/settings panel fixed on desktop.
- [x] Align profile content cards on one consistent grid.
- [x] Keep the profile rail sticky on standard laptop screens, not only extra-wide displays.

## Employee dashboard unit visibility

- [x] Trace the pictured employee's production unit mappings and explain why they are missing.
- [x] Show the primary unit and every secondary unit on the employee dashboard.
- [x] Verify the production data path and dashboard rendering.
- [x] Allow employees to read units explicitly assigned to them, regardless of branch scope.
- [x] Resolve dashboard units directly from the signed-in employee's authoritative unit list.
- [x] Replace multi-request assignment loading with one authenticated assignment resolver.
- [x] Keep the My Profile rail fixed while only profile details scroll on desktop.
- [x] Clean field officer dashboard tiles, terminology, navigation, profile devices, and attendance-gated site visits end-to-end
- [x] Revise candidate onboarding contacts, automatic codes, optional ESIC family, UAN availability and seven-day compliance dashboards

## Field officer inventory catalogue and request sources

- [x] Add only Uniform and Shoe with approved sizes.
- [x] Seed test stock across Rohit Joshi's primary unit and Radiant headquarters.
- [x] Limit field-officer request sources to primary unit first and headquarters second.
- [x] Limit the field-officer request catalogue to available Uniform and Shoe stock.
- [x] Verify the full request and fulfilment workflow in production.

## Field officer dashboard visit history

- [x] Show today's completed site visits below the next-visit action.
- [x] Link each visit and the next action to Radar.
- [x] Refresh dashboard history immediately after completing a visit.
- [x] Verify the dashboard visit history against production data.

## Welcome popup removal

- [x] Remove the automatic welcome popup from the admin interface.

## Field officer dashboard final cleanup

- [x] Remove most visited, least visited, and not visited cards.
- [x] Compact onboarding, rehire, and UAN tiles into one row above My Units.

## Field officer inventory workspace

- [x] Rename the dashboard Items tile to Inventory and connect it to Uniform Manager.
- [x] Add a field-officer stock dashboard for Uniform and Shoe quantities by size.
- [x] Connect Demands, Delivery Challans, Issuances, and Collections end-to-end.
- [x] Verify role scoping, navigation, and project checks.

## Field officer issuance guard scope

- [x] Restrict the issuance guard picker to the signed-in field officer’s assigned/onboarded guards only.
- [x] Verify Rohit’s production guard scope and run project checks.

## Issuance quantity validation

- [x] Make the visibly entered issued quantity authoritative when moving to Review.
- [x] Verify the field-officer issuance flow and project checks.

## Collections and security guard dashboard cleanup

- [x] Hide guards and unit groups with no recoverable inventory from Collections.
- [x] Align Collections totals, pending indicators, search, and empty state with recoverable stock.
- [x] Remove the guard dashboard portrait and apply the field-officer dashboard cleanup pattern.
- [x] Remove duplicate guard My Profile and Notifications tabs while keeping My Attendance.
- [x] Verify guard profile/notification access and run project checks.

## Missing contract designation follow-up

- [x] Show every enabled designation during client-unit onboarding and label out-of-contract choices.
- [x] Add a secure live seven-day exception feed scoped to Field Officers and Finance.
- [x] Add compact follow-up tiles and actionable detail lists to both dashboards.
- [x] Apply and verify the production migration, automatic resolution, and project checks.

## Verification key (SurePass) readiness

- [x] Confirm the app calls the provider with the key the owner issued (stored as SUREPASS_API_KEY), not the older expired key.
- [x] Make the stored key authoritative instead of the copy baked into server env code.
- [x] Add a production encrypted-database fallback when the deployment host does not inject the stored key.
- [x] Confirm the replacement key is active with the provider for Aadhaar and PAN verification.

## Field officer dashboard compaction and visit detail

- [x] Put Team and Present together in one mobile row while keeping Inventory full-width.
- [x] Show complete visit details from Radar on the dashboard, including feedback and proof details.
- [x] Put Pending onboarding and Pending rehire together in one mobile row.
- [x] Combine UAN and contract-designation follow-ups into one dashboard box.
- [ ] Validate the live mobile dashboard after the automatic deployment completes; TypeScript validation passed.

## Candidate UAN wording

- [x] Replace the personal UAN question with candidate-focused wording in onboarding.

## Operations documentation suite

- [x] Finalize attendance guide nomenclature and remove “Field Guide”.
- [ ] Create and verify site visit guide.
- [ ] Create and verify candidate onboarding guide.
- [ ] Create and verify inventory request and approval guide.
- [ ] Create and verify guard asset assignment guide.
- [ ] Create and verify manual unit attendance guide.
- [ ] Create and verify employee unit reassignment guide.

## Finance dashboard loading

- [ ] Remove the production dashboard timeout for Finance without widening RBAC access.
- [ ] Verify Swapnil's dashboard count and finance-data requests with his signed-in identity.

## Field officer client and reporting-head mapping

- [ ] Review every row in the uploaded mapping workbook.
- [ ] Match or create field officers only where the sheet provides a usable client ID/name.
- [ ] Assign matched field officers to the corresponding units and reporting heads.
- [ ] Verify all production mappings and produce a detailed PDF reconciliation report.

## Dashboard and contract loading performance

- [x] Replace Contracts full client preload with a compact contract-specific lookup.
- [x] Move dashboard lifecycle totals into one production summary call.
- [x] Verify production timings and TypeScript validation; production screen verification follows deployment.

## Contract payroll-window navigation

- [x] Add one contract-driven payroll-window and cycle selector to Attendance, Payroll, and Invoicing.
- [x] Filter units, totals, lifecycle counts, searches, exports, and pagination to the selected window.
- [x] Pass exact period dates into Attendance, Payroll, and Invoice registers.
- [x] Validate production window assignments and TypeScript.
- [x] Multi-select filters (org/client/status) via shared MultiSelectFilter on Contracts, Attendance, Payroll, Invoicing
- [x] Show the highlighted month/year selector beside the payroll-window selector on all three screens.
- [x] Compact Invoice search and add All, Ready, Open, and Processed status filtering before pagination.
- [x] Add the contract payroll-window selector to the leadership dashboard and filter lifecycle/financial totals by it.

## Invoice output cleanup

- [x] Show CGST at 9% and SGST at 9% separately in invoice preview and print output; remove IGST.
- [x] Remove the Tally Billing File XLSX action from the invoice header.

## Tally invoice upload

- [x] Add secure per-invoice Tally invoice storage and production migration
- [x] Add Upload Tally Invoice and View controls on invoice details
- [x] Validate types and invoice workflow

## Attendance and payroll status filters

- [x] Add Attendance Open and Attendance Approved filtering beside search.
- [x] Add Payroll Open and Payroll Processed filtering beside search.
- [x] Validate filtering before pagination and run TypeScript checks.

## CLI3851 invoice percentage explanation

- [x] Confirm the values behind the displayed 87% and explain the calculation without changing data.

## Tally export (combined + per-invoice)

- [x] Restore Download Tally Format on invoice detail using the established Tally workbook layout.
- [x] Add Download Tally Format on the invoice list as one combined workbook for all filtered invoices.
- [x] Shorten MIS Format (XLSX) to MIS Format on both invoice screens.
- [x] bunx tsgo --noEmit passes.

## Document scanning for attendance photos — done

- src/lib/document-scan.ts: paper detection, perspective correction, shadow flattening, sharpening, quality scoring with guidance hints.
- src/components/DocumentScanCamera.tsx: live camera with real-time coaching and auto-capture when clear.
- Wired into attendance upload dialog (scan on manual upload, cleaned/original toggle, per-photo tips) and Migration Utility photo uploads.

## Full mobile-app interface optimization

- [x] Standardize the shared mobile shell, spacing, typography, actions, dialogs, sheets, tables, and safe areas.
- [x] Reduce nonessential on-screen copy and prioritize task-critical information across every authenticated screen.
- [x] Optimize dashboards, attendance, payroll, invoicing, contracts, employees, inventory, compliance, and settings for phone-first use.
- [ ] Verify representative role-based flows after a signed-in production session is available.
- [x] Run TypeScript validation and resolve mobile regressions without changing business rules or locked native push infrastructure.

## Mobile shell and dock refinement

- [x] Replace the footer-like bottom bar with a compact elevated app dock.
- [x] Rebuild the More panel as a clean two-column app launcher.
- [x] Reclaim phone width and vertical space across the shared signed-in shell.
- [ ] Visually verify authenticated screens; blocked until a signed-in session is available.

## iOS-style mobile interface refinement

- [x] Audit shared shell, controls, dialogs, cards, tables, and every route at phone widths.
- [x] Apply a unified iOS-inspired mobile visual system with minimal copy and safe-area spacing.
- [x] Fix clipping, overflow, action placement, toggles, filters, and dense record layouts globally.
- [x] Apply targeted fixes to screens that cannot inherit the shared improvements.
- [x] Run TypeScript validation; production visual verification follows deployment.

- [x] Make the mobile bottom dock black, matching the desktop navigation.
- [x] Remove bold/black typography from the interface; retain regular and medium weights only.

## Full-width mobile app refinement

- [x] Align phone cards and page content to the floating dock edges.
- [x] Replace the separate More drawer with an expanding black dock.
- [x] Rework the Payroll top controls for mobile.
- [x] Finish the cross-page data, table, and form visibility audit.
- [x] Run final TypeScript and responsive integrity checks.

## Mobile attendance entry

- [x] Replace the phone spreadsheet with a day-first employee attendance list.
- [x] Add one-tap attendance codes, employee selection, bulk marking, and compact Extra Duty entry.
- [x] Keep scanning, workflow status, payroll periods, roster mapping, desktop Form XVI, and print behavior intact.
- [x] Validate TypeScript and formatting without changing attendance rules or production data.

## Full mobile screen audit

- [x] Audit Control Center, Attendance, Employee/Candidate, and Client/Organization screens at phone widths.
- [x] Normalize page gutters, compact actions, filter rows, data cards, forms, dialogs, and tables without changing workflows.
- [x] Validate TypeScript and formatting; production visual verification follows deployment.

## Screenshot-specific mobile fixes

- [x] Compact State Manager list and make edit/view dialogs content-sized on phones.
- [x] Tighten employee cards and candidate onboarding while preserving all fields and actions.
- [x] Improve attendance top controls/status/history and prevent dock overlap.
- [x] Simplify Inventory dashboard density and mobile actions.
- [x] Validate types and formatting.

## End-to-end mobile app refinement

- [x] Audit every authenticated screen and shared control at phone width.
- [x] Standardize mobile typography, controls, cards, toolbars, dialogs, tables, and motion.
- [x] Refine people, client, contract, attendance, payroll, invoice, inventory, and control-center screens.
- [x] Verify TypeScript and formatting without changing business workflows.
- [ ] Verify authenticated production phone rendering after deployment.

- [x] Prevent every mobile form, modal, sticky action bar, and content panel from overlapping the bottom dock.

## Mobile employee and contract forms

- [x] Optimize employee onboarding and editing for focused, one-handed mobile use.
- [x] Optimize contract creation and editing with compact steps, fields, and dock-safe actions.
- [x] Verify phone layouts and run TypeScript and formatting checks.

## Consistent operational summary tiles

- [x] Standardize Attendance, Invoice, Payroll, Employees, Contracts, and manager summaries with colorful icon-led tiles.
- [x] Give every shared page statistic a meaningful icon and stable accent color.
- [x] Keep mobile summary rows compact, swipeable, and aligned to the app content width.

- [x] Standardize compact mobile filters, buttons, toggles, and list cards across Employees, Contracts, Clients, Organizations, States, Branches, and related admin directories.

## Mobile muster-grid attendance entry

- [x] Replace the separate day-first mobile cards with a compact, desktop-consistent muster grid.
- [x] Make every eligible day cell directly editable on phones while preserving ED and restrictions.
- [x] Keep employee identity visible during horizontal scrolling and retain bulk entry.
- [x] Run TypeScript and formatting validation.

- [x] Simplify multi-employee mobile attendance entry and bulk actions
- [x] Fix dashboard and module stat values to stay single-line
- [x] Repair candidate editor mobile header/footer and employee stat alignment
- [x] Review listed operational screens for shared mobile consistency

## Notification and mobile drawer polish

- [x] Redesign the mobile notification drawer with clearer hierarchy and compact actions.
- [x] Add meaningful colored icons for each notification category.
- [x] Match More, dialogs, drawers, sheets, and confirmations to the same blurred backdrop treatment.
- [x] Run TypeScript and formatting validation.

## Dashboard card consistency and More blur

- [x] Standardize dashboard card heights, spacing, radii, icons, labels, and value sizing.
- [x] Keep Dashboard, Attendance, Payroll, and Invoicing values on one line.
- [x] Strengthen the full-page More blur below the expanded black dock.
- [x] Run TypeScript validation; live authenticated phone rendering requires a signed-in production session.

## Mobile attendance employee column

- [x] Widen the frozen employee column so names and identifiers remain visible.
- [x] Keep employee names and details on single lines with clean truncation.
- [x] Use a solid white background across the full frozen name and Extra Duty cells.
- [x] Remove the spilling selected-row fill while retaining a clear selection outline.
- [x] Run TypeScript validation.

## Add Candidate dialog renders blank (FIXED)
- [x] Fix blank white body when opening Add Candidate from Employees (only Save Draft/Next render)
- [x] Review all other forms/dialogs for the same blank-content issue

## Pagination label alignment
- [x] Keep Previous, page numbers, and Next on one horizontal line without clipped text.

## Candidate-style Control Center forms
- [x] Apply one consistent Candidate-style layout to every Control Center create/edit dialog.
- [x] Align full-page Control Center forms to the same sections, fields, toggles, and actions.
- [x] Verify short and long forms on mobile and desktop and run TypeScript validation.

## Control Center form UI parity correction

- [x] Replace compact dialog-sheet geometry with the Candidate form's full white mobile workspace.
- [x] Apply the shared frame, field, section, header, and fixed-action treatment to every editable dialog.
- [x] Verify representative short, long, and sectioned dialog structures across phone and desktop rules.
- [x] Run TypeScript validation.

## Manager data scoping to their field officers
- [ ] Operations managers / branch managers / VP Operations see only cumulative data for the field officers reporting to them.
- [ ] Apply the same subtree scope to the operations overview, radar summary, reportees and people insights.
- [ ] Run TypeScript validation.

## Multiple field officers per unit
- [ ] Allow assigning more than one field officer to a unit.

## Manager data scoping to their field officers
- [x] Shared `useOperationalUnitScope` (field officer own units, manager = units of their field officer reportees)
- [x] Dashboard headline counts, operations overview, radar summary scoped
- [x] Reportees page and people insights scoped
- [x] Attendance, payroll, invoice, unit and organization lists scoped
- [x] Multiple field officers per unit (already supported via employee_scope_assignments; unique key allows many per unit)

## End-to-end core screen loading reliability

- [x] Make Leadership dashboard counts retry transient failures, retain the last valid period snapshot, and isolate lifecycle totals so they cannot crash the page.
- [x] Simplify Payroll: remove gross-to-date, deployed counts, attendance status, and per-unit payroll totals; keep name, contract ID, and right-aligned Payroll Open.
- [ ] Bound authentication and shared data requests; add visible retry states.
- [ ] Consolidate manager and Field Officer scope loading in production.
- [ ] Remove duplicate/unbounded list requests across Dashboard, Clients, Contracts, and Employees.
- [ ] Flatten and protect Attendance, Payroll, and Invoice loading paths.
- [ ] Optimize measured production functions and supporting indexes.
- [ ] Validate production timings, TypeScript, and live production behavior.
- [x] Remove per-keystroke Employees search requests and the yellow search focus treatment.
- [x] Compact Employees totals and replace long client names with hoverable client IDs.
- [x] Remove approval cycle health, today's committed attendance, and workforce deployment panels from leadership dashboards.
- [x] Remove all in-app status toast pop-ups while preserving push notifications.
- [x] Remove the map from Field Officer site visits; keep Radar maps restricted to permitted control-center users.

## State-based GST branches and invoicing

- [ ] Extract and verify the five uploaded GST certificates.
- [ ] Update production branch GST names, numbers, and registered addresses.
- [ ] Make invoice origin branch configurable by client state with Maharashtra fallback.
- [ ] Show CGST + SGST for same-state billing and IGST only for interstate billing.
- [ ] Apply the rule to invoice preview, print, MIS, and Tally outputs.
- [ ] Validate production data, calculations, and TypeScript.
- [x] Fix attendance upload: resolve/create people, map primary guards, preserve relievers, then save attendance end to end

## Leadership dashboard and Control Center permissions

- [x] Make dashboard variants depend on the verified current role instead of stale cached permission shapes.
- [x] Register every Control Center tool and filter tiles by its exact permission.
- [x] Return denied Control Center routes to Control Center instead of Deduction Types.
- [x] Apply and verify the missing permission rows in production.
- [x] Run TypeScript and formatting validation.
- [x] Invoice charter: State + City dropdown filters next to search/Invoice-ready (billing_city added to get_attendance_charter_units RPC, applied to prod)
- [x] Invoice rows: drop % circle, Attendance badge, Contracted/Invoice-to-date/Payroll-to-date/margin; show name, deployed, client ID, contract ID, status badge right
- [x] Payroll rows: show client ID + contract ID alongside Payroll Open status

- Transport role: full Vehicles + Assets access (incl. Asset master), and a Fleet & Assets dashboard with no leadership snapshot or payroll window.
- [x] Transport role: Control Center fully hidden — removed asset_manager grant and turned off control_center parent view in prod (db/prod-migrations/20260923030500_transport_remove_control_center.sql); menu and direct /admin/control-center access now blocked for transport.
- L&T Finance billing rates reconciled to the client cost sheet for Gujarat/Rajasthan/Telangana/Karnataka (admin + service charge split, 27-day billing divisor). Armed rates not applied — no armed guard lines exist on L&T sites.

## Done: CLI4317 attendance swap
- 31 attendance rows at CLI4317 (Nokha) moved from 47068 (Inder Singh) to 48001 (Anil); Anil posted primary at CLI4317; Inder Singh restored primary at CLI4326 (Neem Ka Thana). Migration 20260923100000.

- Merged Jaya Nagar stub employees: "4678048629" Shiroppa -> 48629 Shivappa Bhajantri, "EMP-105" chandro Bahadur -> 46780 Chandra Bahadur Thapa (db/prod-migrations/20260923110500_merge_jaya_nagar_stub_employees.sql).
- [x] Created L&T Karnataka sites CLI4504 Mudhol, CLI4505 Naragund, CLI4506 Ramdurg with contracts CON16191-16193 cloned from CLI4500 (Karnataka 12h structure)

- [x] Added "Days Minus Four" payroll/billing day basis (actual period days − 4) and applied it to all 199 active L&T contract resources; MIS "OT Rate" now labelled per day.

- L&T 26->27 present days: absorbed one extra-duty day into attendance for all 21-20 window L&T sites (Aug 21 - Sep 20 2026). Migrations 20260923150000 / 151000 / 152000. 46 people now at 27; 1 reliever skipped (relievers cannot hold present codes).

- Merged duplicate L&T contracts (CON14918→16000, 14898→15978, 14915→15993, 14910→15989, 14907→15986, 14906→15985): postings, attendance, sheets and payroll runs moved to survivors; old contracts expired 2026-09-23 (db/prod-migrations/20260923163000_merge_duplicate_lt_contracts.sql).
- [x] Employee edits: removed the delayed form reload that overwrote changes, verify the saved role after updates, and restored Pankaj Zate (49258) to Field Officer in production.
- [x] Consolidate the inactive duplicate Radiant organization into the canonical active organization and hide inactive organizations from employee posting.

- [x] Attendance location rules (role + person) under Radar; server-enforced; auto-save missing site coordinates
- [ ] End-to-end field test by user (FO anywhere, guard at mapped site, office staff at home office)
- [x] Restore exact paise on all active BFL contract rates per Salary Master (26,049.88; 26,150.32; etc.)
- [x] Rani dashboard: payroll-period dropdown on attendance coverage; field officer → units → guards chart; PFL_SHEET2 FO mapping (migration 20261001041000); AlertCheckin Sep 28–30 backfilled from sandbox.
- [ ] AlertCheckin nightly sync sign-in fails on the live server (works from sandbox) — detailed error now logged; diagnose after next run.
- [ ] Vinod Kumar (44111, FO for 84 Poonawalla sites) is inactive — confirm with user.

## Recruitment RBAC and interview access
- [x] Put every new recruitment surface behind RBAC.
- [x] Grant Recruitment access to HR and recruiter Sanskriti (employee 43930).
- [x] Ensure assigned interviewers can open candidate details and see interviews on their dashboard.
- [ ] Verify recruiter-created and assigned interview flows end to end in production — blocked until the updated app is published; database policies and live records are verified.
## Recruitment supporting documents

- [x] Add optional recruiter-only uploads for education, salary, resignation, relieving, and miscellaneous documents.
- [x] Secure document metadata and private files through Recruitment access.
- [x] Verify upload, open, add, and remove implementation; run TypeScript validation.

## Contract rate history visibility

- [x] Keep every superseded rate visible as Expired after approving its replacement.
- [x] Show the expired rate's validity and monthly billing on the resource card.
- [x] Allow direct previous-versus-current rate comparison after approval.

## Contract invoice split
- [x] Contract-level invoice output rules (parts, include/exclude)
- [x] Separate final invoice number per part; plain exports carry no number
- [x] Created leadership users Prateeka Singh (X3) and Amrita Bevli (X4)

## Consistent dashboard tile layout
- [x] Standardize tile heights, labels, number fonts and bottom alignment across all dashboard variants and shared summary tiles.
- [x] Check layout and number-fitting regressions: 100 fitting cases, three dashboard consolidation checks, and ten shared tile-style checks passed.
- [ ] Verify live appearance after publishing (unpublished UI cannot be checked on production).

## Single-line dashboard labels and follow-up alignment
- [x] Align UAN and contract-designation counts at the bottom using the shared tile layout.
- [x] Fit complete headings and status/task labels on a single line.
- [x] Run fitting and layout regression checks: 54 full-word/value cases, 100 number cases, and both follow-up layout checks passed.
- [ ] Verify live appearance after publishing (requires published UI).

## Reminder for Chun Chang (paused 11 Oct 2026)
- [ ] Pages history: finish ~21,600 former-employee profiles and copy document files (photos, Aadhaar, PAN, signatures) — the background copy stopped when the workspace reset.

## September Pages rupee match (11 Oct 2026)
- [x] Rates/day rules compared; 490 contract lines corrected to Pages
- [x] 2,839 Pages Sep deductions added; PT/once-a-month items now land on the employee's rated line
- [x] Round 2 (11 Oct): payroll windows, cross-site PT, rounding, PF/ESI bases, ED items, billing days (incl. Bajaj), attendance, admin charge, missing allowances — 4,602/5,938 exact
- [ ] Remaining ~1,336 payslips: Extra Duty at double rate / benefit-inclusive ED rate (needs an ED multiplier setting), per-person Pages deductions, ESI/EPF on groups with no unique fit, 3 sites with overlapping October attendance (CLI394, CLI3356, CLI3938)

## Manager email matching and Excel list
- [x] Attach spreadsheet emails to uniquely matched active employees only (9 verified updates).
- [x] Verify saved emails and export existing/missing users with names, designations, phones and status; exclude inactive profiles (9 active, 4 without an active match).

## CTC billing add-on choices
- [x] Add selectable management fee at 7% of CTC.
- [x] Verify existing selectable reliever charge at 16.67% of CTC.
- [x] Verify both production formulas and preserve existing contract selections; five calculation tests pass.
- [ ] Verify the changed downstream CTC refresh on the live site after publication.

## Inventory team demo guide
- [x] Create a concise Excel workbook with separate workflow tabs covering setup, stock, requests, vendor receipts, challans, uniform issuance and returns.
- [x] Check steps against existing screens and deliver the workbook; 10 tabs verified. Challan PDF printing is clearly marked unavailable.

## Source-backed September Drive reconciliation
- [x] Recheck fresh BFSL/L&T MIS with stored ED as days, preserve invoice parts, and production-read-back 12 documented BFSL supplement corrections (₹12,073.68 duplicate billing removed); four regression tests pass.
- [x] Deliver September_Split_Invoices_and_Adjustments_v2.xlsx: 22/38 BFSL billing-input matches and 117/219 L&T employee-site billing-input matches; no generated payroll/invoice approval claimed.
- [ ] Recheck regular/Extra Duty/reliever invoice parts without double-counting sites or duties; compare documented invoice charges separately from payroll additions/deductions.
- [ ] Verify duty reclassification against contract rules and source attendance/MIS/Pages, then deliver updated invoice and payroll evidence with unresolved cases clearly identified.
- [x] Recover the original shared folder and cached five-state invoice sources; confirm 736 parsed invoice objects and 420 prior comparison rows.
- [x] Identify that the cached comparison chooses site combinations by closest invoice total; treat those mappings as unverified rather than exact matches.
- [x] Connect Vipit's Google Drive and verify the Radiant Launch folder, September attendance folders, client rate files and all five state invoice PDFs through successful reads.
- [x] Inventory the renewed Drive scope: 2,255 entries; retrieve/extract 438 invoice/rate files and 322 attendance files, including 54 scanned rate PDFs and 28 mislabeled attendance PDFs.
- [x] Apply and production-verify three source-backed billing-divisor corrections (CLI318 SG/supervisor calendar days; CLI887 SG fixed 26); executable assertions prove every other resource field unchanged.
- [x] Deliver September_All_State_Source_Review.xlsx covering all 736 parsed invoices, 120 explicitly comparable rate lines, source inventory and unresolved cases; claim no full-invoice matches.
- [ ] Review current Drive invoice, rate and attendance contents, including multi-site invoices — folder access restored; document-level reconciliation remains incomplete.
- [ ] Validate client identity, applicable rate version, billing divisor and employee-level attendance before applying supported corrections — document-level review remains incomplete; do not infer salary CTC from invoice totals or invent duty records.
- [ ] Recompute through the live invoice/payroll calculation and report exact matches — unresolved multi-site identities, proposed-versus-issued rate conflicts, employee/day evidence and authenticated live invoice verification remain blockers; production database access is available. CLI318 supervisor remains ₹0.52 below invoice monthly billing; no balancing adjustment invented.
