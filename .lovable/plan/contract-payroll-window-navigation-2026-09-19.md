# Contract payroll-window navigation

## Outcome
Attendance, Payroll, and Invoicing will no longer mix every contract window under a single month heading. Each screen will show the configured payroll windows as selectable, concrete date ranges and will list only the units assigned to the selected window.

## Changes
- Create one shared payroll-window selector used by Attendance, Payroll, and Invoicing.
- Load active contract windows and group units by their configured start/end days; no window or unit values will be hardcoded.
- Show concrete ranges for the selected processing cycle, such as `21 Aug – 20 Sep 2026`, while retaining previous/next cycle navigation.
- Default to the window containing today; when more than one does, prefer the nearest closing window.
- Filter each charter before pagination, totals, status counts, exports, and searches so every displayed number belongs to the selected window.
- Pass the exact selected start/end dates into Attendance, Payroll, and Invoice detail pages.
- Preserve role scope, contract-driven calculations, approval locks, and existing 25-row pagination.
- Replace calendar-month wording with payroll-period wording throughout these three screens.

## Technical details
- Extend the shared payroll-period utility to expose normalized window definitions, labels, period keys, and exact date calculations.
- Reuse the contract window lookup already used by the charters, but fetch it once for the scoped unit set and share it with the selector and visible rows.
- Keep the processing month/year as URL state so links, refreshes, and browser navigation preserve the selected cycle and window.
- Remove the attendance landing page’s unused overlapping calendar-month sheet query.

## Verification
- Validate all configured production windows, including 1–month-end, 21–20, 25–24, 26–25, and 29–28.
- Confirm each window shows only its assigned units and opens identical dates in Attendance, Payroll, and Invoicing.
- Test month/year boundaries and February.
- Run `bunx tsgo --noEmit` and verify the live production screens after deployment.
