# Compact invoice search and status filter

## Changes
- Reduce the invoice search field width on desktop while keeping it usable on mobile.
- Add an invoice-status dropdown beside search with All, Ready, Open, and Processed choices.
- Filter the invoice unit list using the selected period’s actual invoice status, before pagination.
- Include the status choice in Clear filters and verify TypeScript validation.

## Technical details
- Keep status loading and filtering inside the shared finance charter, but expose the control only in Invoice mode.
- Reuse the existing period-status query and the app’s Select control; no database changes.
