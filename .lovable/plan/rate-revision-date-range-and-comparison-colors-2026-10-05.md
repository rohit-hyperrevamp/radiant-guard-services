# Rate revision date range and comparison colors

## Changes
- Add both **Applicable from** and **Applicable till** dates to revised-rate approval, defaulting the end date to the contract end date.
- Validate that the end date is not before the start date, and save both dates with the approved revision.
- Show the full date range on revised, present, and expired rates.
- Apply clearly visible green shading to the entire Present Rate column and yellow shading to the entire Revised Rate column, including all values and totals.
- Preserve historical rates and existing payroll/invoice date-splitting behavior.

## Technical details
- Update the production rate-approval database function through a new production migration.
- Update the rate revision dialog and table without changing unrelated contract behavior.
- Run the required TypeScript check, apply the production migration, and verify the live flow.
