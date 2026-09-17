# Onboarding and UAN Compliance Update

## Candidate onboarding
- Keep Aadhaar and PAN compulsory and keep Review as the final submission step.
- Remove the editable Candidate Number field. New candidate numbers continue to be generated automatically, and the employee number continues to replace it in employee views after approval.
- Accept any exactly 10-digit mobile number, including numbers beginning with zero, across the candidate, contact, and guardian fields.
- Reorder Contacts so Nominee comes first and require at least one complete nominee before continuing.
- Rename Primary Contact to Emergency Contact, move it below Nominee, and make adding an emergency contact optional.
- Keep ESIC family members optional; when a family member is added, validate only that entered member’s required details.

## UAN capture
- In Records, ask “Do you have a UAN?” with Yes/No controls.
- If Yes, require a valid 12-digit UAN beginning with 1.
- If No, allow onboarding to continue and record the missing-UAN status and seven-day deadline from the onboarding/joining date.
- Keep existing UAN values compatible when editing older employees.

## Missing UAN follow-up
- Add a clickable **UAN Follow-up** tile to the Field Officer dashboard, scoped only to employees onboarded by or reporting to that officer.
- Add the same tile to the HR dashboard with organization-wide visibility.
- The tile shows the current missing count and opens a focused list showing employee, code, deployed unit, missing since date, deadline, days remaining or overdue, and status.
- Use green for days 0–3, amber for days 4–6, and red from day 7 onward.
- Allow authorized users to open an employee and enter the UAN; completed records disappear after refresh.

## Data and verification
- Use the existing candidate compliance record as the single UAN source; no duplicate UAN field or new table.
- Preserve field-officer visibility restrictions and existing cached dashboard loading behavior.
- Update both wizard navigation validation and final submission validation so they remain consistent.
- Verify new and edited candidate flows, automatic numbering, phone formats, required nominee, optional emergency/ESIC family, UAN Yes/No paths, both dashboards, drill-down filtering, and mobile layouts.
