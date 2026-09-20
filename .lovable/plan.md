# Full-width mobile app refinement

## Goal
Make every signed-in screen feel like one consistent full-screen mobile app: cards aligned to the black dock, an expanding dock-based More launcher, and readable data and forms without clipping.

## Work
- Set one phone gutter so page content, cards, and the floating dock share exactly the same left and right edges.
- Replace the separate slide-up More sheet with an expanded black dock that grows upward, keeps the primary tabs visible, and closes after navigation or an outside tap.
- Rework Payroll's top area into a compact mobile toolbar with readable period controls and a clean transition into payroll data.
- Audit Contracts, Attendance, Invoicing, Payroll, dashboards, lists, details, and forms for fixed widths, clipped values, crowded actions, and poor data visibility.
- Normalize remaining cards, filters, selectors, dialogs, tables, and form actions around the existing medium-weight iOS-inspired visual language.
- Keep wide datasets usable through concise mobile summaries or contained horizontal scrolling while preserving complete desktop data.
- Verify type safety and edited-file integrity without changing permissions, calculations, workflows, or production data.

## Technical notes
- Changes remain limited to frontend presentation and responsive classes.
- Existing desktop behavior, permissions, calculations, data access, and workflows remain unchanged.
- The black dock remains the visual navigation anchor; More becomes part of that same dock rather than a separate drawer.
