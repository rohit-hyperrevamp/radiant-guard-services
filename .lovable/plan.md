# Candidate-style Control Center forms

## Direction
- Use the existing Candidate form as the visual standard; do not introduce a new visual theme.
- Preserve every field, validation rule, permission, calculation, save action, and activity log.
- Apply the same treatment to create, edit, upload, and configuration forms reached from Control Center.

## Changes
- Add a shared Control Center form-dialog layout with the Candidate form’s clean white canvas, compact header, consistent field spacing, grouped sections, and fixed action area.
- Update all Control Center dialog forms to use that shared layout, including short single-section forms and longer scrollable payroll, compliance, MIS, policy, workflow, and document forms.
- Align full-page Control Center settings forms to the same field, section, toggle, and action styling where dialogs are not used.
- Keep mobile forms full-screen and easy to scroll, with safe-area spacing and stable actions; keep desktop forms centered with sensible widths and heights.
- Correct outlier forms that override shared sizing or scrolling so headers, close controls, fields, and actions remain visible.

## Validation
- Run TypeScript validation.
- Check representative small, medium, and long Control Center forms at phone and desktop widths for clipping, overlap, inaccessible actions, and inconsistent spacing.
