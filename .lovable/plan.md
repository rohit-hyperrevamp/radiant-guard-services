# Repair Leadership dashboard and Control Center permissions

## Outcome
Anshuman Singh and other Leadership users consistently land on the Leadership dashboard. Control Center shows only permitted tools, and every visible tile opens its correct page instead of redirecting to an unrelated tool.

## Changes
- Make the dashboard choose its Leadership/Operations/Inventory presentation from the verified current role, never a temporary or stale permission shape.
- Add the missing Control Center permission definitions for Public Holidays, Data Migration, Company Settings, Invoice Numbering, and MIS Sheets.
- Add a production-only migration that fills missing permission rows from each role’s existing Control Center parent permission without overriding deliberate permissions.
- Filter every Control Center tile by its actual module or section permission.
- Replace the current “first allowed route” fallback with the correct parent page, so denied Control Center sections return to Control Center rather than Deduction Types.
- Validate all tile destinations against registered routes, run the required typecheck, apply the migration only to the Radiant production database, and verify Anshuman’s effective permissions there.

## Technical details
- Production migration location: `db/prod-migrations/` only.
- Production database access: `psql "$RADIANT_PROD_DB_URL"` only.
- Existing role-specific permission values remain authoritative; only absent rows are inserted.
