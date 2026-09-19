# Fix dashboard and contract loading delays

## Changes
- Replace the Contracts screen’s full 4,000-client, all-column preload with a lightweight client lookup containing only ID, code, name, organisation, and contract dates.
- Keep full client records available only where an edit form genuinely needs them, so the contract register can render immediately.
- Move dashboard attendance, payroll, and invoicing lifecycle totals into one production database summary instead of downloading the full charter and issuing large client-side status queries before tiles appear.
- Preserve the existing 1,471-unit lifecycle rules and role-based visibility.

## Verification
- Apply the production migration through the approved production database connection.
- Measure the revised production queries.
- Run TypeScript validation and verify the live production screens load without blocking.
