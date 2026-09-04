# Fix configurable attendance-day values in invoices

## What will change
- Update the invoice attendance lookup to include each attendance code’s configured day value.
- Keep the existing attendance calculation as the single source of truth, so `HD = 0.5` and any future attendance-code value is applied automatically.
- Verify Kakinada Unit 1 for 26 July–25 August 2026 returns to the expected rounded total of ₹3,50,896.

## Manual control
The value remains editable in Attendance Code settings. Changing a code’s day value there will update future payroll and invoice calculations without another code change.

## Technical detail
The invoice currently fetches only the code’s present/paid flags. It will also fetch `day_value`, which the shared attendance calculator already supports.
