# Field Officer Dashboard Cleanup

## Dashboard structure
- Remove the large field-officer photo/identity panel; identity and employee details remain in the left navigation and My Profile.
- Keep the top summary as three clickable tiles: **Team**, **Present**, and **Items**.
  - Team opens the officer’s own team.
  - Present shows the present count plus today’s attendance percentage (for example, `3 · 100%`) and opens team attendance.
  - Items opens the officer’s inventory.
- Keep **My Attendance** directly below the summary and change attendance wording from **Check in / Check out** to **Log in / Log out**. Site-visit wording remains **start/complete visit** so the two actions are unambiguous.
- Remove **My Device / Live Status** from the dashboard.
- Remove **Live Now** from the right rail while retaining Activity, Birthdays, and Anniversaries.

## Workspace and units
- Remove the duplicate **Team size**, **Attendance today**, and **My stock available** tiles from My Workspace.
- Keep clickable **Pending onboarding** and **Pending rehire** tiles.
- Remove the separate **My rehire requests** section because Pending rehire already opens that workflow.
- Keep **My units** prominent; make unit rows and their available actions clearly interactive.

## My Client Visits
- Add a **My Client Visits** action immediately after My Attendance.
- Before attendance login, show it disabled with a clear attendance-required state.
- Once logged in, enable **Start your first/next site visit**.
- Reuse Radar’s existing visit workflow on the dashboard: assigned-unit selection, GPS, visit sequence, start, active-visit state, notes, rating, client name, signature, client photo, and visit completion.
- Keep attendance **Log out** in My Attendance. Prevent logging out while a site visit is still open and direct the officer to complete that visit first.
- Keep Radar available for the full map, route, history, and advanced visit controls; dashboard visit actions and Radar must refresh the same live records.

## Profile
- Move the existing functional My Device panel into the left profile pane below identity details, retaining GPS, battery, network, refresh, and live-location behavior.
- Keep the profile picture and photo controls on My Profile only.

## Interaction and verification
- Ensure every summary/workspace/visit tile has a working destination or action, keyboard focus, and mobile-safe tap area.
- Preserve cached dashboard values and silent refresh behavior.
- Verify field-officer desktop and mobile layouts, attendance login/logout state changes, visit start/completion, profile device status, and navigation targets.
- Run the project’s TypeScript validation after implementation.
