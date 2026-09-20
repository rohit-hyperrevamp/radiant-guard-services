# Restore Tally exports

## Changes
- Restore **Download Tally Format** on each invoice detail page using the previous Tally workbook structure and current invoice values.
- Add **Download Tally Format** on the main Invoice screen beside Search, producing one workbook across every invoice matching the current organization, unit, search, status, payroll-window, month, and year filters.
- Rename **MIS Format (XLSX)** to **MIS Format** on both invoice screens.
- Keep Upload/View Tally Invoice unchanged.

## Validation
- Run the required TypeScript check.
- Verify the controls and downloaded workbook behavior against production code and data paths.
