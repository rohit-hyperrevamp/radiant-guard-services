# Mobile app interface re-review

## Direction
- Keep the current Radiant identity and all existing workflows.
- Make every screen feel simple, compact, and consistent from 320px phones through tablets and desktop.
- Prioritize clear hierarchy, reachable actions, readable values, and predictable placement over decorative styling.

## Changes
- Standardize page headers, action rows, tabs, filters, form fields, dialogs, cards, and bottom navigation so they align and size consistently on small screens.
- Convert remaining fixed-width controls to phone-safe full-width or responsive layouts; keep fixed icons and actions stable while allowing labels and values to shrink or wrap safely.
- Rework remaining wide data views with contained horizontal scrolling or compact mobile summaries so they never push the page beyond the viewport.
- Tighten employee and candidate screens, client mapping, inventory demands, invoices, offboarding, attendance, finance, compliance, and field screens where controls or tables remain crowded.
- Shorten any remaining visible instructions and labels where meaning stays clear; preserve permissions, calculations, validation, saved data, and navigation behavior.

## Validation
- Check representative public and authenticated screens at 320px, 360px, 393px, and 430px widths, plus tablet and desktop.
- Verify no horizontal page overflow, clipped text, overlapping controls, hidden dialog actions, or content obscured by bottom navigation.
- Exercise key mobile flows: sign-in, employee/candidate wizard, attendance, client mapping, inventory demand, migration preview, and Control Center navigation.

## Technical details
- Use the existing responsive tokens and shared UI components rather than route-specific hardcoded sizing.
- Use two-column mobile header grids where text sits beside fixed controls, with `min-w-0`, `shrink-0`, wrapping, and truncation applied deliberately.
- Keep true data tables scrollable inside their own region; use stacked layouts for forms and action groups below the tablet breakpoint.
