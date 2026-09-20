# Mobile-first app interface overhaul

## Goal
Turn the authenticated product into a compact, full-screen mobile app experience across every role and page, while preserving all existing permissions, calculations, workflows, and production data behavior.

## Shared mobile system
- Simplify the mobile top bar and bottom navigation so the current task and primary actions remain clear without repeated greetings or secondary copy.
- Standardize phone-safe page margins, vertical rhythm, typography, touch targets, compact cards, status indicators, loading states, and empty states.
- Make create/edit flows full-screen on phones with fixed headers, keyboard-safe scrolling, and anchored primary actions above native safe areas.
- Convert dense tables into concise record summaries on phones while preserving full desktop tables and every existing action.
- Collapse secondary explanations, helper copy, and low-priority metadata on small screens; keep essential labels, values, warnings, and validation visible.
- Normalize mobile filters and actions into compact, scroll-safe toolbars with overflow menus where necessary.

## Screen coverage
- Optimize the Admin, Field Officer, and Guard dashboards for fast scanning with fewer words and clearer priority tiles.
- Apply the mobile patterns to Attendance, Payroll, Invoice, Contracts, Organizations, Employees/Candidates, Inventory, Radar, Compliance, Control Center, Notifications, and Profile.
- Review every modal, sheet, wizard, list, detail view, upload flow, and empty/error state for clipping, overflow, excessive height, and awkward wrapping.
- Preserve existing role-based navigation, field-officer scope, pagination, payroll windows, status rules, audit logging, and locked native push behavior.

## Technical approach
- Start with shared styles and shared controls so all screens inherit consistent mobile behavior.
- Add small reusable mobile presentation patterns only where the shared layer cannot safely cover a screen.
- Update screen-specific layouts in prioritized batches, without changing backend rules or data models.
- Keep tablet and desktop behavior intact while treating narrow phones as the primary layout.

## Validation
- Run TypeScript validation after each batch.
- Verify representative screens at 320px, 360px, 393px, and 430px widths for overflow, text fit, safe areas, keyboard behavior, and reachable actions.
- Validate production-facing role flows on the live site once deployment is available; do not use preview results as production proof.
