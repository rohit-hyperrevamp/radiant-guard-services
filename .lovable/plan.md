# Collections and Security Guard Dashboard Cleanup

## What will change

### Collections
- List only guards who currently hold at least one recoverable inventory item with a positive quantity.
- Remove empty guards and empty unit groups entirely, including the misleading “0 items held” rows and disabled Recover buttons.
- Keep search, unit grouping, offboarding recovery, collection confirmation, and stock movement behavior unchanged for guards who do hold items.
- Make the empty state say there is currently no stock to recover, rather than implying no guards report to the field officer.
- Recalculate the page totals and pending-recovery notice from the same recoverable guard set so every number matches the visible list.

### Security guard dashboard
- Remove the large employee photograph/profile banner from the dashboard; profile imagery remains available through the existing navigation profile control and profile page.
- Rebuild the top area in the same compact, clean style as the field-officer dashboard, retaining the guard’s essential attendance, uniform, unit, duty, manager, team, birthday, anniversary, and activity information.
- Remove duplicated/redundant summary blocks so the same attendance or assignment information is not presented twice.
- Keep **My Attendance** as a direct guard navigation item.
- Remove **My Profile** and **Notifications** from the guard navigation tabs because profile and notifications already have dedicated controls in the app header/sidebar.
- Preserve direct access to profile and notification pages from those existing controls and from notification links.

## Technical details
- Filter the Collections guard set only after positive stock balances have loaded, then use that set for grouping, search, counts, active selection, and empty-state rendering.
- Do not hardcode inventory products, guards, units, or stock; all visibility remains driven by live balances and reporting scope.
- Simplify `admin.employee-dashboard.tsx` without changing attendance, assignment, inventory, or reporting data rules.
- Update guard-only navigation in the shared admin shell without affecting field-officer or administrative menus.
- Run the project TypeScript check after implementation.
