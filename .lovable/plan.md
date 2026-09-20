# End-to-end mobile app refinement

## Goal
Make every authenticated screen feel like one consistent, polished mobile application at phone widths, using the uploaded screens as the baseline. Preserve all data, permissions, calculations, approval flows, and production behavior.

## What will change
- Standardize phone spacing, typography, card widths, compact buttons, icon actions, status controls, tabs, filters, and empty/loading states.
- Replace text-heavy mobile sections with clearer hierarchy, concise labels, grouped information, and progressive disclosure where the full detail is still needed.
- Correct clipped, oversized, or misaligned content across employees, candidates, onboarding/offboarding, clients, organizations, contracts, Attendance, Payroll, Invoices, Inventory, Control Center, dashboards, notifications, and manager screens.
- Make short dialogs content-sized, keep long forms full-screen, place actions consistently above the dock, and prevent dialogs or sticky controls from colliding with navigation.
- Normalize tables into readable mobile cards or safe horizontal sheets, with visible labels and stable action placement.
- Use restrained glass effects only for navigation, anchored filter bars, and sticky actions. Keep data cards clear and flat.
- Refine transitions and scrolling while respecting reduced-motion settings.

## Technical details
- Improve shared primitives and mobile CSS first so all screens inherit the same layout rules.
- Apply targeted route-level fixes only where a shared rule cannot safely solve the issue.
- Keep tablet and desktop layouts intact.
- Add or verify unique metadata on every content route touched.
- Run TypeScript and formatting checks, then inspect representative phone-width flows with screenshots where authentication permits.
