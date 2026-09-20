# Consistent iOS-style mobile refinement

## Goal
Make every signed-in screen use the full phone width aligned with the black bottom dock, with compact iOS-sized controls, clear data views, and restrained glass surfaces.

## Work
- Remove the dashboard’s extra phone padding so its header, month controls, tiles, and lower sections share the dock’s exact 8px edges.
- Establish one shared mobile surface width and spacing rule for dashboards, lists, sheets, tables, details, and forms without altering desktop layouts.
- Reduce oversized buttons, switches, selectors, tabs, and action rows to compact visual controls while retaining accessible 44px touch areas.
- Apply translucent blur only to useful floating surfaces such as the dock, sticky headers, filter/action bars, and anchored form actions; keep data cards readable and performant.
- Recheck attendance capture, attendance sheets, onboarding, off-boarding, employee and contract forms, dialogs, and dense data screens for clipping, nested padding, oversized actions, and unreachable controls.
- Preserve all permissions, calculations, workflow rules, production data, and native push behavior.

## Technical details
- Keep the dock and mobile content gutter driven by the same shared spacing token.
- Prefer compact visible control dimensions with larger invisible/touch-safe hit areas where needed.
- Use standard `backdrop-filter` through Tailwind or shared CSS only, with opaque fallbacks for reduced transparency and touch-device performance.
- Validate TypeScript and edited-file formatting; production visual verification remains separate from source validation.