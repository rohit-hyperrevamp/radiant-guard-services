# Modernize All Forms

## Goal
Bring every user-facing form into the same clean, white, system-blue design language as the Candidate form, without changing validation, saving, permissions, or business workflows.

## What will change
- Standardize text fields, dropdowns, date pickers, text areas, checkboxes, radios, switches, upload controls, labels, required markers, helper text, and errors.
- Give form dialogs a consistent white canvas, clear title area, balanced spacing, and stable mobile action area.
- Use system-blue for focus, selected, active, progress, and primary form actions.
- Apply one consistent section style and hierarchy across customer, unit, contract, attendance, payroll, inventory, compliance, onboarding, migration, and settings forms.
- Keep form canvases flat on mobile while retaining rounded dashboards, tiles, buttons, menus, and non-form cards.
- Improve narrow Android and iPhone layouts so fields stack cleanly, actions remain visible, and labels never clip.

## Technical details
- Update shared form controls and global form-scoped styles first so most screens inherit the design safely.
- Add a reusable form-section pattern for repeated bespoke forms, then update exceptions that cannot inherit shared styling.
- Preserve every existing required-field rule, calculation, upload flow, mutation, audit log, and role restriction.
- Exclude login, public privacy/data-deletion pages, read-only filters, and destructive confirmation dialogs unless they contain an editable business form.
- Verify representative large and small forms at mobile, tablet, and desktop widths; run type and formatting checks.
