# Mobile attendance entry interface

## Goal
Replace the phone-sized muster spreadsheet with a simple attendance-entry experience that field users can operate quickly, while keeping the full statutory sheet available on larger screens and for printing.

## Mobile experience
- Show a compact unit and payroll-period header with Back, month/year, status, and scan/upload actions.
- Add a day selector for the payroll period so users can choose one date without horizontally scrolling through the entire month.
- Present employees as full-width, searchable rows with name, employee ID, designation, current attendance, and Extra Duty.
- Let users mark each employee with one tap using the configured attendance codes; retain existing joining-date, future-date, reliever, and locked-sheet restrictions.
- Add quick bulk actions for the selected day, including selecting multiple employees and applying one attendance code.
- Keep Extra Duty entry compact and accessible from each employee row.
- Use a sticky glass action bar for selection and workflow actions, positioned safely above the black bottom dock.
- Keep upload/scan, approval, rejection, amendments, and employee mapping available without crowding the primary marking flow.

## Desktop and print
- Preserve the existing Form XVI muster grid for tablet/desktop and printing.
- Do not change attendance calculations, saving behavior, contract payroll windows, permissions, approval workflow, employee scope, or production data.

## Validation
- Check the attendance landing page and unit-entry screen at the current 393×779 phone size.
- Verify search, date selection, single and bulk marking, Extra Duty, locked states, upload/scan access, and workflow actions.
- Run TypeScript validation and formatting checks.
