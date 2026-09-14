# Mobile-wide UI and copy cleanup

## Direction
- Keep the current Radiant visual identity and existing workflows.
- Make all visible copy brief, plain, and action-led on both mobile and web.
- Treat 320px Android screens as the minimum supported width, with the same layout scaling cleanly through tablets and desktop.

## Changes
- Fix shared buttons, fields, tabs, dialogs, navigation, headers, cards, and grids so labels wrap or truncate safely without overlap.
- Remove global mobile styling that forces unrelated layouts into incorrect columns, and replace it with safer shared responsive rules.
- Simplify the employee onboarding wizard: shorter headings, labels, empty states, validation messages, and compact phone-safe footer actions.
- Shorten repetitive descriptions and jargon across high-traffic dashboards, attendance, employees, candidates, inventory, payroll, invoices, contracts, profile, notifications, and Control Center screens.
- Preserve all permissions, calculations, validation rules, saved data, and navigation behavior.

## Validation
- Test representative 320px, 360px, 393px, and 430px Android-style widths plus desktop.
- Check every reachable mobile screen for horizontal overflow, clipped controls, overlapping text, and obscured content above the bottom navigation.
- Exercise the onboarding wizard through every step, including error states and the fixed action bar.
