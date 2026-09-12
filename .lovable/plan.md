# Fix non-billable employee assignment

## What will change
- Remove the duplicate posting-unit control from the top of the onboarding form.
- Keep the Radiant Pune office as the required payroll/home unit for Field Officers and other non-billable staff, without presenting its code as a misleading editable default.
- Replace the lower assignment area with one reliable searchable mapping control.
- Let the user choose whether to map the employee to client units or organizations, search by name/code, and select one or more results.
- Show selected mappings clearly and allow them to be removed before saving.
- Preserve existing mappings when editing an employee.

## Technical details
- Avoid the nested popup pattern that currently fails inside the full-screen form; use an inline search/results panel.
- Save the payroll/home unit separately from operational unit/organization scope.
- For Field Officers, keep the existing business rule: Pune office remains `candidates.unit_id`; client access is stored as operational mappings only.
- Add visible loading, empty, and retry states instead of a non-responsive field.
- Verify type safety and the onboarding interaction without changing unrelated employee flows.
